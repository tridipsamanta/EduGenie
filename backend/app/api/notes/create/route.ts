import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { getNotesUserId } from "@/lib/auth";

type CreateNotePayload = {
  title?: string;
  content?: string;
  sourceType?: "manual" | "ai" | "url" | "youtube" | "handwritten";
  summary?: string;
  tags?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const userId = await getNotesUserId();
    const body = (await request.json()) as CreateNotePayload;

    const title = String(body?.title || "").trim();
    const content = String(body?.content || "").trim();
    const sourceType = body?.sourceType || "manual";

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    await connectDB();

    const now = new Date();
    const insertResult = await Note.collection.insertOne({
      userId,
      title,
      content,
      sourceType,
      summary: String(body?.summary || content.slice(0, 200)),
      tags: Array.isArray(body?.tags) ? body.tags : [],
      sourceLink: "",
      createdAt: now,
      updatedAt: now,
    });

    const note = await Note.findById(insertResult.insertedId).lean();

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Failed to create note via /api/notes/create:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
