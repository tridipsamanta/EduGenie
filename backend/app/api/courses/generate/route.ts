import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCoursesUserId } from "@/lib/auth";
import { generateCourseCurriculum } from "@/lib/lms";

const requestSchema = z.object({
  courseName: z.string().min(3),
  chapterCount: z.number().int().min(1).max(30),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  duration: z.string().min(2),
  description: z.string().min(10),
});

export async function POST(request: NextRequest) {
  try {
    await getCoursesUserId();

    const body = await request.json();
    const payload = requestSchema.parse(body);

    const curriculum = await generateCourseCurriculum(payload);
    return NextResponse.json({ curriculum }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate curriculum";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
