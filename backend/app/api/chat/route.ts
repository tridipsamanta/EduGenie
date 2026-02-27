import { NextRequest, NextResponse } from "next/server";
import { askGemini } from "@/lib/gemini";

// CORS headers - allow all origins for now (can be restricted later)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight requests
export async function OPTIONS() {
  console.log("📋 Chat API - OPTIONS request (CORS preflight)");
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  console.log("📥 Chat API - POST request received");
  
  try {
    // 1. Parse request body
    const body = await request.json();
    const { message } = body;
    console.log("📝 Message received:", message?.substring(0, 60));

    // 2. Validate input
    if (!message) {
      console.warn("⚠️ No message provided");
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (typeof message !== "string") {
      console.warn("⚠️ Message is not a string");
      return NextResponse.json(
        { error: "Message must be a string" },
        { status: 400, headers: corsHeaders }
      );
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      console.warn("⚠️ Message is empty");
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Call Gemini AI
    console.log("🤖 Calling Gemini AI...");
    const reply = await askGemini(trimmedMessage);

    if (!reply) {
      console.error("❌ Gemini returned empty reply");
      return NextResponse.json(
        { error: "AI returned empty response" },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log("✅ Gemini response received, sending to client...");

    // 4. Return success response
    return NextResponse.json(
      { 
        reply,
        timestamp: new Date().toISOString(),
        success: true,
      },
      { 
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error("❌ Chat API Error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error details:", errorMessage);

    // Specific error responses
    if (errorMessage.includes("GEMINI_API_KEY")) {
      console.error("💥 Gemini API key not configured");
      return NextResponse.json(
        { error: "AI service not configured. Contact admin." },
        { status: 503, headers: corsHeaders }
      );
    }

    if (errorMessage.includes("API")) {
      console.error("💥 Gemini API error");
      return NextResponse.json(
        { error: "AI service error. Please try again." },
        { status: 503, headers: corsHeaders }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle GET requests
export async function GET() {
  console.log("📋 Chat API - GET request (health check)");
  return NextResponse.json(
    { 
      status: "Chat API is running",
      endpoint: "POST /api/chat",
      method: "POST",
      body: {
        message: "string"
      },
      response: {
        reply: "string",
        timestamp: "ISO string",
        success: "boolean"
      }
    },
    { status: 200, headers: corsHeaders }
  );
}
