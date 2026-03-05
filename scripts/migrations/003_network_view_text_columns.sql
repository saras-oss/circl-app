-- Migration 003: Add pre-cast text columns to network_view for PostgREST compatibility
-- PostgREST cannot parse ::text casts inside .or() filters.
-- This adds plain text columns so the query builder can use them directly.
--
-- SAFE: This drops and recreates the view. Views have no data — they're just saved queries.
-- All underlying tables (user_connections, enriched_profiles, enriched_companies) are untouched.

CREATE OR REPLACE VIEW network_view AS
SELECT
  -- Connection fields (unchanged)
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

  -- Person enrichment (unchanged)
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

  -- Company enrichment (unchanged)
  ec.name AS company_name,
  ec.description AS company_description,
  ec.industry AS company_industry,
  ec.specialities AS company_specialities,
  ec.website AS company_website,
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
  ec.profile_pic_url AS company_logo_url,

  -- NEW: Pre-cast text columns for PostgREST .or() compatibility
  -- These allow ilike searches on JSONB fields without ::text casts
  ep.previous_companies::text AS previous_companies_text,
  ep.previous_titles::text AS previous_titles_text,
  ep.education_schools::text AS education_schools_text,
  ep.education_degrees::text AS education_degrees_text,
  ep.education_fields::text AS education_fields_text,
  ep.certifications_list::text AS certifications_list_text,
  ec.specialities::text AS company_specialities_text

FROM user_connections uc
LEFT JOIN enriched_profiles ep ON uc.linkedin_url = ep.linkedin_url
LEFT JOIN enriched_companies ec ON ep.current_company_linkedin = ec.linkedin_url;
