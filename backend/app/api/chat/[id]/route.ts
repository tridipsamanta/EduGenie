import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import { isValidObjectId } from "mongoose";
import { getNotesUserId, NOTES_GUEST_USER_ID } from "@/lib/auth";

function getConversationOwnerFilter(userId: string) {
  if (userId === NOTES_GUEST_USER_ID) {
    return { $or: [{ userId }, { userId: { $exists: false } }] };
  }
  return { userId };
}

interface Params {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const userId = await getNotesUserId();
    const ownerFilter = getConversationOwnerFilter(userId);

    if (!isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get("limit") ?? 30);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 30;
    const before = searchParams.get("before");

    const conversation = await Conversation.findOne({ _id: params.id, ...ownerFilter }).lean();
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const filter: Record<string, unknown> = { conversationId: params.id };
    if (before) {
      const beforeDate = new Date(before);
      if (!Number.isNaN(beforeDate.getTime())) {
        filter.createdAt = { $lt: beforeDate };
      }
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      conversation,
      messages: messages.reverse(),
    });
  } catch (error) {
    console.error("Chat conversation GET error:", error);
    return NextResponse.json({ error: "Failed to load conversation." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const userId = await getNotesUserId();
    const ownerFilter = getConversationOwnerFilter(userId);

    if (!isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: params.id, ...ownerFilter },
      { title },
      { new: true }
    ).lean();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("Chat conversation PATCH error:", error);
    return NextResponse.json({ error: "Failed to rename conversation." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const userId = await getNotesUserId();
    const ownerFilter = getConversationOwnerFilter(userId);

    if (!isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
    }

    await connectDB();
    const conversation = await Conversation.findOne({ _id: params.id, ...ownerFilter }).lean();

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    await Message.deleteMany({ conversationId: params.id });
    await Conversation.deleteOne({ _id: params.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Chat conversation DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete conversation." }, { status: 500 });
  }
}
