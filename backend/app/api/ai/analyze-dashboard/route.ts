import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

type AnalyzeDashboardRequest = {
  totalCourses: number;
  totalNotes: number;
  avgScore: number;
  weakTopics: string[];
  strongTopics: string[];
  studyTime: number;
  recentActivity: Array<{ type?: string; title?: string; at?: string }>;
};

type AnalyzeDashboardResponse = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendedFocus: string[];
  nextGoal: string;
  motivationalMessage: string;
};

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function coerceResponse(data: unknown): AnalyzeDashboardResponse {
  const parsed = (data || {}) as Partial<AnalyzeDashboardResponse>;
  return {
    summary: String(parsed.summary || "You're building steady momentum with consistent learning activity.").trim(),
    strengths: safeArray(parsed.strengths).slice(0, 5),
    weaknesses: safeArray(parsed.weaknesses).slice(0, 5),
    recommendedFocus: safeArray(parsed.recommendedFocus).slice(0, 5),
    nextGoal: String(parsed.nextGoal || "Complete one focused practice block and review weak areas.").trim(),
    motivationalMessage: String(parsed.motivationalMessage || "Small daily wins compound into big mastery. Keep going.").trim(),
  };
}

function extractJSONObject(raw: string): string {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return cleaned.slice(start, end + 1);
  }

  return cleaned;
}

function getFallbackInsights(payload: AnalyzeDashboardRequest): AnalyzeDashboardResponse {
  const score = Number(payload.avgScore || 0);
  const target = Math.max(70, Math.min(90, Math.round(score + 10)));
  const weak = payload.weakTopics?.slice(0, 3) || [];
  const strong = payload.strongTopics?.slice(0, 3) || [];

  return {
    summary: `You have ${payload.totalCourses || 0} courses and ${payload.totalNotes || 0} notes with an average score of ${Math.round(score)}%. Your trajectory is improving with consistent effort.`,
    strengths: strong.length ? strong : ["Concept retention", "Learning consistency"],
    weaknesses: weak.length ? weak : ["Timed practice", "Revision depth"],
    recommendedFocus: [
      weak[0] ? `Revise ${weak[0]} with short notes and 10 MCQs` : "Run one targeted weak-topic MCQ set",
      "Do a 25-minute deep-study block on your current course",
      "End the day with a 5-minute recap summary",
    ],
    nextGoal: `Reach ${target}% average score in the next focused cycle.`,
    motivationalMessage: "Your consistency is your superpower—keep stacking focused sessions.",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeDashboardRequest;

    const payload: AnalyzeDashboardRequest = {
      totalCourses: Number(body?.totalCourses || 0),
      totalNotes: Number(body?.totalNotes || 0),
      avgScore: Number(body?.avgScore || 0),
      weakTopics: safeArray(body?.weakTopics),
      strongTopics: safeArray(body?.strongTopics),
      studyTime: Number(body?.studyTime || 0),
      recentActivity: Array.isArray(body?.recentActivity) ? body.recentActivity : [],
    };

    const apiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.GROCK_API_KEY;

    if (!apiKey) {
      return NextResponse.json(getFallbackInsights(payload));
    }

    const groq = new Groq({ apiKey });

    const prompt = `You are an AI learning analytics assistant. Analyze this dashboard payload and return ONLY strict JSON with keys:
summary, strengths, weaknesses, recommendedFocus, nextGoal, motivationalMessage.

Constraints:
- strengths/weaknesses/recommendedFocus must be arrays of short strings.
- summary and motivationalMessage should be concise and premium tone.
- No markdown, no extra keys, no prose outside JSON.

Dashboard payload:\n${JSON.stringify(payload)}`;

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices?.[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(extractJSONObject(text));
      return NextResponse.json(coerceResponse(parsed));
    } catch {
      return NextResponse.json(getFallbackInsights(payload));
    }
  } catch (error) {
    console.error("AI dashboard analysis error:", error);
    return NextResponse.json({ error: "Failed to analyze dashboard" }, { status: 500 });
  }
}
