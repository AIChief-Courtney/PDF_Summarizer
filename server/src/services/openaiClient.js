import OpenAI from "openai";

let client = null;
let clientKey = null;

export function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!client || clientKey !== apiKey) {
    client = new OpenAI({ apiKey, timeout: 120_000 });
    clientKey = apiKey;
  }
  return client;
}

export function aiUnavailableMessage() {
  return "AI services are unavailable. Set OPENAI_API_KEY on the server.";
}
