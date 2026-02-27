import { z } from "zod";
import { GROQ_API_BASE, MODEL_NAME } from "@/lib/ai-config";
import type { GeneratedCurriculum } from "@/lib/schema";

const GEMINI_API_KEYS = Array.from(
  new Set([process.env.GEMINI_API_KEY].filter(Boolean) as string[])
);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";

function getGroqApiKey(): string | undefined {
  return process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.GROCK_API_KEY;
}

const curriculumSchema = z.object({
  courseTitle: z.string().min(1),
  summary: z.string().min(1),
  chapters: z
    .array(
      z.object({
        title: z.string().min(1),
        summary: z.string().min(1),
        topics: z.array(z.string().min(1)).min(1),
      })
    )
    .min(1),
});

function stripCodeFence(value: string): string {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

async function callGemini(prompt: string): Promise<string> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  console.log("🔹 [Gemini] Starting API call with", GEMINI_API_KEYS.length, "key(s)");
  console.log("🔹 [Gemini] Using endpoint:", GEMINI_API_ENDPOINT);
  console.log("🔹 [Gemini] Key preview:", GEMINI_API_KEYS[0]?.slice(0, 10) + "...");

  let lastError = "Gemini request failed";

  for (const geminiKey of GEMINI_API_KEYS) {
    try {
      console.log("🔹 [Gemini] Attempting with key:", geminiKey.slice(0, 10) + "...");
      
      const response = await fetch(
        `${GEMINI_API_ENDPOINT}?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              topK: 20,
              topP: 0.9,
              maxOutputTokens: 4096,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      console.log("🔹 [Gemini] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ [Gemini] Error response:", response.status, errorText);
        lastError = `Gemini API error ${response.status}: ${errorText.substring(0, 200)}`;
        continue;
      }

      const data = (await response.json()) as any;
      console.log("🔹 [Gemini] Response structure:", {
        hasCandidates: !!data?.candidates,
        candidatesLength: data?.candidates?.length,
        hasContent: !!data?.candidates?.[0]?.content,
        hasText: !!data?.candidates?.[0]?.content?.parts?.[0]?.text,
      });

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.error("❌ [Gemini] Empty response from API:", JSON.stringify(data).substring(0, 200));
        lastError = "Gemini returned an empty response: " + JSON.stringify(data).substring(0, 300);
        continue;
      }

      console.log("✅ [Gemini] Successfully received response, length:", text.length);
      return text;
    } catch (error) {
      console.error("❌ [Gemini] Error during call:", error instanceof Error ? error.message : String(error));
      lastError = String(error instanceof Error ? error.message : error);
      continue;
    }
  }

  console.error("❌ [Gemini] All retry attempts failed. Last error:", lastError);
  throw new Error(lastError);
}

async function callOpenAI(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch(OPENAI_API_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL_NAME || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You generate clean JSON responses only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 2500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("OpenAI returned an empty response");
  }

  return text;
}

async function callGroq(prompt: string): Promise<string> {
  const groqKey = getGroqApiKey();
  if (!groqKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        {
          role: "system",
          content: "You generate clean JSON responses only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 2500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq request failed: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Groq returned an empty response");
  }

  return text;
}

export async function generateCourseCurriculum(input: {
  courseName: string;
  chapterCount: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  description: string;
}): Promise<GeneratedCurriculum> {
  const prompt = `You are an expert curriculum designer.

Generate a structured course outline.
Return JSON only.

Structure:
{
"courseTitle": "",
"summary": "",
"chapters": [
{
"title": "",
"summary": "",
"topics": ["", "", ""]
}
]
}

Rules:
- Align difficulty with level
- Match total duration
- Keep it practical
- Chapters must logically progress
- Make it structured like Udemy/Coursera
- Return raw JSON only

Input:
- Course Name: ${input.courseName}
- Number of Chapters: ${input.chapterCount}
- Level: ${input.level}
- Total Duration: ${input.duration}
- Course Description: ${input.description}`;

  let rawOutput: string;
  
  console.log("\n🎓 [Course Generation] Starting curriculum generation...");
  console.log("📝 Input:", { courseName: input.courseName, chapterCount: input.chapterCount, level: input.level });
  
  // Try OpenAI first
  try {
    console.log("🔄 [Course Gen] Attempting OpenAI...");
    rawOutput = await callOpenAI(prompt);
    console.log("✅ [Course Gen] Success with OpenAI! Response length:", rawOutput.length);
  } catch (openAiError) {
    const openAiMsg = openAiError instanceof Error ? openAiError.message : String(openAiError);
    console.warn("⚠️ [Course Gen] OpenAI failed:", openAiMsg.substring(0, 100));
    
    // Try Gemini
    try {
      console.log("🔄 [Course Gen] Attempting Gemini (fallback #1)...");
      rawOutput = await callGemini(prompt);
      console.log("✅ [Course Gen] Success with Gemini! Response length:", rawOutput.length);
    } catch (geminiError) {
      const geminiMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      console.warn("⚠️ [Course Gen] Gemini failed:", geminiMsg.substring(0, 100));
      
      // Try Groq
      const hasGroq = Boolean(getGroqApiKey());
      if (hasGroq) {
        try {
          console.log("🔄 [Course Gen] Attempting Groq (fallback #2)...");
          rawOutput = await callGroq(prompt);
          console.log("✅ [Course Gen] Success with Groq! Response length:", rawOutput.length);
        } catch (groqError) {
          const groqMsg = groqError instanceof Error ? groqError.message : String(groqError);
          console.error("❌ [Course Gen] All providers failed!");
          console.error("  OpenAI:", openAiMsg.substring(0, 150));
          console.error("  Gemini:", geminiMsg.substring(0, 150));
          console.error("  Groq:", groqMsg.substring(0, 150));
          throw new Error(`Course generation failed. All 3 AI providers failed. OpenAI: ${openAiMsg}. Gemini: ${geminiMsg}. Groq: ${groqMsg}`);
        }
      } else {
        console.error("❌ [Course Gen] Groq not configured! Only 2 providers available.");
        throw new Error(`Course generation failed. OpenAI: ${openAiMsg}. Gemini: ${geminiMsg}. Groq not configured.`);
      }
    }
  }

  console.log("🔍 [Course Gen] Parsing JSON response...");
  try {
    const parsed = JSON.parse(stripCodeFence(rawOutput));
    const curriculum = curriculumSchema.parse(parsed);
    console.log("✅ [Course Gen] Parsed successfully! Chapters:", curriculum.chapters.length);
    
    const limitedChapters = curriculum.chapters.slice(0, input.chapterCount);
    return {
      ...curriculum,
      courseTitle: curriculum.courseTitle || input.courseName,
      chapters: limitedChapters,
    };
  } catch (parseError) {
    console.error("❌ [Course Gen] Failed to parse response!");
    console.error("Response preview:", rawOutput.substring(0, 300));
    console.error("Parse error:", parseError instanceof Error ? parseError.message : String(parseError));
    throw new Error(`Failed to parse curriculum: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
}

type YoutubeVideoResult = {
  youtubeVideoId: string;
  title: string;
  thumbnail: string;
  duration: string;
};

function parseIsoDurationToSeconds(isoDuration: string): number {
  const matches = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!matches) {
    return 0;
  }

  const hours = Number(matches[1] ?? 0);
  const minutes = Number(matches[2] ?? 0);
  const seconds = Number(matches[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function toDurationLabel(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function rankYoutubeResult(viewCount: number, durationSeconds: number): number {
  const normalizedViews = Math.min(Math.log10(Math.max(viewCount, 1)), 8);
  const durationPenalty = durationSeconds < 300 ? 2 : 0;
  const durationBonus = durationSeconds >= 900 && durationSeconds <= 7200 ? 2 : 0;
  return normalizedViews + durationBonus - durationPenalty;
}

export async function fetchBestYoutubeLessons(
  topic: string,
  level: "Beginner" | "Intermediate" | "Advanced",
  limit = 2
): Promise<YoutubeVideoResult[]> {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY is not configured");
  }

  const query = `${topic} full tutorial ${level}`;
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "8");
  searchUrl.searchParams.set("order", "relevance");
  searchUrl.searchParams.set("key", YOUTUBE_API_KEY);

  const searchResponse = await fetch(searchUrl.toString(), { cache: "no-store" });
  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    throw new Error(`YouTube search failed: ${errorText}`);
  }

  const searchJson = (await searchResponse.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
      };
    }>;
  };

  const basicItems = (searchJson.items ?? [])
    .map((item) => ({
      youtubeVideoId: item.id?.videoId,
      title: item.snippet?.title,
      thumbnail:
        item.snippet?.thumbnails?.high?.url ??
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url,
    }))
    .filter(
      (item): item is { youtubeVideoId: string; title: string; thumbnail: string } =>
        Boolean(item.youtubeVideoId && item.title && item.thumbnail)
    );

  if (basicItems.length === 0) {
    return [];
  }

  const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  detailsUrl.searchParams.set("part", "contentDetails,statistics");
  detailsUrl.searchParams.set(
    "id",
    basicItems.map((item) => item.youtubeVideoId).join(",")
  );
  detailsUrl.searchParams.set("key", YOUTUBE_API_KEY);

  const detailsResponse = await fetch(detailsUrl.toString(), { cache: "no-store" });
  if (!detailsResponse.ok) {
    const errorText = await detailsResponse.text();
    throw new Error(`YouTube detail fetch failed: ${errorText}`);
  }

  const detailsJson = (await detailsResponse.json()) as {
    items?: Array<{
      id?: string;
      contentDetails?: { duration?: string };
      statistics?: { viewCount?: string };
    }>;
  };

  const detailMap = new Map(
    (detailsJson.items ?? [])
      .filter((item): item is { id: string; contentDetails?: { duration?: string }; statistics?: { viewCount?: string } } =>
        Boolean(item.id)
      )
      .map((item) => [item.id, item])
  );

  const ranked = basicItems
    .map((item) => {
      const details = detailMap.get(item.youtubeVideoId);
      const durationSeconds = parseIsoDurationToSeconds(details?.contentDetails?.duration ?? "PT0S");
      const viewCount = Number(details?.statistics?.viewCount ?? 0);
      return {
        ...item,
        durationSeconds,
        score: rankYoutubeResult(viewCount, durationSeconds),
      };
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map((item) => ({
      youtubeVideoId: item.youtubeVideoId,
      title: item.title,
      thumbnail: item.thumbnail,
      duration: toDurationLabel(item.durationSeconds),
    }));

  return ranked;
}

const learningAdviceSchema = z.object({
  advice: z.string().min(1),
  nextChapterFocus: z.string().min(1),
});

export async function generateLearningAdvice(input: {
  courseName: string;
  completedLessons: number;
  totalLessons: number;
  completionPercentage: number;
}): Promise<{ advice: string; nextChapterFocus: string }> {
  const prompt = `You are a learning coach.
Analyze the student's current progress and learning pace.

Return JSON only in this structure:
{
  "advice": "",
  "nextChapterFocus": ""
}

Data:
- Course: ${input.courseName}
- Completed Lessons: ${input.completedLessons}
- Total Lessons: ${input.totalLessons}
- Completion Percentage: ${input.completionPercentage.toFixed(2)}

Keep response practical and concise.`;

  const rawOutput = await callGemini(prompt);
  const parsed = JSON.parse(stripCodeFence(rawOutput));
  return learningAdviceSchema.parse(parsed);
}
