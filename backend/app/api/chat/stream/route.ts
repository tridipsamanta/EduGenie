import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import {
  buildContents,
  generateAssistantResponseStream,
  generateTitleFromPrompt,
} from "@/lib/chat";
import { isValidObjectId } from "mongoose";
import { getNotesUserId, NOTES_GUEST_USER_ID } from "@/lib/auth";

function getConversationOwnerFilter(userId: string) {
  if (userId === NOTES_GUEST_USER_ID) {
    return { $or: [{ userId }, { userId: { $exists: false } }] };
  }
  return { userId };
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getNotesUserId();
    const ownerFilter = getConversationOwnerFilter(userId);

    await connectDB();

    const body = await request.json();
    const regenerate = Boolean(body?.regenerate);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const conversationId =
      typeof body?.conversationId === "string" ? body.conversationId : undefined;

    if (conversationId && !isValidObjectId(conversationId)) {
      return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
    }

    if (!message && !regenerate) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    if (regenerate && !conversationId) {
      return NextResponse.json(
        { error: "Conversation ID required for regeneration." },
        { status: 400 }
      );
    }

    let conversation = conversationId
      ? await Conversation.findOne({ _id: conversationId, ...ownerFilter })
      : await Conversation.create({ title: "New Chat", userId });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    if (!conversation.userId) {
      conversation.userId = userId;
      await conversation.save();
    }

    let prompt = message;

    if (regenerate) {
      const lastUserMessage = await Message.findOne({
        conversationId: conversation._id,
        role: "user",
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!lastUserMessage) {
        return NextResponse.json(
          { error: "No user message to regenerate." },
          { status: 400 }
        );
      }

      await Message.findOneAndDelete({
        conversationId: conversation._id,
        role: "assistant",
      }).sort({ createdAt: -1 });

      prompt = lastUserMessage.content;
    } else {
      await Message.create({
        conversationId: conversation._id,
        role: "user",
        content: message,
      });
    }

    const recentMessages = await Message.find({
      conversationId: conversation._id,
    })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    const orderedMessages = [...recentMessages].reverse();
    const contents = buildContents(orderedMessages);
    const streamResult = await generateAssistantResponseStream(contents);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = "";
        try {
          for await (const chunk of streamResult) {
            const text = chunk.text ?? "";
            if (!text) continue;
            fullText += text;
            controller.enqueue(encoder.encode(text));
          }

          if (fullText.trim()) {
            await Message.create({
              conversationId: conversation._id,
              role: "assistant",
              content: fullText,
            });
          }

          const userCount = await Message.countDocuments({
            conversationId: conversation._id,
            role: "user",
          });

          if (conversation.title === "New Chat" && userCount === 1) {
            try {
              const title = await generateTitleFromPrompt(prompt);
              await Conversation.findOneAndUpdate(
                { _id: conversation._id, ...ownerFilter },
                { title }
              );
            } catch (titleError) {
              console.warn("Chat stream title generation failed (non-blocking):", titleError);
            }
          }

          controller.close();
        } catch (error) {
          console.error("Chat stream runtime error:", error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "x-conversation-id": conversation._id.toString(),
      },
    });
  } catch (error) {
    console.error("Chat stream setup error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const isAiError = /api key|grok|groq|model|rate|quota/i.test(message);
    return NextResponse.json(
      { error: isAiError ? "AI service unavailable. Please try again." : "Failed to start chat stream." },
      { status: isAiError ? 503 : 500 }
    );
  }
}
