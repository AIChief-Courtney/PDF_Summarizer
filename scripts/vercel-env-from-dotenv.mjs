import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const text = fs.readFileSync(envPath, "utf8");
const vars = ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_EMBED_MODEL"];

for (const name of vars) {
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) continue;
  const value = line.slice(name.length + 1).trim();
  if (!value) continue;
  const r = spawnSync(
    process.platform === "win32" ? "vercel.cmd" : "vercel",
    ["env", "add", name, "production", "--force"],
    { input: value, cwd: root, stdio: ["pipe", "inherit", "inherit"], shell: true }
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("Vercel production env updated for:", vars.join(", "));
