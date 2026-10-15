import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import documentsRouter from "./routes/documents.js";
import summariesRouter from "./routes/summaries.js";
import jobsRouter from "./routes/jobs.js";
import conversationsRouter from "./routes/conversations.js";
import metaRouter from "./routes/meta.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.use("/api", metaRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/summaries", summariesRouter);
  app.use("/api/jobs", jobsRouter);
  app.use("/api/conversations", conversationsRouter);

  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err) next();
    });
  });

  app.use((err, _req, res, _next) => {
    res.status(500).json({
      error: { message: err.message || "Server error." },
    });
  });

  return app;
}
