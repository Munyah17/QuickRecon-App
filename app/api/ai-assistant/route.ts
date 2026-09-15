import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Ordered fallback chain — first available model wins. */
const MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"];

const SYSTEM_PROMPT = `You are QuickRecon AI Assistant, an intelligent helper integrated into the QuickRecon reconciliation management app. You help super admins and agents with:

- Reconciliation queries and data analysis
- Import guidance and troubleshooting
- Report generation and distribution advice
- Agent management and task assignment
- ERP features (accounting, HR, sales, POS, invoices)
- General app navigation and feature questions

Keep responses concise, professional, and actionable. Use markdown formatting when helpful. You have access to the QuickRecon context but cannot modify data directly.`;

export async function POST(req: NextRequest) {
  try {
    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: "AI service is not configured (missing GROQ_API_KEY)." },
        { status: 503 }
      );
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array required" }, { status: 400 });
    }

    let lastError = "";
    for (const model of MODELS) {
      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages.slice(-10)],
          temperature: 0.6,
          max_tokens: 1500,
          reasoning_effort: "low",
          stream: false,
        }),
      });

      if (!response.ok) {
        lastError = `${model}: ${response.status}`;
        console.error("Groq API error:", response.status, await response.text());
        // Only retry on model-not-found/rate-limit style errors
        if (response.status === 404 || response.status === 429 || response.status >= 500) continue;
        return NextResponse.json({ error: "AI service rejected the request." }, { status: 502 });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return NextResponse.json({ content });
      lastError = `${model}: empty response`;
    }

    return NextResponse.json(
      { error: `AI service unavailable (${lastError || "no model responded"}).` },
      { status: 502 }
    );
  } catch (error) {
    console.error("AI assistant error:", error);
    return NextResponse.json(
      { error: "Failed to process request. Please try again." },
      { status: 500 }
    );
  }
}
