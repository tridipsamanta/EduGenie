import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Note } from "@/models/Note";
import { getNotesUserId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const userId = await getNotesUserId();

    await connectDB();

    const body = await request.json();
    const { query, limit = 10 } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const titleRegex = new RegExp(escapedQuery, "i");

    const finalResults = await Note.find({
      userId,
      title: titleRegex,
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      results: finalResults,
      count: finalResults.length,
    });
  } catch (error) {
    console.error("Failed to search notes:", error);
    return NextResponse.json({ error: "Failed to search notes" }, { status: 500 });
  }
}
