import { NextRequest, NextResponse } from "next/server";
import {
  SARVAM_STT_PATH,
  buildPathCandidates,
  extractTranscriptText,
  readSarvamErrorMessage,
  sarvamFetch,
} from "@/lib/sarvam";

const SUPPORTED_LANGUAGES = new Set(["en-IN", "hi-IN", "bn-IN"]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio") || formData.get("file");
    const language = formData.get("language");

    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    }

    const languageCode =
      typeof language === "string" && SUPPORTED_LANGUAGES.has(language)
        ? language
        : "en-IN";

    const upstreamForm = new FormData();
    const createForm = () => {
      const form = new FormData();
      form.set("file", audio, "recording.webm");
      form.set("audio", audio, "recording.webm");
      form.set("language", languageCode);
      form.set("language_code", languageCode);
      return form;
    };

    const candidates = buildPathCandidates(SARVAM_STT_PATH, [
      "/speech-to-text",
      "/v1/speech-to-text",
      "/stt",
      "/v1/stt",
      "/speech-to-text-translate",
      "/v1/speech-to-text-translate",
    ]);

    let upstream: Response | null = null;
    for (const candidate of candidates) {
      const attempted = await sarvamFetch(candidate, {
        method: "POST",
        body: createForm(),
      });

      if (attempted.status === 404) {
        continue;
      }

      upstream = attempted;
      break;
    }

    if (!upstream) {
      return NextResponse.json(
        {
          error: `Sarvam STT endpoint not found. Tried: ${candidates.join(", ")}. Set SARVAM_STT_PATH to your exact endpoint.`,
        },
        { status: 502 },
      );
    }

    if (!upstream.ok) {
      const reason = await readSarvamErrorMessage(upstream);
      return NextResponse.json({ error: reason }, { status: upstream.status });
    }

    const payload = (await upstream.json()) as unknown;
    const transcript = extractTranscriptText(payload);

    if (!transcript) {
      return NextResponse.json(
        { error: "Sarvam STT response did not contain transcript text." },
        { status: 502 },
      );
    }

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("Voice assistant STT error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to transcribe voice with Sarvam.",
      },
      { status: 500 },
    );
  }
}
