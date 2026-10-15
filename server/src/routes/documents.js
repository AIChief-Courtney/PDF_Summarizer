import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuid } from "uuid";
import { db } from "../db.js";
import { getUploadDir } from "../paths.js";
import { createJob } from "../services/jobRunner.js";
import { attachContext } from "../middleware/context.js";

const router = Router();
const uploadDir = getUploadDir();
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename(_req, file, cb) {
      cb(null, `${uuid()}-${file.originalname.replace(/[^\w.\-() ]/g, "_")}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

router.use(attachContext);

router.post("/", upload.array("files", 5), (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    res.status(400).json({ error: { message: "No files uploaded." } });
    return;
  }

  const categories = JSON.parse(req.body.categories || "[]");
  const subcategories = JSON.parse(req.body.subcategories || "[]");
  const clinicalDate = req.body.clinicalDate || null;

  const created = [];
  for (const file of files) {
    const id = uuid();
    db.prepare(
      `INSERT INTO documents (id, patient_id, filename, storage_path, status, categories_json, subcategories_json, clinical_date)
       VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)`
    ).run(
      id,
      req.context.patientId,
      file.originalname,
      file.path,
      JSON.stringify(categories),
      JSON.stringify(subcategories),
      clinicalDate
    );
    const jobId = createJob("ingest_document", {
      documentId: id,
      patientId: req.context.patientId,
    });
    created.push({ id, filename: file.originalname, status: "queued", jobId });
  }
  res.status(201).json({ documents: created });
});

router.get("/", (req, res) => {
  const q = (req.query.q || "").toString().toLowerCase();
  const status = req.query.status?.toString();
  let rows = db
    .prepare(
      `SELECT * FROM documents WHERE patient_id = ? ORDER BY created_at DESC`
    )
    .all(req.context.patientId);

  if (status) rows = rows.filter((r) => r.status === status);
  if (q) {
    rows = rows.filter((r) => r.filename.toLowerCase().includes(q));
  }

  res.json({
    documents: rows.map(mapDocument),
  });
});

router.get("/:id", (req, res) => {
  const row = db
    .prepare("SELECT * FROM documents WHERE id = ? AND patient_id = ?")
    .get(req.params.id, req.context.patientId);
  if (!row) {
    res.status(404).json({ error: { message: "Document not found." } });
    return;
  }
  res.json({ document: mapDocument(row) });
});

router.get("/:id/file", (req, res) => {
  const row = db
    .prepare("SELECT * FROM documents WHERE id = ? AND patient_id = ?")
    .get(req.params.id, req.context.patientId);
  if (!row) {
    res.status(404).json({ error: { message: "Document not found." } });
    return;
  }
  res.sendFile(path.resolve(row.storage_path));
});

router.post("/:id/retry", (req, res) => {
  const row = db
    .prepare("SELECT * FROM documents WHERE id = ? AND patient_id = ?")
    .get(req.params.id, req.context.patientId);
  if (!row) {
    res.status(404).json({ error: { message: "Document not found." } });
    return;
  }
  db.prepare(
    `UPDATE documents SET status = 'queued', error_message = NULL, updated_at = datetime('now') WHERE id = ?`
  ).run(row.id);
  const jobId = createJob("ingest_document", {
    documentId: row.id,
    patientId: req.context.patientId,
  });
  res.json({ documentId: row.id, jobId, status: "queued" });
});

function mapDocument(row) {
  return {
    id: row.id,
    filename: row.filename,
    status: row.status,
    categories: JSON.parse(row.categories_json || "[]"),
    subcategories: JSON.parse(row.subcategories_json || "[]"),
    clinicalDate: row.clinical_date,
    pageCount: row.page_count,
    charCount: row.char_count,
    error: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default router;
