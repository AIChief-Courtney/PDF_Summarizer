import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadEnv() {
  const rootEnv = path.resolve(__dirname, "../../.env");
  const clientEnv = path.resolve(__dirname, "../../client/.env");
  dotenv.config({ path: rootEnv });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  dotenv.config({ path: clientEnv });
  if (!process.env.OPENAI_API_KEY?.trim() && process.env.VITE_OPENAI_API_KEY?.trim()) {
    process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY.trim();
  }
}
