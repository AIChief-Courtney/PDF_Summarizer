import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import summarizeRouter from "./routes/summarize.js";
import { errorResponse } from "./errors.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: "1kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/summarize", summarizeRouter);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.use((err, _req, res, _next) => {
  const { status, body } = errorResponse(err);
  res.status(status).json(body);
});

app.listen(port, () => {
  console.log(`PDF summarizer API listening on http://localhost:${port}`);
});
