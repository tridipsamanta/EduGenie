import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { HandwrittenNote } from "@/models/HandwrittenNote";
import mongoose from "mongoose";
import { getNotesUserId } from "@/lib/auth";

type SaveHandwrittenPayload = {
  topic: string;
  handwritingStyle: "Neat Student" | "Fast Notes" | "Exam Revision Style";
  markdownContent: string;
};

export async function GET(request: NextRequest) {
  try {
    const userId = await getNotesUserId();

    await connectDB();

    const items = await HandwrittenNote.collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ items });
  } catch (error) {
    console.error("List handwritten notes error:", error);
    return NextResponse.json({ error: "Failed to list handwritten notes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveHandwrittenPayload;
    const userId = await getNotesUserId();
    const topic = String(body?.topic || "").trim();
    const markdownContent = String(body?.markdownContent || "").trim();

    if (!topic || !markdownContent) {
      return NextResponse.json({ error: "topic and markdownContent are required" }, { status: 400 });
    }

    await connectDB();

    const now = new Date();
    const result = await HandwrittenNote.collection.insertOne({
      userId,
      topic,
      handwritingStyle: body.handwritingStyle,
      content: markdownContent,
      summary: markdownContent.slice(0, 200),
      createdAt: now,
      updatedAt: now,
    });

    const note = await HandwrittenNote.collection.findOne({ _id: result.insertedId });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Save handwritten note error:", error);
    return NextResponse.json({ error: "Failed to save handwritten note" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = String(request.nextUrl.searchParams.get("id") || "").trim();
    const userId = await getNotesUserId();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid id format" }, { status: 400 });
    }

    await connectDB();

    const deleted = await HandwrittenNote.findOneAndDelete({ _id: id, userId });

    if (!deleted) {
      return NextResponse.json({ error: "Handwritten note not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete handwritten note error:", error);
    return NextResponse.json({ error: "Failed to delete handwritten note" }, { status: 500 });
  }
}
