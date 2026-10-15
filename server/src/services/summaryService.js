import { db } from "../db.js";
import { buildSummarySystemPrompt } from "../prompts/medical.js";
import { getOpenAI, aiUnavailableMessage } from "./openaiClient.js";
import {
  listAllChunksForDocuments,
  retrieveChunks,
} from "./vectorStore.js";
import { searchMedicalWeb } from "./webSearch.js";

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

export async function runSummaryJob(job) {
  const payload = JSON.parse(job.payload_json);
  const { summaryId, patientId, config } = payload;
  const openai = getOpenAI();
  if (!openai) throw new Error(aiUnavailableMessage());

  updateJob(job.id, { progress: 0.1 });
  db.prepare("UPDATE summaries SET status = 'running' WHERE id = ?").run(summaryId);

  const documentIds = config.documentIds || [];
  const docs = db
    .prepare(
      `SELECT * FROM documents WHERE patient_id = ? AND status = 'ready'`
    )
    .all(patientId)
    .filter((d) =>
      documentIds.length ? documentIds.includes(d.id) : true
    );

  const eligibleIds = docs.map((d) => d.id);
  const missing = documentIds.filter((id) => !eligibleIds.includes(id));

  let evidenceChunks = await listAllChunksForDocuments(patientId, eligibleIds);
  if (evidenceChunks.length === 0 && eligibleIds.length > 0) {
    for (const id of eligibleIds) {
      const rows = db
        .prepare("SELECT * FROM chunks WHERE document_id = ? ORDER BY page_num")
        .all(id);
      evidenceChunks.push(
        ...rows.map((r) => ({
          id: r.id,
          text: r.text,
          metadata: {
            documentId: r.document_id,
            pageNum: r.page_num,
            sectionHeading: r.section_heading || "",
          },
        }))
      );
    }
  }

  if (config.method !== "quick" && evidenceChunks.length > 80) {
    const retrieved = await retrieveChunks(
      patientId,
      config.customInstructions || config.method,
      { documentIds: eligibleIds, limit: 40 }
    );
    if (retrieved.length) evidenceChunks = retrieved;
  }

  updateJob(job.id, { progress: 0.45 });

  const contextBlocks = evidenceChunks
    .slice(0, 60)
    .map(
      (c) =>
        `[doc:${c.metadata.documentId} page:${c.metadata.pageNum}] ${c.text}`
    )
    .join("\n\n");

  let webPack = null;
  if (config.sourceMode === "documents_web") {
    webPack = await searchMedicalWeb(
      config.customInstructions || "clinical concept overview"
    );
  }

  const system = buildSummarySystemPrompt(config);
  const userContent = `Documents in scope: ${eligibleIds.join(", ") || "none"}
Missing/unready requested IDs: ${missing.join(", ") || "none"}

Extracted evidence excerpts:
${contextBlocks || "NO EXTRACTED TEXT AVAILABLE"}

${webPack?.available ? `General web references (NOT patient-specific):\n${JSON.stringify(webPack.results)}` : ""}`;

  updateJob(job.id, { progress: 0.7 });

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
    max_tokens: 2500,
  });

  const raw = completion.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      title: "Clinical summary",
      sections: [{ heading: "Summary", body: raw, citations: [] }],
      coverage: {
        documentsIncluded: eligibleIds,
        documentsMissing: missing,
        limitations: ["Model returned non-JSON; shown as plain text."],
      },
      ambiguities: [],
      pendingItems: [],
      webContext: null,
      citations: [],
    };
  }

  if (webPack && !webPack.available && config.sourceMode === "documents_web") {
    parsed.webContext = {
      heading: "Web context unavailable",
      body: webPack.reason,
      sources: [],
    };
  } else if (webPack?.available && !parsed.webContext) {
    parsed.webContext = {
      heading: "General medical context (web)",
      body: "See cited web sources below. Not patient-specific.",
      sources: webPack.results,
    };
  }

  const output = {
    ...parsed,
    generatedAt: new Date().toISOString(),
    scope: {
      patientId,
      documentIds: eligibleIds,
      requestedDocumentIds: documentIds,
      config,
    },
    documents: docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      clinicalDate: d.clinical_date,
      pageCount: d.page_count,
    })),
  };

  db.prepare(
    `UPDATE summaries SET status = 'completed', output_json = ?, title = ? WHERE id = ?`
  ).run(JSON.stringify(output), output.title || "Clinical summary", summaryId);

  updateJob(job.id, {
    progress: 1,
    result_json: JSON.stringify({ summaryId }),
  });
}
