import { NextRequest, NextResponse } from "next/server";

/**
 * Simple test endpoint to verify all AI services are working
 * GET /api/test-ai - Returns status of all API keys
 * POST /api/test-ai - Tests each AI provider with a simple prompt
 */

export async function GET() {
  console.log("\n🧪 [TEST-AI] GET endpoint - Checking environment variables...\n");

  const checks = {
    gemini: {
      configured: !!process.env.GEMINI_API_KEY,
      keyPreview: process.env.GEMINI_API_KEY?.slice(0, 10) + "...",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    },
    openai: {
      configured: !!(process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY),
      keyPreview: (process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY)?.slice(0, 10) + "...",
      model: process.env.OPENAI_MODEL_NAME || "gpt-4o-mini",
    },
    groq: {
      configured: !!(process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.GROCK_API_KEY),
      keyVariable: process.env.GROQ_API_KEY
        ? "GROQ_API_KEY"
        : process.env.GROK_API_KEY
          ? "GROK_API_KEY"
          : process.env.GROCK_API_KEY
            ? "GROCK_API_KEY"
            : "NOT_SET",
      keyPreview: (process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.GROCK_API_KEY)?.slice(0, 10) + "...",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    },
  };

  console.log("✅ Environment configuration:");
  console.log(JSON.stringify(checks, null, 2));

  return NextResponse.json(
    {
      status: "ok",
      message: "Test endpoint active. Use POST for API testing.",
      environment: checks,
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  console.log("\n🧪 [TEST-AI] POST endpoint - Testing AI providers...\n");

  const testPrompt = "Return a JSON object with a single field 'message' containing 'success'. Nothing else.";

  const results: Record<string, any> = {};

  // Test Gemini
  if (process.env.GEMINI_API_KEY) {
    console.log("🔄 Testing Gemini...");
    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: testPrompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 256,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (geminiResponse.ok) {
        const data = (await geminiResponse.json()) as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        results.gemini = {
          status: "✅ SUCCESS",
          responseLength: text?.length || 0,
          preview: text?.substring(0, 100) || "NO TEXT",
        };
        console.log("✅ Gemini working!");
      } else {
        const error = await geminiResponse.text();
        results.gemini = {
          status: "❌ FAILED",
          statusCode: geminiResponse.status,
          error: error.substring(0, 200),
        };
        console.error("❌ Gemini failed:", geminiResponse.status);
      }
    } catch (error) {
      results.gemini = {
        status: "❌ ERROR",
        error: error instanceof Error ? error.message : String(error),
      };
      console.error("❌ Gemini error:", error);
    }
  } else {
    results.gemini = { status: "⚠️ SKIPPED", reason: "GEMINI_API_KEY not configured" };
  }

  // Test OpenAI
  const openaiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
  if (openaiKey) {
    console.log("🔄 Testing OpenAI...");
    try {
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL_NAME || "gpt-4o-mini",
          messages: [{ role: "user", content: testPrompt }],
          temperature: 0.3,
          max_tokens: 256,
        }),
      });

      if (openaiResponse.ok) {
        const data = (await openaiResponse.json()) as any;
        const text = data?.choices?.[0]?.message?.content;
        results.openai = {
          status: "✅ SUCCESS",
          responseLength: text?.length || 0,
          preview: text?.substring(0, 100) || "NO TEXT",
        };
        console.log("✅ OpenAI working!");
      } else {
        const error = await openaiResponse.text();
        results.openai = {
          status: "❌ FAILED",
          statusCode: openaiResponse.status,
          error: error.substring(0, 200),
        };
        console.error("❌ OpenAI failed:", openaiResponse.status);
      }
    } catch (error) {
      results.openai = {
        status: "❌ ERROR",
        error: error instanceof Error ? error.message : String(error),
      };
      console.error("❌ OpenAI error:", error);
    }
  } else {
    results.openai = { status: "⚠️ SKIPPED", reason: "OPENAI_API_KEY not configured" };
  }

  // Test Groq
  const groqKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.GROCK_API_KEY;
  if (groqKey) {
    console.log("🔄 Testing Groq...");
    try {
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: testPrompt }],
          temperature: 0.3,
          max_tokens: 256,
        }),
      });

      if (groqResponse.ok) {
        const data = (await groqResponse.json()) as any;
        const text = data?.choices?.[0]?.message?.content;
        results.groq = {
          status: "✅ SUCCESS",
          responseLength: text?.length || 0,
          preview: text?.substring(0, 100) || "NO TEXT",
        };
        console.log("✅ Groq working!");
      } else {
        const error = await groqResponse.text();
        results.groq = {
          status: "❌ FAILED",
          statusCode: groqResponse.status,
          error: error.substring(0, 200),
        };
        console.error("❌ Groq failed:", groqResponse.status);
      }
    } catch (error) {
      results.groq = {
        status: "❌ ERROR",
        error: error instanceof Error ? error.message : String(error),
      };
      console.error("❌ Groq error:", error);
    }
  } else {
    results.groq = { status: "⚠️ SKIPPED", reason: "GROQ_API_KEY not configured" };
  }

  console.log("\n📊 Test Results:");
  console.log(JSON.stringify(results, null, 2));

  const allWorking = Object.values(results).every((r: any) => r.status?.includes("SUCCESS") || r.status?.includes("SKIPPED"));

  return NextResponse.json(
    {
      status: allWorking ? "🎉 ALL PROVIDERS WORKING!" : "⚠️ Some providers failed",
      timestamp: new Date().toISOString(),
      results,
    },
    { status: allWorking ? 200 : 207 }
  );
}
