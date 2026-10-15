import { Router } from "express";
import { v4 as uuid } from "uuid";
import { db } from "../db.js";
import { attachContext } from "../middleware/context.js";
import { buildChatSystemPrompt } from "../prompts/medical.js";
import { getOpenAI, aiUnavailableMessage } from "../services/openaiClient.js";
import { retrieveChunks } from "../services/vectorStore.js";
import { searchMedicalWeb } from "../services/webSearch.js";

const router = Router();
router.use(attachContext);

router.post("/", (req, res) => {
  const id = uuid();
  const scope = req.body.scope || {};
  const sourceMode = req.body.sourceMode || "documents";
  db.prepare(
    `INSERT INTO conversations (id, patient_id, summary_id, scope_json, source_mode)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    id,
    req.context.patientId,
    req.body.summaryId || null,
    JSON.stringify(scope),
    sourceMode
  );
  res.status(201).json({ conversationId: id });
});

router.post("/:id/messages", async (req, res) => {
  try {
  const openai = getOpenAI();
  if (!openai) {
    res.status(503).json({ error: { message: aiUnavailableMessage() } });
    return;
  }

  const conv = db
    .prepare("SELECT * FROM conversations WHERE id = ? AND patient_id = ?")
    .get(req.params.id, req.context.patientId);
  if (!conv) {
    res.status(404).json({ error: { message: "Conversation not found." } });
    return;
  }

  const userText = (req.body.content || "").trim();
  if (!userText) {
    res.status(400).json({ error: { message: "Message content required." } });
    return;
  }

  const scope = JSON.parse(conv.scope_json || "{}");
  const documentIds = scope.documentIds || [];
  const history = db
    .prepare(
      "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at"
    )
    .all(conv.id);

  const chunks = await retrieveChunks(req.context.patientId, userText, {
    documentIds,
    limit: 16,
  });

  let webPack = null;
  if (conv.source_mode === "documents_web") {
    webPack = await searchMedicalWeb(userText);
  }

  const docs = db
    .prepare("SELECT id, filename FROM documents WHERE patient_id = ?")
    .all(req.context.patientId);
  const nameById = Object.fromEntries(docs.map((d) => [d.id, d.filename]));

  const evidence = chunks
    .map(
      (c) =>
        `[${nameById[c.metadata.documentId] || c.metadata.documentId} p.${c.metadata.pageNum}] ${c.text}`
    )
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: buildChatSystemPrompt(conv.source_mode) },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user",
        content: `Question: ${userText}\n\nDocument excerpts:\n${evidence || "NONE"}\n\nWeb pack:\n${webPack?.available ? JSON.stringify(webPack.results) : webPack?.reason || "disabled"}`,
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  let parsed;
  try {
    parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
  } catch {
    parsed = {
      answerSections: {
        documentFindings: completion.choices?.[0]?.message?.content || "",
        webContext: null,
        missingOrUncertain: "",
      },
      sources: { documents: [], web: [] },
      usedWeb: false,
    };
  }

  const msgId = uuid();
  const assistantText = [
    parsed.answerSections?.documentFindings,
    parsed.answerSections?.webContext
      ? `\n\nGeneral web context:\n${parsed.answerSections.webContext}`
      : "",
    parsed.answerSections?.missingOrUncertain
      ? `\n\nMissing/uncertain:\n${parsed.answerSections.missingOrUncertain}`
      : "",
  ].join("");

  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)`
  ).run(uuid(), conv.id, userText);
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, sources_json) VALUES (?, ?, 'assistant', ?, ?)`
  ).run(msgId, conv.id, assistantText, JSON.stringify(parsed.sources || {}));

  res.json({
    message: {
      id: msgId,
      role: "assistant",
      content: assistantText,
      sources: parsed.sources,
      usedWeb: parsed.usedWeb || conv.source_mode === "documents_web",
      structured: parsed.answerSections,
    },
  });
  } catch (err) {
    const status = err?.status === 401 ? 503 : 500;
    const message =
      err?.status === 401
        ? "OpenAI rejected the API key. Update OPENAI_API_KEY on the server."
        : err?.message || "Chat request failed.";
    res.status(status).json({ error: { message } });
  }
});

export default router;
