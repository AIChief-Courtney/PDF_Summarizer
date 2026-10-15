import { v4 as uuid } from "uuid";
import fs from "fs";
import { db } from "../db.js";
import { chunkPages, extractPagesFromPdf } from "./pdfIngest.js";
import { upsertChunks, deleteDocumentVectors } from "./vectorStore.js";
import { runSummaryJob } from "./summaryService.js";

export function createJob(type, payload) {
  const id = uuid();
  db.prepare(
    `INSERT INTO jobs (id, type, status, payload_json) VALUES (?, ?, 'queued', ?)`
  ).run(id, type, JSON.stringify(payload));
  queueMicrotask(() => processNextJobs());
  return id;
}

export function getJob(id) {
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!row) return null;
  return mapJob(row);
}

function mapJob(row) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    progress: row.progress,
    payload: JSON.parse(row.payload_json),
    result: row.result_json ? JSON.parse(row.result_json) : null,
    error: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function updateJob(id, fields) {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

let processing = false;

export function kickJobQueue() {
  queueMicrotask(() => processNextJobs());
}

async function processNextJobs() {
  if (processing) return;
  processing = true;
  try {
    while (true) {
      const job = db
        .prepare(
          "SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1"
        )
        .get();
      if (!job) break;
      updateJob(job.id, { status: "running", progress: 0.05 });
      try {
        if (job.type === "ingest_document") {
          await runIngestJob(job);
        } else if (job.type === "generate_summary") {
          await runSummaryJob(job);
        } else {
          throw new Error(`Unknown job type: ${job.type}`);
        }
        updateJob(job.id, { status: "completed", progress: 1 });
      } catch (err) {
        updateJob(job.id, {
          status: "failed",
          error_message: err.message || String(err),
        });
        if (job.type === "generate_summary") {
          try {
            const payload = JSON.parse(job.payload_json);
            if (payload.summaryId) {
              db.prepare(
                `UPDATE summaries SET status = 'failed' WHERE id = ?`
              ).run(payload.summaryId);
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
  } finally {
    processing = false;
  }
}

async function runIngestJob(job) {
  const payload = JSON.parse(job.payload_json);
  const { documentId, patientId } = payload;
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(documentId);
  if (!doc) throw new Error("Document not found");

  updateJob(job.id, { progress: 0.1 });
  db.prepare(
    `UPDATE documents SET status = 'extracting', updated_at = datetime('now') WHERE id = ?`
  ).run(documentId);

  const { pageCount, pages } = await extractPagesFromPdf(doc.storage_path);
  const totalChars = pages.reduce((n, p) => n + (p.text?.length || 0), 0);

  if (totalChars === 0) {
    db.prepare(
      `UPDATE documents SET status = 'needs_review', page_count = ?, char_count = 0,
       error_message = 'No extractable text (OCR not run).', updated_at = datetime('now') WHERE id = ?`
    ).run(pageCount, documentId);
    return;
  }

  updateJob(job.id, { progress: 0.35 });
  db.prepare(
    `UPDATE documents SET status = 'indexing', page_count = ?, char_count = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(pageCount, totalChars, documentId);

  db.prepare("DELETE FROM chunks WHERE document_id = ?").run(documentId);
  const chunks = chunkPages(pages, documentId);
  const insert = db.prepare(
    `INSERT INTO chunks (id, document_id, page_num, section_heading, text, char_start, char_end)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const c of chunks) {
    insert.run(
      c.id,
      c.documentId,
      c.pageNum,
      c.sectionHeading,
      c.text,
      c.charStart,
      c.charEnd
    );
  }

  await deleteDocumentVectors(patientId, documentId);
  updateJob(job.id, { progress: 0.6 });
  try {
    await upsertChunks(patientId, chunks, {
      [documentId]: { filename: doc.filename },
    });
  } catch (err) {
    console.error("Vector indexing unavailable:", err.message);
  }

  db.prepare(
    `UPDATE documents SET status = 'ready', error_message = NULL, updated_at = datetime('now') WHERE id = ?`
  ).run(documentId);
  updateJob(job.id, {
    progress: 1,
    result_json: JSON.stringify({ documentId, chunkCount: chunks.length }),
  });
}
