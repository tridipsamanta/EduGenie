import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { getNotesUserId } from "@/lib/auth";
import mongoose from "mongoose";

type Params = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const userId = await getNotesUserId();

    await connectDB();

    const note = await Note.findOne({
      _id: new mongoose.Types.ObjectId(params.id),
      userId,
    }).lean();

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Failed to fetch note:", error);
    return NextResponse.json({ error: "Failed to fetch note" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const userId = await getNotesUserId();

    await connectDB();

    const body = await request.json();
    const { title, content, tags } = body;

    const note = await Note.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(params.id),
        userId,
      },
      {
        title,
        content,
        tags,
      },
      { new: true }
    ).lean();

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Failed to update note:", error);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const userId = await getNotesUserId();

    await connectDB();

    const note = await Note.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(params.id),
      userId,
    }).lean();

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
