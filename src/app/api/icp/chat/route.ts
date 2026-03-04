import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, message, currentIcpState, sessionId } = await request.json();

    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch user's website scrape data for context
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("website_scrape_data, company_name, role_title")
      .eq("id", userId)
      .single();

    const websiteData = (userData?.website_scrape_data || {}) as Record<string, unknown>;
    const companyName = userData?.company_name || "their company";
    const roleTitle = userData?.role_title || "professional";
    const customerList = (websiteData.customer_list as Record<string, unknown>) || {};
    const salesTriggers = (websiteData.sales_triggers as Record<string, unknown>) || {};

    // Load existing session messages if sessionId provided
    let chatHistory: { role: string; content: string }[] = [];
    let currentSessionId = sessionId;

    if (currentSessionId) {
      const { data: session } = await supabaseAdmin
        .from("icp_chat_sessions")
        .select("messages")
        .eq("id", currentSessionId)
        .single();

      if (session?.messages) {
        chatHistory = session.messages;
      }
    }

    const systemPrompt = `You are an ICP refinement assistant for Circl. You help ${roleTitle} at ${companyName} define who they should be targeting in their professional network.

CONTEXT - Company Website Analysis:
${JSON.stringify(websiteData.icp_suggestions || {}, null, 2)}

CUSTOMERS FOUND ON WEBSITE:
${JSON.stringify(customerList, null, 2)}

SALES TRIGGERS IDENTIFIED:
${JSON.stringify(salesTriggers, null, 2)}

CURRENT ICP STATE:
${JSON.stringify(currentIcpState || {}, null, 2)}

BEHAVIOR:
- Be proactive. After the user's first message, ask 1-2 specific follow-up questions to narrow their ICP.
- Reference their actual website data when available: "I noticed your website mentions customers like [X] and [Y] — are you looking for more companies in that same space?"
- When the user says something that implies ICP changes, return structured updates.
- Keep responses concise (2-3 sentences + a question).
- Consider these dimensions: industries, geographies, titles/roles, company sizes, revenue ranges, triggers (buying signals)
- Also consider: investor profiles (fund types, stages, sectors)

RESPONSE FORMAT (strict JSON, no other text):
{
  "message": "Your conversational response here",
  "icpUpdates": {
    // Include ONLY fields that should change based on this message. Omit unchanged fields.
    // Possible fields: industries, geographies, titles, companySizes, revenueRanges, triggers,
    // investorFundTypes, investorStages, investorSectors
    // Each field should be an array of strings
  }
}`;

    // Build messages array
    const messages: { role: "user" | "assistant"; content: string }[] = [];

    for (const msg of chatHistory) {
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    messages.push({ role: "user", content: message });

    const anthropic = new Anthropic();
    const startTime = Date.now();

    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    const durationMs = Date.now() - startTime;
    const responseText =
      aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    let parsedResponse: { message: string; icpUpdates: Record<string, unknown> };

    try {
      parsedResponse = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { message: responseText, icpUpdates: {} };
    } catch {
      parsedResponse = { message: responseText, icpUpdates: {} };
    }

    // Update chat history
    chatHistory.push({ role: "user", content: message });
    chatHistory.push({ role: "assistant", content: responseText });

    // Save/update session
    if (currentSessionId) {
      await supabaseAdmin
        .from("icp_chat_sessions")
        .update({
          messages: chatHistory,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentSessionId);
    } else {
      const { data: newSession } = await supabaseAdmin
        .from("icp_chat_sessions")
        .insert({
          user_id: userId,
          messages: chatHistory,
        })
        .select("id")
        .single();

      currentSessionId = newSession?.id;
    }

    // Log to prompt_runs
    await supabaseAdmin.from("prompt_runs").insert({
      user_id: userId,
      prompt_type: "icp_chat",
      model: "claude-haiku-4-5-20251001",
      input_tokens: aiResponse.usage?.input_tokens || 0,
      output_tokens: aiResponse.usage?.output_tokens || 0,
      duration_ms: durationMs,
      status: "completed",
    });

    return NextResponse.json({
      message: parsedResponse.message,
      icpUpdates: parsedResponse.icpUpdates,
      sessionId: currentSessionId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
