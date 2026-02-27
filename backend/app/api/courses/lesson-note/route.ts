import { and, eq, inArray } from "drizzle-orm";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { getCoursesUserId } from "@/lib/auth";
import { GROQ_API_BASE, MODEL_NAME } from "@/lib/ai-config";
import { db } from "@/lib/db";
import connectDB from "@/lib/mongodb";
import { chapters, courses, lessons } from "@/lib/schema";
import { Course } from "@/models/Course";
import { CourseChapter } from "@/models/CourseChapter";
import { CourseLesson } from "@/models/CourseLesson";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.GROCK_API_KEY;

type LessonContext = {
  courseName: string;
  courseLevel: string;
  courseDuration: string;
  lessonId: string;
  lessonTitle: string;
  youtubeVideoId: string;
};

async function fetchYoutubeContext(videoId: string): Promise<{
  title: string;
  description: string;
  channelTitle: string;
  tags: string[];
} | null> {
  if (!YOUTUBE_API_KEY) return null;

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", YOUTUBE_API_KEY);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    items?: Array<{
      snippet?: {
        title?: string;
        description?: string;
        channelTitle?: string;
        tags?: string[];
      };
    }>;
  };

  const snippet = data.items?.[0]?.snippet;
  if (!snippet) return null;

  return {
    title: snippet.title || "",
    description: (snippet.description || "").slice(0, 1500),
    channelTitle: snippet.channelTitle || "",
    tags: (snippet.tags || []).slice(0, 12),
  };
}

function buildPrompt(context: LessonContext, youtubeContext: Awaited<ReturnType<typeof fetchYoutubeContext>>): string {
  return `You are an expert educational content creator and course tutor with deep knowledge across all subjects.

Generate comprehensive, detailed, and well-structured study notes in markdown format based on the video topic.

**IMPORTANT**: Generate FULL DETAILED NOTES about the actual subject matter and concepts, NOT just a summary of video sections. Create educational content as if teaching the topic comprehensively.

Return markdown only with rich formatting.

Required structure:

# 📚 ${context.lessonTitle}

> **Course**: ${context.courseName} | **Level**: ${context.courseLevel}

---

## 🎯 Learning Objectives

List 5-7 specific learning outcomes students will achieve.

---

## 📖 Introduction

Provide a comprehensive 2-3 paragraph introduction explaining what this topic is about, why it's important, and real-world applications.

---

## 🧠 Core Concepts

### Concept 1: [Name]
**Definition**: Clear explanation

**Key Points**:
- Detailed point 1
- Detailed point 2

**Example**: Practical example with code/formula if applicable

(Include 3-5 major concepts with detailed explanations)

---

## 📝 Detailed Explanation

Provide in-depth explanation of the topic with:
- Multiple paragraphs of detailed content
- Step-by-step breakdowns
- Formulas, code snippets, or diagrams in markdown
- Comparisons and contrasts

---

## 💡 Practical Examples

### Example 1: [Scenario]
\`\`\`
[Code/Formula/Example]
\`\`\`
**Explanation**: Detailed walkthrough

(Include 2-3 comprehensive examples)

---

## ⚡ Key Takeaways

- **Main Point 1**: Detailed explanation
- **Main Point 2**: Detailed explanation
(5-7 major takeaways)

---

## 📌 Important Terms & Definitions

| Term | Definition |
|------|------------|
| **Term 1** | Clear definition |
| **Term 2** | Clear definition |

---

## ⚠️ Common Mistakes & Pitfalls

1. **Mistake**: Description
   - **Why it happens**: Explanation
   - **How to avoid**: Solution

---

## 🎓 Practice Questions

### Question 1: [Easy]
**Q**: Detailed question
**A**: Comprehensive answer

(Include 5 questions: 2 easy, 2 medium, 1 hard)

---

## ✅ Quick Revision Checklist

- [ ] Concept 1 understood
- [ ] Can explain concept 2
- [ ] Completed practice questions

Context:
- Course: ${context.courseName}
- Level: ${context.courseLevel}
- Lesson: ${context.lessonTitle}
- Video: ${youtubeContext?.title || "N/A"}
- Channel: ${youtubeContext?.channelTitle || "N/A"}
- Tags: ${(youtubeContext?.tags || []).join(", ") || "N/A"}
- Description: ${youtubeContext?.description || "N/A"}

Rules:
- Generate DETAILED educational content about the actual subject
- Use emojis for section headers
- Include code blocks, tables, formulas where relevant
- Make it comprehensive - aim for 1200+ words
- Use **bold** for emphasis, *italics* for terms
- Use > blockquotes for important notes
- Do NOT just list video timestamps
- Write as if teaching the full topic`;
}

async function generateWithOpenAI(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL_NAME || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You write comprehensive, detailed, high-quality educational markdown notes with rich formatting." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 3500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned empty note output");
  }

  return text;
}

async function generateWithGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 4000,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini failed with status ${response.status}`);
  }

  const data = (await response.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Gemini returned empty note output");
  }

  return text;
}

async function generateWithGroq(prompt: string): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL_NAME || MODEL_NAME,
      messages: [
        { role: "system", content: "You write comprehensive, detailed, high-quality educational markdown notes with rich formatting." },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 3500,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Groq returned empty note output");
  }

  return text;
}

async function generateLessonNote(prompt: string): Promise<string> {
  try {
    return await generateWithOpenAI(prompt);
  } catch (openAiError) {
    try {
      return await generateWithGemini(prompt);
    } catch (geminiError) {
      try {
        return await generateWithGroq(prompt);
      } catch (groqError) {
        const openAiMessage = openAiError instanceof Error ? openAiError.message : String(openAiError);
        const geminiMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
        const groqMessage = groqError instanceof Error ? groqError.message : String(groqError);
        throw new Error(
          `Failed to generate lesson note. OpenAI: ${openAiMessage}. Gemini: ${geminiMessage}. Groq: ${groqMessage}`
        );
      }
    }
  }
}

function buildFallbackNote(
  context: LessonContext,
  youtubeContext: Awaited<ReturnType<typeof fetchYoutubeContext>>
): string {
  const topTags = (youtubeContext?.tags || []).slice(0, 5);
  const shortDescription = (youtubeContext?.description || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  return `# ${context.lessonTitle}

## What This Lesson Covers
- Course: **${context.courseName}**
- Level: **${context.courseLevel}**
- Duration target: **${context.courseDuration}**
- Video lesson focus: **${youtubeContext?.title || context.lessonTitle}**

## Core Concepts
- This lesson introduces important ideas needed to progress in the course.
- Focus on understanding the definitions, workflow, and practical usage.
- Rewatch difficult segments and pause to summarize each section in your own words.

## Step-by-Step Breakdown
1. Start with the lesson objective and key terms.
2. Follow the demonstration or explanation sequence shown in the video.
3. Repeat the same flow once on your own.
4. Note down what you can apply in a mini practice task.

## Important Terms
- **Lesson objective**: The primary skill or concept taught in this video.
- **Implementation flow**: The order of steps used to solve the task.
- **Revision checkpoint**: A quick self-test after completing the lesson.

## Quick Revision
- Summarize the lesson in 5-7 lines.
- List 3 key concepts and where each one is used.
- Write one common mistake and how to avoid it.
- Revisit examples from the video before moving to next lesson.
- Practice once without looking at the lesson.

## Practice Questions
1. What is the main objective of this lesson?
   - **Answer:** To understand and apply the core concept demonstrated in the video.
2. Which step in the lesson flow was most critical, and why?
   - **Answer:** The implementation step, because it connects theory to practical usage.
3. How would you explain this topic to a beginner in simple words?
   - **Answer:** Use a short definition, one example, and one practical use case.

## Video Metadata
- Channel: **${youtubeContext?.channelTitle || "Unknown"}**
- YouTube Video ID: **${context.youtubeVideoId}**
${topTags.length > 0 ? `- Tags: **${topTags.join(", ")}**` : "- Tags: **Not available**"}

${shortDescription.length > 0 ? `## Extracted Description Highlights\n${shortDescription.map((line) => `- ${line}`).join("\n")}` : ""}`;
}

function toSafeUserError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/429|quota|rate|limit|RESOURCE_EXHAUSTED|insufficient_quota/i.test(message)) {
    return "AI providers are currently rate-limited. Generated a structured fallback note from lesson metadata.";
  }
  return "AI generation is temporarily unavailable. Generated a structured fallback note from lesson metadata.";
}

async function getLessonContext(userId: string, courseId: string, lessonId: string): Promise<LessonContext | null> {
  try {
    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
      .limit(1);

    if (!course) return null;

    const courseChapters = await db
      .select()
      .from(chapters)
      .where(eq(chapters.courseId, course.id));

    const chapterIds = courseChapters.map((chapter) => chapter.id);
    if (chapterIds.length === 0) return null;

    const [lesson] = await db
      .select()
      .from(lessons)
      .where(and(eq(lessons.id, lessonId), inArray(lessons.chapterId, chapterIds)))
      .limit(1);

    if (!lesson) return null;

    return {
      courseName: course.name,
      courseLevel: course.level,
      courseDuration: course.duration,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      youtubeVideoId: lesson.youtubeVideoId,
    };
  } catch {
    if (!isValidObjectId(courseId) || !isValidObjectId(lessonId)) {
      return null;
    }

    await connectDB();

    const course = await Course.findOne({ _id: courseId, userId }).lean();
    if (!course) return null;

    const courseChapters = await CourseChapter.find({ courseId: course._id }).lean();
    const chapterIds = courseChapters.map((chapter) => chapter._id);

    const lesson = await CourseLesson.findOne({
      _id: lessonId,
      chapterId: { $in: chapterIds },
    }).lean();

    if (!lesson) return null;

    return {
      courseName: course.name,
      courseLevel: course.level,
      courseDuration: course.duration,
      lessonId: String(lesson._id),
      lessonTitle: lesson.title,
      youtubeVideoId: lesson.youtubeVideoId,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCoursesUserId();
    const body = (await request.json()) as {
      courseId?: string;
      lessonId?: string;
    };

    if (!body.courseId || !body.lessonId) {
      return NextResponse.json({ error: "courseId and lessonId are required" }, { status: 400 });
    }

    const lessonContext = await getLessonContext(userId, body.courseId, body.lessonId);
    if (!lessonContext) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const youtubeContext = await fetchYoutubeContext(lessonContext.youtubeVideoId);
    const prompt = buildPrompt(lessonContext, youtubeContext);

    let noteMarkdown = "";
    let usedFallback = false;
    let warning: string | undefined;

    try {
      noteMarkdown = await generateLessonNote(prompt);
    } catch (generationError) {
      usedFallback = true;
      warning = toSafeUserError(generationError);
      noteMarkdown = buildFallbackNote(lessonContext, youtubeContext);
    }

    return NextResponse.json({
      lesson: {
        id: lessonContext.lessonId,
        title: lessonContext.lessonTitle,
        youtubeVideoId: lessonContext.youtubeVideoId,
      },
      noteMarkdown,
      usedFallback,
      warning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate lesson note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
