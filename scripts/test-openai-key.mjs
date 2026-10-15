import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envText = fs.readFileSync(path.join(root, ".env"), "utf8");
const key = envText
  .split(/\r?\n/)
  .find((l) => l.startsWith("OPENAI_API_KEY="))
  ?.slice("OPENAI_API_KEY=".length)
  .trim();

if (!key) {
  console.error("No OPENAI_API_KEY in .env");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: key });
try {
  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Reply with OK only." }],
    max_tokens: 5,
  });
  console.log("OK", r.choices[0]?.message?.content?.trim());
} catch (e) {
  console.error("FAIL", e.status || e.code, e.message);
  process.exit(1);
}
