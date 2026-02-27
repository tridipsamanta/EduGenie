import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { topic, pageStyle, inkColor, writingTool, handwritingStyle } = await req.json();

    const safeTopic = String(topic || "").trim();
    if (!safeTopic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const prompt = [
      `Realistic handwritten study note on ${safeTopic}.`,
      `Written on ${pageStyle} notebook paper.`,
      `Ink color: ${inkColor}.`,
      `Writing tool: ${writingTool}.`,
      `Handwriting style: ${handwritingStyle}.`,
      "Include title, bullet points, small examples.",
      "Natural imperfections.",
      "Looks like scanned notebook photo.",
      "High resolution.",
      "No digital font.",
    ].join(" ");

    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=768&height=1024&nologo=true`;

    const probe = await fetch(imageUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!probe.ok) {
      return NextResponse.json(
        {
          error: "Image provider is temporarily unavailable.",
          action: "Try again later or switch to another image provider.",
          providerStatus: probe.status,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      imageUrl,
      imageUrls: [imageUrl],
      promptTemplate: prompt,
    });
  } catch (error) {
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
