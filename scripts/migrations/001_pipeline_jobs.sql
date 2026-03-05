-- Pipeline jobs table
CREATE TABLE IF NOT EXISTS pipeline_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Status
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'classifying', 'enriching_persons',
                      'enriching_companies', 'scoring', 'completed',
                      'failed', 'paused', 'cancelled')),

  -- Connection split
  total_connections INT NOT NULL DEFAULT 0,
  recent_cutoff_date DATE,
  recent_count INT DEFAULT 0,
  old_count INT DEFAULT 0,

  -- Progress counters
  classified_count INT DEFAULT 0,
  enriched_persons_count INT DEFAULT 0,
  enriched_companies_count INT DEFAULT 0,
  scored_count INT DEFAULT 0,
  hits_count INT DEFAULT 0,
  skipped_count INT DEFAULT 0,
  failed_items_count INT DEFAULT 0,

  -- Processing
  batch_size INT DEFAULT 5,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_tick_at TIMESTAMPTZ,
  estimated_completion TIMESTAMPTZ,

  -- Admin controls
  admin_action TEXT DEFAULT NULL
    CHECK (admin_action IN ('pause', 'cancel', 'restart', 'retry_failed', 'force_complete')),
  admin_action_by TEXT,
  admin_action_at TIMESTAMPTZ,
  admin_note TEXT,

  -- Error tracking
  error_log JSONB DEFAULT '[]'::jsonb,
  consecutive_failures INT DEFAULT 0,

  -- Email
  email_sent_progress BOOLEAN DEFAULT false,
  email_sent_complete BOOLEAN DEFAULT false,
  tracking_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  -- Cost tracking
  cost_enrichlayer NUMERIC DEFAULT 0,
  cost_anthropic_tokens INT DEFAULT 0,

  -- Mode
  mode TEXT NOT NULL DEFAULT 'background'
    CHECK (mode IN ('instant', 'background'))
);

CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_active ON pipeline_jobs(status)
  WHERE status IN ('queued', 'classifying', 'enriching_persons',
                   'enriching_companies', 'scoring');
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_user ON pipeline_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_token ON pipeline_jobs(tracking_token);

-- Add recent_half flag to user_connections
ALTER TABLE user_connections ADD COLUMN IF NOT EXISTS recent_half BOOLEAN DEFAULT NULL;
