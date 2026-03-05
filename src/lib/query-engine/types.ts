/* eslint-disable @typescript-eslint/no-explicit-any */

export interface QueryIntent {
  query_type: "filter" | "aggregate" | "person_lookup";

  person_lookup?: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    company?: string;
  };

  filters?: {
    seniority_tier?: string[];
    function_category?: string[];
    match_type?: string[];
    decision_maker_likelihood?: string[];
    enrichment_tier?: string[];
    company_type?: string[];

    match_score_min?: number;
    match_score_max?: number;

    title_keywords?: string[];
    company_keywords?: string[];
    company_current_or_previous_keywords?: string[];
    industry_keywords?: string[];
    skill_keywords?: string[];
    geography_keywords?: string[];
    school_keywords?: string[];
    previous_company_keywords?: string[];

    company_size_min?: number;
    company_size_max?: number;

    experience_years_min?: number;
    experience_years_max?: number;

    funding_stages?: string[];
    funding_amount_min?: number;

    connected_after?: string;
    connected_before?: string;
  };

  aggregation?: {
    group_by:
      | "company_industry"
      | "seniority_tier"
      | "function_category"
      | "country_full_name"
      | "hq_country"
      | "company_name"
      | "match_type"
      | "company_type"
      | "latest_funding_type";
    metric: "count" | "avg_score";
  };

  sort?: {
    field:
      | "match_score"
      | "connected_on"
      | "total_experience_years"
      | "company_size_max"
      | "latest_funding_amount"
      | "follower_count";
    direction: "asc" | "desc";
  };

  limit?: number;

  sales_intent?: boolean;
}

export interface QueryResult {
  data: any[];
  count: number;
  total_available: number;
  enrichment_coverage: {
    enriched: number;
    total: number;
  };
}

export interface AggregationResult {
  label: string;
  value: number;
}

export interface SynthesisResponse {
  text: string;
  display_type: "cards" | "table" | "chart" | "profile" | "text_only";
  follow_up_suggestions: string[];
}

export interface QueryAPIResponse {
  text: string;
  display_type: "cards" | "table" | "chart" | "profile" | "text_only";
  follow_up_suggestions: string[];
  results: any[];
  aggregation: AggregationResult[] | null;
  total_available: number;
  enrichment_coverage: {
    enriched: number;
    total: number;
  };
  sales_intent?: boolean;
  is_intro_query?: boolean;
  intro_company?: string | null;
}
