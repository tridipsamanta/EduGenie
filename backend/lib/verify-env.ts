/**
 * Environment variable verification and logging
 * This runs on backend startup to ensure all AI APIs are properly configured
 */

function verifyEnvironment() {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 EDUGENIE BACKEND STARTUP - ENVIRONMENT VERIFICATION");
  console.log("=".repeat(70) + "\n");

  const timestamp = new Date().toISOString();
  console.log(`⏰ Timestamp: ${timestamp}`);
  console.log(`🔧 Node Env: ${process.env.NODE_ENV}\n`);

  // Gemini Check
  console.log("📌 GEMINI API:");
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiImageKey = process.env.GEMINI_IMAGE_API_KEY;
  if (geminiKey) {
    console.log(`  ✅ GEMINI_API_KEY configured`);
    console.log(`     Preview: ${geminiKey.slice(0, 15)}...${geminiKey.slice(-5)}`);
    console.log(`     Length: ${geminiKey.length} chars`);
  } else {
    console.log(`  ❌ GEMINI_API_KEY NOT configured`);
  }
  if (geminiImageKey) {
    console.log(`  ✅ GEMINI_IMAGE_API_KEY configured (image-only)`);
    console.log(`     Preview: ${geminiImageKey.slice(0, 15)}...${geminiImageKey.slice(-5)}`);
    console.log(`     Length: ${geminiImageKey.length} chars`);
  } else {
    console.log(`  ℹ️ GEMINI_IMAGE_API_KEY not set (image routes will use GEMINI_API_KEY fallback)`);
  }
  console.log(`  Model: gemini-1.5-flash`);
  console.log(`  Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent\n`);

  // OpenAI Check
  console.log("📌 OPENAI API:");
  const openaiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
  if (openaiKey) {
    const which = process.env.OPENAI_API_KEY ? "OPENAI_API_KEY" : "OPEN_API_KEY";
    console.log(`  ✅ ${which} configured`);
    console.log(`     Preview: ${openaiKey.slice(0, 15)}...${openaiKey.slice(-5)}`);
    console.log(`     Length: ${openaiKey.length} chars`);
  } else {
    console.log(`  ❌ Neither OPENAI_API_KEY nor OPEN_API_KEY configured`);
  }
  console.log(`  Model: ${process.env.OPENAI_MODEL_NAME || "gpt-4o-mini"}`);
  console.log(`  Endpoint: https://api.openai.com/v1/chat/completions\n`);

  // Groq Check
  console.log("📌 GROQ API:");
  const groqKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.GROCK_API_KEY;
  if (groqKey) {
    const which = process.env.GROQ_API_KEY
      ? "GROQ_API_KEY"
      : process.env.GROK_API_KEY
        ? "GROK_API_KEY (⚠️ TYPO - should be GROQ)"
        : "GROCK_API_KEY (⚠️ TYPO - should be GROQ)";
    console.log(`  ✅ ${which} configured`);
    console.log(`     Preview: ${groqKey.slice(0, 15)}...${groqKey.slice(-5)}`);
    console.log(`     Length: ${groqKey.length} chars`);
  } else {
    console.log(`  ❌ No Groq API key configured (GROQ_API_KEY, GROK_API_KEY, or GROCK_API_KEY)`);
  }
  console.log(`  Model: ${process.env.GROQ_MODEL || "llama-3.3-70b-versatile"}`);
  console.log(`  Endpoint: https://api.groq.com/openai/v1/chat/completions\n`);

  // YouTube Check
  console.log("📌 YOUTUBE API:");
  if (process.env.YOUTUBE_API_KEY) {
    console.log(`  ✅ YOUTUBE_API_KEY configured`);
    console.log(`     Preview: ${process.env.YOUTUBE_API_KEY.slice(0, 15)}...`);
  } else {
    console.log(`  ⚠️ YOUTUBE_API_KEY NOT configured (optional for course generation)`);
  }

  // Database Checks
  console.log("\n📌 DATABASE:");
  console.log(`  MongoDB: ${process.env.MONGODB_URI ? "✅ Configured" : "❌ NOT configured"}`);
  console.log(`  PostgreSQL: ${process.env.DATABASE_URL ? "✅ Configured" : "⚠️ NOT configured"}`);

  // Summary
  console.log("\n" + "=".repeat(70));
  const hasOpenAI = !!openaiKey;
  const hasGemini = !!geminiKey;
  const hasGroq = !!groqKey;
  const activeProviders = [hasOpenAI && "OpenAI", hasGemini && "Gemini", hasGroq && "Groq"].filter(Boolean);

  if (activeProviders.length >= 2) {
    console.log(`🎉 READY! ${activeProviders.length} AI providers configured: ${activeProviders.join(", ")}`);
  } else if (activeProviders.length === 1) {
    console.log(`⚠️ WARNING: Only ${activeProviders[0]} configured. No fallback available!`);
  } else {
    console.log(`🚨 CRITICAL: NO AI providers configured! Course generation will FAIL!`);
  }

  console.log("=".repeat(70) + "\n");
}

// Export for use in backend startup
export { verifyEnvironment };
