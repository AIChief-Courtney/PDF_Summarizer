import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "./env.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir =
  process.env.DATA_DIR?.trim() ||
  (process.env.VERCEL
    ? path.join("/tmp", "clinical-docs-rag")
    : path.resolve(__dirname, "../../data"));
const dbPath = path.join(dataDir, "app.db");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });

const globalKey = "__clinical_docs_sqlite__";
function openDatabase() {
  if (globalThis[globalKey]) return globalThis[globalKey];
  const instance = new Database(dbPath);
  instance.pragma(process.env.VERCEL ? "journal_mode = DELETE" : "journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  globalThis[globalKey] = instance;
  return instance;
}

export const db = openDatabase();

if (!globalThis.__clinical_docs_schema__) {
  globalThis.__clinical_docs_schema__ = true;

db.exec(`
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  categories_json TEXT NOT NULL DEFAULT '[]',
  subcategories_json TEXT NOT NULL DEFAULT '[]',
  clinical_date TEXT,
  page_count INTEGER,
  char_count INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_num INTEGER NOT NULL,
  section_heading TEXT,
  text TEXT NOT NULL,
  char_start INTEGER,
  char_end INTEGER
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress REAL NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  result_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  title TEXT NOT NULL,
  config_json TEXT NOT NULL,
  output_json TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  job_id TEXT REFERENCES jobs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  summary_id TEXT REFERENCES summaries(id),
  scope_json TEXT NOT NULL,
  source_mode TEXT NOT NULL DEFAULT 'documents',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const workspace = db
  .prepare("SELECT id FROM workspaces WHERE id = ?")
  .get("default-workspace");
if (!workspace) {
  db.prepare("INSERT INTO workspaces (id, name) VALUES (?, ?)").run(
    "default-workspace",
    "Default workspace"
  );
  db.prepare(
    "INSERT INTO patients (id, workspace_id, display_name) VALUES (?, ?, ?)"
  ).run("default-patient", "default-workspace", "Primary patient record");
}
}

export function getDefaultContext() {
  return {
    workspaceId: "default-workspace",
    patientId: "default-patient",
  };
}
