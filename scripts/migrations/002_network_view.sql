-- Migration 002: Create network_view for Query Engine
-- This is a READ-ONLY view joining the three core tables.
-- It does not modify any existing table.

CREATE OR REPLACE VIEW network_view AS
SELECT
  -- Connection fields
  uc.id AS connection_id,
  uc.user_id,
  uc.first_name,
  uc.last_name,
  uc.company AS csv_company,
  uc.position AS csv_position,
  uc.connected_on,
  uc.linkedin_url,
  uc.seniority_tier,
  uc.function_category,
  uc.decision_maker_likelihood,
  uc.enrichment_tier,
  uc.enrichment_status,
  uc.match_score,
  uc.match_type,
  uc.match_reasons,
  uc.suggested_approach,
  uc.recent_half,

  -- Person enrichment
  ep.headline,
  ep.summary AS person_summary,
  ep.current_title,
  ep.current_company,
  ep.current_company_linkedin,
  ep.location_str,
  ep.city,
  ep.state,
  ep.country,
  ep.country_full_name,
  ep.total_experience_years,
  ep.previous_companies,
  ep.previous_titles,
  ep.work_history,
  ep.education_schools,
  ep.education_degrees,
  ep.education_fields,
  ep.follower_count,
  ep.is_linkedin_active,
  ep.certifications_list,
  ep.profile_pic_url,

  -- Company enrichment
  ec.name AS company_name,
  ec.description AS company_description,
  ec.industry AS company_industry,
  ec.specialities AS company_specialities,
  ec.website AS company_website,
  ec.domain AS company_domain,
  ec.company_size_min,
  ec.company_size_max,
  ec.company_type,
  ec.founded_year,
  ec.hq_city,
  ec.hq_state,
  ec.hq_country,
  ec.latest_funding_type,
  ec.latest_funding_amount,
  ec.latest_funding_date,
  ec.total_funding_amount,
  ec.logo_url AS company_logo_url

FROM user_connections uc
LEFT JOIN enriched_profiles ep ON uc.linkedin_url = ep.linkedin_url
LEFT JOIN enriched_companies ec ON ep.current_company_linkedin = ec.linkedin_url;

-- Indexes for query engine performance (additive only)
CREATE INDEX IF NOT EXISTS idx_uc_match_type ON user_connections(match_type);
CREATE INDEX IF NOT EXISTS idx_uc_function_category ON user_connections(function_category);
CREATE INDEX IF NOT EXISTS idx_ec_industry ON enriched_companies(industry);
CREATE INDEX IF NOT EXISTS idx_ec_hq_country ON enriched_companies(hq_country);
CREATE INDEX IF NOT EXISTS idx_ep_country ON enriched_profiles(country);
CREATE INDEX IF NOT EXISTS idx_uc_connected_on ON user_connections(connected_on);
