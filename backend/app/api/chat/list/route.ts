import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import { getNotesUserId, NOTES_GUEST_USER_ID } from "@/lib/auth";

function getConversationOwnerFilter(userId: string) {
  if (userId === NOTES_GUEST_USER_ID) {
    return { $or: [{ userId }, { userId: { $exists: false } }] };
  }
  return { userId };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getNotesUserId();
    const ownerFilter = getConversationOwnerFilter(userId);

    await connectDB();

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const rawLimit = Number(searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 50;

    let filter: Record<string, unknown> = { ...ownerFilter };
    if (query) {
      const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safeQuery, "i");
      const ownedConversationIds = await Conversation.find(ownerFilter)
        .select({ _id: 1 })
        .lean();
      const ownedIds = ownedConversationIds.map((conversation) => conversation._id);

      const messageConversationIds =
        ownedIds.length > 0
          ? await Message.find({ conversationId: { $in: ownedIds }, content: regex }).distinct(
              "conversationId"
            )
          : [];

      filter = {
        $and: [ownerFilter, { $or: [{ title: regex }, { _id: { $in: messageConversationIds } }] }],
      };
    }

    const conversations = await Conversation.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const enriched = await Promise.all(
      conversations.map(async (conversation) => {
        const lastMessage = await Message.findOne({
          conversationId: conversation._id,
        })
          .sort({ createdAt: -1 })
          .lean();

        return {
          ...conversation,
          lastMessage,
        };
      })
    );

    return NextResponse.json({ conversations: enriched });
  } catch (error) {
    console.error("Chat list error:", error);
    return NextResponse.json({ error: "Failed to load conversations." }, { status: 500 });
  }
}
