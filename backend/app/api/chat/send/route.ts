import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import {
  buildContents,
  generateAssistantResponse,
  generateTitleFromPrompt,
} from "@/lib/chat";
import { isValidObjectId } from "mongoose";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const createOnly = Boolean(body?.createOnly);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const conversationId =
      typeof body?.conversationId === "string" ? body.conversationId : undefined;

    if (conversationId && !isValidObjectId(conversationId)) {
      return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
    }

    if (createOnly) {
      const conversation = await Conversation.create({ title: "New Chat" });
      return NextResponse.json({
        conversationId: conversation._id,
        title: conversation.title,
      });
    }

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    let conversation = conversationId
      ? await Conversation.findById(conversationId)
      : await Conversation.create({ title: "New Chat" });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    await Message.create({
      conversationId: conversation._id,
      role: "user",
      content: message,
    });

    const recentMessages = await Message.find({
      conversationId: conversation._id,
    })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    const orderedMessages = [...recentMessages].reverse();
    const contents = buildContents(orderedMessages);
    const reply = await generateAssistantResponse(contents);

    await Message.create({
      conversationId: conversation._id,
      role: "assistant",
      content: reply,
    });

    const userCount = await Message.countDocuments({
      conversationId: conversation._id,
      role: "user",
    });

    if (conversation.title === "New Chat" && userCount === 1) {
      try {
        const title = await generateTitleFromPrompt(message);
        const updated = await Conversation.findByIdAndUpdate(
          conversation._id,
          { title },
          { new: true }
        );
        conversation = updated ?? conversation;
      } catch (titleError) {
        console.warn("Chat title generation failed (non-blocking):", titleError);
      }
    }

    return NextResponse.json({
      conversationId: conversation._id,
      title: conversation.title,
      reply,
    });
  } catch (error) {
    console.error("Chat send error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const isAiError = /api key|grok|groq|model|rate|quota/i.test(message);
    return NextResponse.json(
      { error: isAiError ? "AI service unavailable. Please try again." : "Failed to send message." },
      { status: isAiError ? 503 : 500 }
    );
  }
}
