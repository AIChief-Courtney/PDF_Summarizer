import { Router } from "express";
import { getJob } from "../services/jobRunner.js";

const router = Router();

router.get("/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: { message: "Job not found." } });
    return;
  }
  res.json({ job });
});

export default router;
