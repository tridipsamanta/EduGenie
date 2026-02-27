export const GROQ_API_KEY =
  process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.GROCK_API_KEY;

export const GROQ_API_BASE =
  process.env.GROQ_API_BASE || "https://api.groq.com/openai/v1";

export const MODEL_NAME =
  process.env.GROQ_MODEL || process.env.GROK_MODEL || "llama-3.3-70b-versatile";

if (!GROQ_API_KEY) {
  console.warn("GROQ_API_KEY is not set in environment variables.");
}
