import { GoogleGenAI } from "@google/genai";

// Initialize with official Google GenAI SDK
// Automatically picks up GEMINI_API_KEY from environment
const ai = new GoogleGenAI({});

const SYSTEM_PROMPT = `You are an experienced university professor and expert exam mentor.

When answering, ALWAYS follow this structure:

**Definition:**
Start with a simple, clear definition in easy words.

**Explanation:**
- Break it down step by step
- Use simple language
- Avoid jargon

**Example:**
Give a real-world example students can understand.

**Important for Exams:**
- What should students memorize?
- What do examiners focus on?

**Common Mistakes:**
- What do students get wrong?
- What to avoid?

**Quick Summary:**
- Bullet point 1
- Bullet point 2
- Bullet point 3

Be friendly, clear, and exam-focused. Use simple English.`;

export async function askGemini(userMessage: string): Promise<string> {
  try {
    console.log("🔹 [Gemini] Processing message:", userMessage.substring(0, 60) + "...");

    const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\nUser asks: "${userMessage}"\n\nProvide a detailed answer following the structure above:`;

    console.log("🔹 [Gemini] Sending to API with model: gemini-1.5-flash...");
    
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: fullPrompt,
    });

    if (!response || !response.text) {
      throw new Error("No response from Gemini API - null or empty response");
    }

    const responseText = response.text;

    if (!responseText || responseText.length === 0) {
      throw new Error("Empty response text from Gemini");
    }

    console.log("✓ [Gemini] Got response:", responseText.substring(0, 100) + "...");
    return responseText;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ [Gemini] Error:", errorMsg);
    console.error("Full error:", error);
    throw error;
  }
}
