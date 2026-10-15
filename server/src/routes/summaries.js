import { Router } from "express";
import { v4 as uuid } from "uuid";
import { db } from "../db.js";
import { createJob, drainJobQueue, getJob } from "../services/jobRunner.js";
import { isServerless } from "../paths.js";
import { attachContext } from "../middleware/context.js";
import { getOpenAI, aiUnavailableMessage } from "../services/openaiClient.js";

const router = Router();
router.use(attachContext);

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, status, created_at, job_id
       FROM summaries WHERE patient_id = ? ORDER BY created_at DESC LIMIT 100`
    )
    .all(req.context.patientId);
  res.json({
    summaries: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
      jobId: row.job_id,
    })),
  });
});

router.post("/", async (req, res) => {
  if (!getOpenAI()) {
    res.status(503).json({ error: { message: aiUnavailableMessage() } });
    return;
  }

  const config = req.body.config || req.body;
  const summaryId = uuid();
  const jobId = createJob("generate_summary", {
    summaryId,
    patientId: req.context.patientId,
    config,
  });

  db.prepare(
    `INSERT INTO summaries (id, patient_id, title, config_json, status, job_id)
     VALUES (?, ?, ?, ?, 'queued', ?)`
  ).run(
    summaryId,
    req.context.patientId,
    config.title || "Clinical summary",
    JSON.stringify(config),
    jobId
  );

  if (isServerless()) {
    try {
      await drainJobQueue();
    } catch (err) {
      res.status(500).json({ error: { message: err.message || "Summary failed." } });
      return;
    }
    const job = getJob(jobId);
    res.status(job?.status === "completed" ? 201 : 202).json({
      summaryId,
      jobId,
      status: job?.status || "queued",
      result: job?.result || null,
      error: job?.error || null,
    });
    return;
  }

  res.status(202).json({ summaryId, jobId, status: "queued" });
});

router.get("/:id", (req, res) => {
  const row = db
    .prepare("SELECT * FROM summaries WHERE id = ? AND patient_id = ?")
    .get(req.params.id, req.context.patientId);
  if (!row) {
    res.status(404).json({ error: { message: "Summary not found." } });
    return;
  }
  res.json({
    summary: {
      id: row.id,
      title: row.title,
      status: row.status,
      config: JSON.parse(row.config_json),
      output: row.output_json ? JSON.parse(row.output_json) : null,
      jobId: row.job_id,
      createdAt: row.created_at,
    },
  });
});

router.get("/:id/job", (req, res) => {
  const row = db
    .prepare("SELECT job_id FROM summaries WHERE id = ? AND patient_id = ?")
    .get(req.params.id, req.context.patientId);
  if (!row?.job_id) {
    res.status(404).json({ error: { message: "Job not found." } });
    return;
  }
  res.json({ job: getJob(row.job_id) });
});

export default router;
