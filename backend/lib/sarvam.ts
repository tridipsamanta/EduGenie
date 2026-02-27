type RecordLike = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordLike =>
  typeof value === "object" && value !== null;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const get = (obj: unknown, key: string): unknown =>
  isRecord(obj) ? obj[key] : undefined;

const pickFirstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) return normalized;
  }
  return undefined;
};

const baseUrl = (process.env.SARVAM_API_BASE || "https://api.sarvam.ai").replace(/\/$/, "");

export const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
export const SARVAM_CHAT_PATH = process.env.SARVAM_CHAT_PATH || "/v1/chat/completions";
export const SARVAM_STT_PATH = process.env.SARVAM_STT_PATH || "/v1/speech-to-text";
export const SARVAM_TTS_PATH = process.env.SARVAM_TTS_PATH || "/v1/text-to-speech";
export const SARVAM_TRANSLATE_PATH = process.env.SARVAM_TRANSLATE_PATH || "/v1/translate";
export const SARVAM_CHAT_MODEL = process.env.SARVAM_CHAT_MODEL || "sarvam-m";
export const SARVAM_TTS_VOICE = process.env.SARVAM_TTS_VOICE || "anushka";

if (!SARVAM_API_KEY) {
  console.warn("SARVAM_API_KEY is not set in environment variables.");
}

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export const buildSarvamUrl = (path: string) => `${baseUrl}${normalizePath(path)}`;

export const buildPathCandidates = (preferredPath: string, fallbackPaths: string[]) => {
  const merged = [preferredPath, ...fallbackPaths]
    .map((path) => normalizePath(path.trim()))
    .filter((path) => path.length > 1);

  return [...new Set(merged)];
};

export const assertSarvamConfigured = () => {
  if (!SARVAM_API_KEY) {
    throw new Error("SARVAM_API_KEY is not configured.");
  }
};

export const sarvamFetch = async (path: string, init: RequestInit) => {
  assertSarvamConfigured();

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${SARVAM_API_KEY}`);
  headers.set("api-subscription-key", SARVAM_API_KEY);
  headers.set("x-api-key", SARVAM_API_KEY);

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(buildSarvamUrl(path), {
    ...init,
    headers,
  });
};

export const readSarvamErrorMessage = async (response: Response) => {
  const raw = await response.text();

  try {
    const parsed: unknown = JSON.parse(raw);
    const message =
      asString(get(parsed, "message")) ||
      asString(get(parsed, "error")) ||
      asString(get(get(parsed, "error"), "message"));

    if (message) {
      return message;
    }
  } catch {
    // no-op
  }

  return raw || `Sarvam request failed (${response.status})`;
};

export const extractChatText = (payload: unknown): string | undefined => {
  const choices = get(payload, "choices");
  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0];
    const messageContent = get(get(firstChoice, "message"), "content");

    if (typeof messageContent === "string") {
      return messageContent;
    }

    if (Array.isArray(messageContent)) {
      const merged = messageContent
        .map((item) => asString(get(item, "text")) || (typeof item === "string" ? item : ""))
        .join("")
        .trim();
      if (merged) return merged;
    }
  }

  return (
    asString(get(payload, "text")) ||
    asString(get(payload, "response")) ||
    asString(get(payload, "output_text")) ||
    asString(get(get(payload, "data"), "text"))
  );
};

export const extractTranscriptText = (payload: unknown): string | undefined => {
  return (
    asString(get(payload, "transcript")) ||
    asString(get(payload, "text")) ||
    asString(get(payload, "output")) ||
    asString(get(get(payload, "data"), "transcript")) ||
    asString(get(get(payload, "data"), "text"))
  );
};

export const extractTranslatedText = (payload: unknown): string | undefined => {
  return (
    asString(get(payload, "translated_text")) ||
    asString(get(payload, "translation")) ||
    asString(get(payload, "text")) ||
    asString(get(get(payload, "data"), "translated_text")) ||
    asString(get(get(payload, "data"), "text"))
  );
};

export const extractBase64Audio = (payload: unknown): string | undefined => {
  const data = get(payload, "data");
  const output = get(payload, "output");
  const result = get(payload, "result");

  const audios = [get(payload, "audios"), get(data, "audios"), get(output, "audios")]
    .filter(Array.isArray)
    .flatMap((items) => items as unknown[]);

  const firstAudio = audios[0];
  const firstAudioString = typeof firstAudio === "string" ? firstAudio : undefined;

  const direct = pickFirstString(
    get(payload, "audio"),
    get(payload, "audio_base64"),
    get(payload, "base64"),
    get(payload, "audioContent"),
    get(payload, "audio_content"),
    get(data, "audio"),
    get(data, "audio_base64"),
    get(data, "audioContent"),
    get(data, "audio_content"),
    get(output, "audio"),
    get(output, "audio_base64"),
    get(output, "audioContent"),
    get(output, "audio_content"),
    get(result, "audio"),
    get(result, "audio_base64"),
    get(result, "audioContent"),
    get(result, "audio_content"),
    firstAudioString,
    get(firstAudio, "audio"),
    get(firstAudio, "audio_base64"),
    get(firstAudio, "base64"),
    get(firstAudio, "audioContent"),
    get(firstAudio, "audio_content"),
    get(firstAudio, "data"),
  );

  if (!direct) return undefined;

  if (direct.startsWith("data:")) {
    const parts = direct.split(",");
    return parts.length > 1 ? parts[1] : undefined;
  }

  return direct;
};

export const extractAudioUrl = (payload: unknown): string | undefined => {
  const data = get(payload, "data");
  const output = get(payload, "output");
  const result = get(payload, "result");

  const audios = [get(payload, "audios"), get(data, "audios"), get(output, "audios")]
    .filter(Array.isArray)
    .flatMap((items) => items as unknown[]);

  const firstAudio = audios[0];

  const url = pickFirstString(
    get(payload, "audio_url"),
    get(payload, "url"),
    get(data, "audio_url"),
    get(data, "url"),
    get(output, "audio_url"),
    get(output, "url"),
    get(result, "audio_url"),
    get(result, "url"),
    get(firstAudio, "audio_url"),
    get(firstAudio, "url"),
  );

  if (!url || !/^https?:\/\//i.test(url)) return undefined;
  return url;
};

export const decodeBase64ToUint8Array = (base64: string): Uint8Array => {
  const normalized = base64.replace(/\s/g, "");
  const binary = Buffer.from(normalized, "base64");
  return new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength);
};
