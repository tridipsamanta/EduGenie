import { NextRequest, NextResponse } from "next/server";
import {
  SARVAM_TRANSLATE_PATH,
  extractTranslatedText,
  readSarvamErrorMessage,
  sarvamFetch,
} from "@/lib/sarvam";

const SUPPORTED_LANGUAGES = new Set(["en-IN", "hi-IN", "bn-IN"]);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
      sourceLanguage?: string;
      targetLanguage?: string;
    };

    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    const sourceLanguage =
      typeof body?.sourceLanguage === "string" && SUPPORTED_LANGUAGES.has(body.sourceLanguage)
        ? body.sourceLanguage
        : "en-IN";

    const targetLanguage =
      typeof body?.targetLanguage === "string" && SUPPORTED_LANGUAGES.has(body.targetLanguage)
        ? body.targetLanguage
        : "en-IN";

    const upstream = await sarvamFetch(SARVAM_TRANSLATE_PATH, {
      method: "POST",
      body: JSON.stringify({
        text,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        source_language_code: sourceLanguage,
        target_language_code: targetLanguage,
      }),
    });

    if (!upstream.ok) {
      const reason = await readSarvamErrorMessage(upstream);
      return NextResponse.json({ error: reason }, { status: upstream.status });
    }

    const payload = (await upstream.json()) as unknown;
    const translatedText = extractTranslatedText(payload);

    if (!translatedText) {
      return NextResponse.json(
        { error: "Sarvam translation response did not contain translated text." },
        { status: 502 },
      );
    }

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error("Voice assistant translate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to translate text." },
      { status: 500 },
    );
  }
}
