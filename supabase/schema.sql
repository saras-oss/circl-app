-- ============================================
-- CIRCL DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  linkedin_url TEXT,
  company_name TEXT,
  company_website TEXT,
  role_title TEXT,
  mobile_number TEXT,
  email_reminder_opted_in BOOLEAN DEFAULT false,

  -- ICP data (structured JSON)
  icp_data JSONB DEFAULT '{}'::jsonb,
  icp_confirmed BOOLEAN DEFAULT false,

  -- Website scrape data
  website_scrape_data JSONB DEFAULT '{}'::jsonb,
  website_scrape_status TEXT DEFAULT 'pending' CHECK (website_scrape_status IN ('pending', 'scraping', 'completed', 'failed')),

  -- Subscription & payment
  subscription_tier TEXT DEFAULT 'none' CHECK (subscription_tier IN ('none', 'free', 'starter', 'growth', 'scale', 'enterprise')),
  subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'expired', 'cancelled')),

  -- Onboarding tracking
  onboarding_step INTEGER DEFAULT 1,
  onboarding_completed BOOLEAN DEFAULT false,
  has_requested_export BOOLEAN DEFAULT false,

  -- Connection stats
  total_connections INTEGER DEFAULT 0,
  enriched_connections INTEGER DEFAULT 0,

  -- Processing status
  processing_status TEXT DEFAULT 'idle' CHECK (processing_status IN ('idle', 'classifying', 'enriching', 'matching', 'completed', 'failed')),
  processing_progress INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. USER_CONNECTIONS TABLE
-- ============================================
CREATE TABLE user_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Raw CSV data
  first_name TEXT,
  last_name TEXT,
  email_address TEXT,
  company TEXT,
  position TEXT,
  connected_on DATE,
  linkedin_url TEXT,

  -- LLM Classification (Phase 1)
  seniority_tier TEXT CHECK (seniority_tier IN ('C-suite', 'VP/Director', 'Manager', 'IC', 'Junior/Intern/Irrelevant')),
  function_category TEXT,
  decision_maker_likelihood TEXT CHECK (decision_maker_likelihood IN ('High', 'Medium', 'Low')),
  connection_type_signal TEXT CHECK (connection_type_signal IN ('Potential Customer', 'Potential Investor', 'Potential Advisor', 'General Professional')),
  classification_status TEXT DEFAULT 'pending' CHECK (classification_status IN ('pending', 'classified', 'failed')),

  -- Enrichment status
  enrichment_status TEXT DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'enriching', 'enriched', 'cached', 'skipped', 'failed')),
  enrichment_tier TEXT CHECK (enrichment_tier IN ('tier1', 'tier2', 'tier3', 'tier4')),

  -- Match data (Phase 2)
  match_score NUMERIC(3,1),
  match_type TEXT CHECK (match_type IN ('customer', 'investor', 'advisor')),
  match_reason TEXT,
  is_active_match BOOLEAN DEFAULT false,

  -- Free tier tracking
  is_free_tier_selection BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_connections_user_id ON user_connections(user_id);
CREATE INDEX idx_user_connections_linkedin_url ON user_connections(linkedin_url);
CREATE INDEX idx_user_connections_classification ON user_connections(user_id, seniority_tier, classification_status);
CREATE INDEX idx_user_connections_enrichment ON user_connections(user_id, enrichment_status);
CREATE INDEX idx_user_connections_match ON user_connections(user_id, is_active_match, match_score DESC);

-- ============================================
-- 3. ENRICHED_PROFILES (SHARED POOL)
-- ============================================
CREATE TABLE enriched_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  linkedin_url TEXT UNIQUE NOT NULL,

  -- Person data from EnrichLayer
  full_name TEXT,
  headline TEXT,
  location TEXT,
  summary TEXT,
  profile_picture_url TEXT,

  -- Work history
  current_company TEXT,
  current_title TEXT,
  work_history JSONB DEFAULT '[]'::jsonb,

  -- Education
  education JSONB DEFAULT '[]'::jsonb,

  -- Skills & endorsements
  skills JSONB DEFAULT '[]'::jsonb,

  -- Additional data
  recommendations_count INTEGER DEFAULT 0,
  connections_count INTEGER,
  activity JSONB DEFAULT '{}'::jsonb,

  -- Company domain (for linking to enriched_companies)
  company_domain TEXT,

  -- Raw API response
  raw_data JSONB DEFAULT '{}'::jsonb,

  enriched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_enriched_profiles_linkedin_url ON enriched_profiles(linkedin_url);
CREATE INDEX idx_enriched_profiles_company_domain ON enriched_profiles(company_domain);
CREATE INDEX idx_enriched_profiles_enriched_at ON enriched_profiles(enriched_at);

-- ============================================
-- 4. ENRICHED_COMPANIES (SHARED POOL)
-- ============================================
CREATE TABLE enriched_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain TEXT UNIQUE NOT NULL,

  -- Basic info
  company_name TEXT,
  description TEXT,
  industry TEXT,

  -- Size & stage
  employee_count_range TEXT,
  revenue_range TEXT,
  funding_stage TEXT,
  total_funding TEXT,

  -- Location
  headquarters TEXT,

  -- Deep scrape data
  products_services JSONB DEFAULT '[]'::jsonb,
  target_market TEXT,
  customer_names JSONB DEFAULT '[]'::jsonb,
  tech_stack JSONB DEFAULT '[]'::jsonb,
  geography JSONB DEFAULT '[]'::jsonb,

  -- Scrape metadata
  pages_scraped INTEGER DEFAULT 0,
  scrape_data JSONB DEFAULT '{}'::jsonb,

  -- Raw data
  raw_enrichlayer_data JSONB DEFAULT '{}'::jsonb,
  raw_scrape_data JSONB DEFAULT '{}'::jsonb,

  enriched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_enriched_companies_domain ON enriched_companies(domain);
CREATE INDEX idx_enriched_companies_enriched_at ON enriched_companies(enriched_at);

-- ============================================
-- 5. MATCHES TABLE (Phase 2, create now)
-- ============================================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES user_connections(id) ON DELETE CASCADE,

  score NUMERIC(3,1) NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('customer', 'investor', 'advisor')),
  reason TEXT,
  ai_reason TEXT,

  -- Key data points for display
  data_points JSONB DEFAULT '{}'::jsonb,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_matches_user_id ON matches(user_id);
CREATE INDEX idx_matches_user_type ON matches(user_id, match_type, score DESC);
CREATE INDEX idx_matches_active ON matches(user_id, is_active, score DESC);

-- ============================================
-- 6. PROMPT_RUNS (LLM Logging)
-- ============================================
CREATE TABLE prompt_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('classification', 'icp_chat', 'matching', 'query', 'website_extraction', 'company_extraction')),
  model TEXT NOT NULL DEFAULT 'claude-haiku',

  -- Request
  system_prompt TEXT,
  user_prompt TEXT,

  -- Response
  response TEXT,
  structured_output JSONB,

  -- Metrics
  input_tokens INTEGER,
  output_tokens INTEGER,
  duration_ms INTEGER,

  -- Batch info
  batch_id TEXT,
  rows_processed INTEGER,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_prompt_runs_user_id ON prompt_runs(user_id);
CREATE INDEX idx_prompt_runs_type ON prompt_runs(prompt_type, created_at DESC);
CREATE INDEX idx_prompt_runs_batch ON prompt_runs(batch_id);

-- ============================================
-- 7. ICP_CHAT_SESSIONS
-- ============================================
CREATE TABLE icp_chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  messages JSONB DEFAULT '[]'::jsonb,
  extracted_icp_state JSONB DEFAULT '{}'::jsonb,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_icp_chat_sessions_user_id ON icp_chat_sessions(user_id);

-- ============================================
-- 8. PAYMENTS TABLE
-- ============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  razorpay_signature TEXT,

  amount INTEGER NOT NULL, -- in smallest currency unit (paise for INR, cents for USD)
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),

  tier TEXT NOT NULL CHECK (tier IN ('free', 'starter', 'growth', 'scale', 'enterprise')),
  connection_count INTEGER,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_razorpay ON payments(razorpay_payment_id);

-- ============================================
-- 9. NOTIFICATIONS TABLE (Phase 2, create now)
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  channel TEXT NOT NULL CHECK (channel IN ('email')),
  notification_type TEXT NOT NULL,

  subject TEXT,
  body TEXT,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status, created_at);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE enriched_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE enriched_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- USERS: users can read/update their own row
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- USER_CONNECTIONS: users can CRUD their own connections
CREATE POLICY "Users can view own connections" ON user_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections" ON user_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections" ON user_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections" ON user_connections
  FOR DELETE USING (auth.uid() = user_id);

-- ENRICHED_PROFILES: all authenticated users can read (shared pool)
CREATE POLICY "Authenticated users can view enriched profiles" ON enriched_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- ENRICHED_COMPANIES: all authenticated users can read (shared pool)
CREATE POLICY "Authenticated users can view enriched companies" ON enriched_companies
  FOR SELECT USING (auth.role() = 'authenticated');

-- MATCHES: users can view their own matches
CREATE POLICY "Users can view own matches" ON matches
  FOR SELECT USING (auth.uid() = user_id);

-- PROMPT_RUNS: users can view their own prompt runs
CREATE POLICY "Users can view own prompt runs" ON prompt_runs
  FOR SELECT USING (auth.uid() = user_id);

-- ICP_CHAT_SESSIONS: users can CRUD their own sessions
CREATE POLICY "Users can view own chat sessions" ON icp_chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions" ON icp_chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions" ON icp_chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- PAYMENTS: users can view their own payments
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- NOTIFICATIONS: users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_connections_updated_at
  BEFORE UPDATE ON user_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_icp_chat_sessions_updated_at
  BEFORE UPDATE ON icp_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TRIGGER: auto-create user row on signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
