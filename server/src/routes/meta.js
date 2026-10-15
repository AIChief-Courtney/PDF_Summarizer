import { Router } from "express";
import { DOCUMENT_CATEGORIES } from "../categories.js";
import { db } from "../db.js";
import { getOpenAI, aiUnavailableMessage } from "../services/openaiClient.js";
import { attachContext } from "../middleware/context.js";

const router = Router();

router.get("/health", async (req, res) => {
  const openai = getOpenAI();
  const body = {
    ok: true,
    ai: Boolean(openai),
    webSearch: Boolean(process.env.TAVILY_API_KEY?.trim()),
  };
  if (req.query.verifyAi === "1" && openai) {
    try {
      await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      });
      body.aiVerified = true;
    } catch (err) {
      body.aiVerified = false;
      body.aiError =
        err?.status === 401
          ? "OpenAI rejected the API key (invalid or revoked). Create a new key at platform.openai.com."
          : err?.message || "OpenAI request failed.";
    }
  }
  res.json(body);
});

router.get("/categories", (_req, res) => {
  res.json({ categories: DOCUMENT_CATEGORIES });
});

router.get("/workspace", attachContext, (req, res) => {
  const patients = db
    .prepare("SELECT id, display_name FROM patients WHERE workspace_id = ?")
    .all(req.context.workspaceId);
  res.json({
    workspaceId: req.context.workspaceId,
    patientId: req.context.patientId,
    patients,
    services: {
      ai: Boolean(getOpenAI()) ? "available" : aiUnavailableMessage(),
      web: process.env.TAVILY_API_KEY ? "available" : "unconfigured",
    },
  });
});

export default router;
