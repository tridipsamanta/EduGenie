import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { getNotesUserId } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await getNotesUserId();

    await connectDB();

    const notes = await Note.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Failed to fetch notes:", error);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getNotesUserId();

    await connectDB();

    const body = await request.json();
    const { title, content, sourceType = "manual", sourceLink, tags = [] } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const note = new Note({
      userId,
      title,
      content,
      sourceType,
      sourceLink,
      tags,
    });

    await note.save();

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Failed to create note:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
