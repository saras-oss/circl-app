/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { callAnthropicWithRetry } from "@/lib/anthropic-retry";
import { serializeFunctionsForPrompt } from "@/lib/taxonomy/functions";
import { buildAndExecuteQuery } from "@/lib/query-engine/query-builder";
import { aggregateResults } from "@/lib/query-engine/aggregate";
import {
  INTENT_EXTRACTION_SYSTEM_PROMPT,
  RESPONSE_SYNTHESIS_SYSTEM_PROMPT,
} from "@/lib/query-engine/prompts";
import { QueryIntent, AggregationResult } from "@/lib/query-engine/types";

/** Robustly extract JSON from Haiku responses that may include code fences */
function extractJSON(text: string): any {
  const trimmed = text.trim();

  // Try parsing as-is first (happy path)
  try { return JSON.parse(trimmed); } catch {}

  // Strip markdown code fences
  const stripped = trimmed
    .replace(/^```(?:json|JSON)?\s*\n?/, "")
    .replace(/\n?\s*```\s*$/, "")
    .trim();
  try { return JSON.parse(stripped); } catch {}

  // Try to extract a JSON object from anywhere in the text
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }

  return null;
}

export async function POST(request: Request) {
  // Auth
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { question } = await request.json();
  if (!question || typeof question !== "string" || question.length > 2000) {
    return NextResponse.json({ error: "Invalid question" }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    // Fetch user's ICP for context
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("company_name, icp_data")
      .eq("id", user.id)
      .single();

    const icpData =
      typeof userData?.icp_data === "string"
        ? JSON.parse(userData.icp_data)
        : userData?.icp_data || {};

    // ── Pass 1: Intent Extraction ──
    const anthropic = new Anthropic();

    const intentResponse = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: INTENT_EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `The user's company: ${userData?.company_name || "Unknown"}
The user's ICP industries: ${icpData.industries?.join(", ") || "Not set"}
The user's ICP target functions: ${serializeFunctionsForPrompt(icpData.functions || [], icpData.titles)}

User question: "${question}"`,
          },
        ],
      })
    );

    const intentText =
      intentResponse.content[0].type === "text"
        ? intentResponse.content[0].text
        : "";

    let intent: QueryIntent;
    const parsedIntent = extractJSON(intentText);
    if (!parsedIntent) {
      console.error("QUERY: Failed to parse intent JSON:", intentText.slice(0, 500));
      return NextResponse.json(
        {
          error:
            "I had trouble understanding that question. Could you try rephrasing it?",
        },
        { status: 422 }
      );
    }
    intent = parsedIntent;

    // ── Execute Query ──
    // Use supabaseAdmin since the view might not have RLS configured for the anon client
    const results = await buildAndExecuteQuery(supabaseAdmin, user.id, intent);

    // ── Handle Aggregation ──
    let aggregationData: AggregationResult[] | null = null;
    if (intent.query_type === "aggregate" && intent.aggregation) {
      aggregationData = aggregateResults(
        results.data,
        intent.aggregation.group_by,
        intent.aggregation.metric
      );
    }

    // ── Pass 2: Response Synthesis ──
    // Truncate result data for token efficiency
    const isIntroQuery = !!(intent.filters?.company_current_or_previous_keywords?.length);
    const isPersonLookup = intent.query_type === "person_lookup";
    const needsRichData = isIntroQuery || isPersonLookup;

    const truncatedData =
      isPersonLookup
        ? results.data
        : results.data.map((row: any) => {
            const base: Record<string, any> = {
              first_name: row.first_name,
              last_name: row.last_name,
              current_title: row.current_title || row.csv_position,
              current_company: row.current_company || row.csv_company,
              location_str: row.location_str,
              company_industry: row.company_industry,
              seniority_tier: row.seniority_tier,
              connected_on: row.connected_on,
              company_name: row.company_name,
              company_description: row.company_description,
              company_size_min: row.company_size_min,
              company_size_max: row.company_size_max,
              company_type: row.company_type,
              latest_funding_type: row.latest_funding_type,
              latest_funding_amount: row.latest_funding_amount,
              total_funding_amount: row.total_funding_amount,
              hq_city: row.hq_city,
              hq_country: row.hq_country,
            };

            if (intent.sales_intent) {
              base.match_score = row.match_score;
              base.match_type = row.match_type;
              base.match_reasons = row.match_reasons;
              base.suggested_approach = row.suggested_approach;
            }

            if (needsRichData) {
              base.work_history = row.work_history;
              base.previous_companies = row.previous_companies;
              base.total_experience_years = row.total_experience_years;
              base.headline = row.headline;
              base.education_schools = row.education_schools;
            }

            return base;
          });

    const synthesisInput =
      intent.query_type === "aggregate"
        ? JSON.stringify(aggregationData, null, 2)
        : JSON.stringify(truncatedData, null, 2);

    const synthesisResponse = await callAnthropicWithRetry(() =>
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: RESPONSE_SYNTHESIS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `User's original question: "${question}"
Sales intent: ${intent.sales_intent ? "true" : "false"}

Total results matching: ${results.total_available}
Results returned: ${results.count}
Enrichment coverage: ${results.enrichment_coverage.enriched} of ${results.enrichment_coverage.total} connections enriched

${intent.query_type === "aggregate" ? "Aggregation results" : "Results data"}:
${synthesisInput}`,
          },
        ],
      })
    );

    const synthesisText =
      synthesisResponse.content[0].type === "text"
        ? synthesisResponse.content[0].text
        : "";

    let synthesis: {
      text: string;
      display_type: string;
      follow_up_suggestions: string[];
    };
    const parsedSynthesis = extractJSON(synthesisText);
    if (parsedSynthesis && parsedSynthesis.text) {
      synthesis = parsedSynthesis;
    } else {
      // If all JSON extraction failed, clean up and use as raw text
      const cleanedText = synthesisText
        .replace(/```(?:json|JSON)?/g, "")
        .replace(/```/g, "")
        .trim();
      synthesis = {
        text: cleanedText || "Here are your results.",
        display_type: results.count <= 5 ? "cards" : "table",
        follow_up_suggestions: [],
      };
    }

    // ── Log both calls to prompt_runs ──
    await supabaseAdmin.from("prompt_runs").insert([
      {
        user_id: user.id,
        prompt_type: "query_intent",
        model: "claude-haiku-4-5-20251001",
        system_prompt: INTENT_EXTRACTION_SYSTEM_PROMPT.slice(0, 10000),
        user_prompt: question,
        response: intentText,
        structured_output: JSON.stringify(intent),
        input_tokens: intentResponse.usage?.input_tokens || 0,
        output_tokens: intentResponse.usage?.output_tokens || 0,
      },
      {
        user_id: user.id,
        prompt_type: "query_synthesis",
        model: "claude-haiku-4-5-20251001",
        system_prompt: RESPONSE_SYNTHESIS_SYSTEM_PROMPT.slice(0, 10000),
        user_prompt: `${question} | ${results.count} results`,
        response: synthesisText,
        structured_output: JSON.stringify(synthesis),
        input_tokens: synthesisResponse.usage?.input_tokens || 0,
        output_tokens: synthesisResponse.usage?.output_tokens || 0,
      },
    ]);

    // ── Log to query_log ──
    try {
      await supabaseAdmin.from("query_log").insert({
        user_id: user.id,
        question,
        display_type: synthesis.display_type,
        results_count: results.data?.length || 0,
        answer_preview: synthesis.text?.slice(0, 200) || "",
        follow_ups: synthesis.follow_up_suggestions || [],
        duration_ms: Date.now() - startTime,
      });
    } catch (e) {
      console.error("Query log insert failed:", e);
    }

    // ── Return ──
    // Force "profile" display_type for person lookups so disambiguation triggers
    const finalDisplayType =
      intent.query_type === "person_lookup" ? "profile" : synthesis.display_type;

    return NextResponse.json({
      text: synthesis.text,
      display_type: finalDisplayType,
      follow_up_suggestions: synthesis.follow_up_suggestions || [],
      results: results.data,
      aggregation: aggregationData,
      total_available: results.total_available,
      enrichment_coverage: results.enrichment_coverage,
      sales_intent: intent.sales_intent || false,
      is_intro_query: isIntroQuery,
      intro_company: isIntroQuery ? intent.filters!.company_current_or_previous_keywords![0] : null,
    });
  } catch (err: unknown) {
    console.error("QUERY: Engine error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      {
        error: `Something went wrong processing your question. ${message}`,
      },
      { status: 500 }
    );
  }
}
