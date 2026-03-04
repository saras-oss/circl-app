import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

const BATCH_SIZE = 75;

function assignEnrichmentTier(seniorityTier: string, position: string): string {
  const posLower = (position || "").toLowerCase();
  const isFounderOrPartner =
    /founder|co-founder|partner|managing director|principal/i.test(posLower);

  if (
    seniorityTier === "C-suite" ||
    seniorityTier === "VP/Director" ||
    isFounderOrPartner
  ) {
    return "tier1";
  }
  if (seniorityTier === "Manager") {
    return "tier2";
  }
  if (seniorityTier === "IC") {
    return "tier3";
  }
  return "tier4";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, offset } = await request.json();

    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch unclassified connections
    const { data: connections, error: fetchError } = await supabaseAdmin
      .from("user_connections")
      .select("id, first_name, last_name, company, position")
      .eq("user_id", userId)
      .eq("classification_status", "pending")
      .order("id", { ascending: true })
      .range(offset || 0, (offset || 0) + BATCH_SIZE - 1);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        processed: 0,
        remaining: 0,
        hasMore: false,
      });
    }

    // Update processing status
    await supabaseAdmin
      .from("users")
      .update({ processing_status: "classifying" })
      .eq("id", userId);

    // Build batch prompt
    const connectionsText = connections
      .map(
        (c, i) =>
          `${i + 1}. ${c.first_name} ${c.last_name} | Company: ${c.company || "N/A"} | Position: ${c.position || "N/A"}`
      )
      .join("\n");

    const anthropic = new Anthropic();
    const startTime = Date.now();

    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Classify each person below. Return ONLY a valid JSON array (no other text) with one object per person in the same order as input.

For each person, determine:

1. seniority_tier: "C-suite" | "VP/Director" | "Manager" | "IC" | "Junior/Intern/Irrelevant"
   - C-suite: CEO, CTO, CFO, COO, CIO, CISO, CMO, CRO, CPO, CLO, CHRO, General Counsel, Managing Partner, Founder, Co-Founder
   - VP/Director: VP, SVP, EVP, Head of X, Director of X, Managing Director, Principal, Partner (non-managing)
   - Manager: Manager, Senior Manager, Team Lead, Group Lead
   - IC: Individual contributors, engineers, analysts, associates, consultants (non-titled)
   - Junior/Intern/Irrelevant: Interns, students, assistants, entry-level, retired, unemployed

2. function_category — infer from title context, not exact string matching:
   - "Engineering & Technology": CTO, VP Engineering, Head of Data, Director of Engineering, Chief Architect, Head of Infrastructure, Head of Data Infrastructure, VP Technology
   - "Product": CPO, VP Product, Head of Product, Director of Product Management
   - "Operations": COO, VP Operations, Head of Operations, Director of Supply Chain, Head of Process
   - "Sales & BD": CRO, VP Sales, Head of BD, Director of Partnerships, Chief Commercial Officer
   - "Marketing": CMO, VP Marketing, Head of Growth, Director of Brand
   - "Finance": CFO, VP Finance, Head of FP&A, Controller, Treasurer
   - "HR & People": CHRO, VP People, Head of Talent, Director of HR, Head of People Operations
   - "IT & Security": CIO, CISO, VP IT, Head of IT, Director of Information Security
   - "Legal & Compliance": CLO, General Counsel, VP Legal, Head of Compliance
   - "General Management": CEO, GM, Managing Director, Founder, President, Country Head
   - "Investment": VC Partner, Angel Investor, Fund Manager, PE Director, Investment Director
   - "Consulting": Management Consultant, Strategy Consultant, Advisory Partner
   - "Other": Anything that doesn't clearly fit above

   KEY: "Head of Data Infrastructure" = Engineering & Technology (not missed because it doesn't say "Engineering"). Infer functional intent from context.

3. decision_maker_likelihood: "High" | "Medium" | "Low"
   - High: C-suite, VP-level, Founders, Partners
   - Medium: Directors, Heads of department
   - Low: Managers, ICs, Junior

4. connection_type_signal: "Potential Customer" | "Potential Investor" | "General Professional"
   - Potential Investor: VC, PE, Angel, Fund titles/companies
   - Potential Customer: Most business professionals at companies
   - General Professional: Students, academics, retirees, unclear roles

People to classify:
${connectionsText}

Return JSON array:
[{"seniority_tier":"...","function_category":"...","decision_maker_likelihood":"...","connection_type_signal":"..."},...]`,
        },
      ],
    });

    const durationMs = Date.now() - startTime;
    const responseText =
      aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";

    // Parse the JSON array
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    let classifications: Array<{
      seniority_tier: string;
      function_category: string;
      decision_maker_likelihood: string;
      connection_type_signal: string;
    }> = [];

    try {
      classifications = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      // If parsing fails, mark as failed and return
      return NextResponse.json(
        { error: "Failed to parse classification response" },
        { status: 500 }
      );
    }

    // Update each connection
    const batchId = `classify_${userId}_${Date.now()}`;
    const updatePromises = connections.map((conn, i) => {
      const classification = classifications[i];
      if (!classification) return Promise.resolve();

      const enrichmentTier = assignEnrichmentTier(
        classification.seniority_tier,
        conn.position
      );

      return supabaseAdmin
        .from("user_connections")
        .update({
          seniority_tier: classification.seniority_tier,
          function_category: classification.function_category,
          decision_maker_likelihood: classification.decision_maker_likelihood,
          connection_type_signal: classification.connection_type_signal,
          enrichment_tier: enrichmentTier,
          classification_status: "classified",
        })
        .eq("id", conn.id);
    });

    await Promise.all(updatePromises);

    // Log to prompt_runs
    await supabaseAdmin.from("prompt_runs").insert({
      user_id: userId,
      prompt_type: "classification",
      model: "claude-haiku-4-5-20251001",
      user_prompt: connectionsText.slice(0, 10000),
      response: responseText,
      structured_output: classifications,
      input_tokens: aiResponse.usage?.input_tokens || 0,
      output_tokens: aiResponse.usage?.output_tokens || 0,
      duration_ms: durationMs,
      batch_id: batchId,
      rows_processed: connections.length,
    });

    // Count remaining unclassified
    const { count: remaining } = await supabaseAdmin
      .from("user_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("classification_status", "pending");

    return NextResponse.json({
      processed: connections.length,
      remaining: remaining || 0,
      hasMore: (remaining || 0) > 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
