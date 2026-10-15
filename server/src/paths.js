import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Writable data root (SQLite, uploads). On Vercel only /tmp is writable. */
export function getDataDir() {
  if (process.env.DATA_DIR?.trim()) {
    return process.env.DATA_DIR.trim();
  }
  if (
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true" ||
    process.cwd().startsWith("/var/task")
  ) {
    return path.join("/tmp", "clinical-docs-rag");
  }
  return path.resolve(__dirname, "../../data");
}

export function getUploadDir() {
  return path.join(getDataDir(), "uploads");
}
