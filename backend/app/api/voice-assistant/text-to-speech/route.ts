import { NextRequest, NextResponse } from "next/server";
import {
  SARVAM_TTS_PATH,
  SARVAM_TTS_VOICE,
  buildPathCandidates,
  decodeBase64ToUint8Array,
  extractAudioUrl,
  extractBase64Audio,
  readSarvamErrorMessage,
  sarvamFetch,
} from "@/lib/sarvam";

const SUPPORTED_LANGUAGES = new Set(["en-IN", "hi-IN", "bn-IN"]);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
      language?: string;
      voice?: string;
    };

    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    const language =
      typeof body?.language === "string" && SUPPORTED_LANGUAGES.has(body.language)
        ? body.language
        : "en-IN";
    const voice = typeof body?.voice === "string" && body.voice.trim() ? body.voice : SARVAM_TTS_VOICE;

    const requestBodyCandidates = [
      {
        text,
        language,
        language_code: language,
        target_language_code: language,
        voice,
        speaker: voice,
        format: "wav",
      },
      {
        input: text,
        language_code: language,
        target_language_code: language,
        speaker: voice,
        output_format: "wav",
      },
      {
        transcript: text,
        language_code: language,
        speaker: voice,
      },
      {
        text,
        model: "bulbul:v2",
        language_code: language,
        speaker: voice,
      },
    ];

    const candidates = buildPathCandidates(SARVAM_TTS_PATH, [
      "/text-to-speech",
      "/v1/text-to-speech",
      "/tts",
      "/v1/tts",
      "/speech/generate",
      "/v1/speech/generate",
    ]);

    let lastErrorMessage = "Sarvam TTS failed for all supported request formats.";
    let lastJsonPreview = "";

    for (const candidate of candidates) {
      for (const requestBody of requestBodyCandidates) {
        const attempted = await sarvamFetch(candidate, {
          method: "POST",
          body: JSON.stringify(requestBody),
        });

        if (attempted.status === 404) {
          continue;
        }

        if (!attempted.ok) {
          lastErrorMessage = await readSarvamErrorMessage(attempted);
          continue;
        }

        const contentType = attempted.headers.get("content-type") || "";
        if (contentType.includes("audio/")) {
          const audioBuffer = await attempted.arrayBuffer();
          return new NextResponse(audioBuffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "no-store",
            },
          });
        }

        const payload = (await attempted.json().catch(() => null)) as unknown;
        if (!payload) {
          continue;
        }

        const base64Audio = extractBase64Audio(payload);
        if (base64Audio) {
          const bytes = decodeBase64ToUint8Array(base64Audio);
          return new NextResponse(bytes, {
            status: 200,
            headers: {
              "Content-Type": "audio/wav",
              "Cache-Control": "no-store",
            },
          });
        }

        const audioUrl = extractAudioUrl(payload);
        if (audioUrl) {
          const audioResponse = await fetch(audioUrl);
          if (audioResponse.ok) {
            const audioBuffer = await audioResponse.arrayBuffer();
            const resolvedType = audioResponse.headers.get("content-type") || "audio/wav";
            return new NextResponse(audioBuffer, {
              status: 200,
              headers: {
                "Content-Type": resolvedType,
                "Cache-Control": "no-store",
              },
            });
          }
        }

        try {
          lastJsonPreview = JSON.stringify(payload).slice(0, 300);
        } catch {
          lastJsonPreview = "";
        }
      }
    }

    return NextResponse.json(
      {
        error:
          lastJsonPreview.length > 0
            ? `Sarvam TTS response did not include usable audio. Last payload preview: ${lastJsonPreview}`
            : lastErrorMessage,
      },
      { status: 502 },
    );
  } catch (error) {
    console.error("Voice assistant TTS error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate speech." },
      { status: 500 },
    );
  }
}
