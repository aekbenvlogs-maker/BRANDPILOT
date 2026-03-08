-- ============================================================
-- PROJECT      : BRANDSCALE — AI Brand Scaling Tool
-- FILE         : database/schema.sql
-- DESCRIPTION  : Full PostgreSQL schema with indexes and constraints
-- AUTHOR       : BRANDSCALE Dev Team
-- WORKFLOW     : VSCode + Claude + Copilot Pro + File Engineering
-- LAST UPDATED : 2026-03-08
-- ============================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE campaign_channel AS ENUM ('email', 'social', 'ads', 'sms', 'multi');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE content_type AS ENUM ('post', 'email', 'ad', 'newsletter', 'video_script');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE score_tier AS ENUM ('hot', 'warm', 'cold');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE workflow_step_status AS ENUM ('pending', 'running', 'completed', 'failed', 'retrying');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(320)  NOT NULL UNIQUE,
    hashed_password VARCHAR(256)  NOT NULL,
    role            user_role     NOT NULL DEFAULT 'manager',
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    -- RGPD
    consent_date    TIMESTAMPTZ,
    consent_source  VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        VARCHAR(256) NOT NULL,
    description TEXT,
    archived    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id  ON projects (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects (archived);

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID             NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name        VARCHAR(256)     NOT NULL,
    status      campaign_status  NOT NULL DEFAULT 'draft',
    channel     campaign_channel NOT NULL DEFAULT 'email',
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    launched_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaigns_project_id ON campaigns (project_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status     ON campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaigns_channel    ON campaigns (channel);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id   UUID         NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    -- Encrypted PII fields (Fernet)
    email        TEXT         NOT NULL,          -- encrypted
    first_name   TEXT,                           -- encrypted
    last_name    TEXT,                           -- encrypted
    company      VARCHAR(256),
    sector       VARCHAR(128),
    company_size VARCHAR(64),
    -- Engagement counters
    email_opens  INTEGER      NOT NULL DEFAULT 0,
    email_clicks INTEGER      NOT NULL DEFAULT 0,
    page_visits  INTEGER      NOT NULL DEFAULT 0,
    -- Scoring
    score        SMALLINT     NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    score_tier   score_tier   NOT NULL DEFAULT 'cold',
    score_updated_at TIMESTAMPTZ,
    -- RGPD
    opt_in       BOOLEAN      NOT NULL DEFAULT FALSE,
    consent_date TIMESTAMPTZ,
    consent_source VARCHAR(128),
    -- Metadata
    source       VARCHAR(128),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_project_id  ON leads (project_id);
CREATE INDEX IF NOT EXISTS idx_leads_score_tier  ON leads (score_tier);
CREATE INDEX IF NOT EXISTS idx_leads_opt_in      ON leads (opt_in);
CREATE INDEX IF NOT EXISTS idx_leads_sector      ON leads (sector);

-- ---------------------------------------------------------------------------
-- content
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id  UUID         NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
    lead_id      UUID         REFERENCES leads (id) ON DELETE SET NULL,
    content_type content_type NOT NULL,
    body_text    TEXT,
    image_url    TEXT,
    video_url    TEXT,
    prompt_used  TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_campaign_id  ON content (campaign_id);
CREATE INDEX IF NOT EXISTS idx_content_lead_id      ON content (lead_id);
CREATE INDEX IF NOT EXISTS idx_content_type         ON content (content_type);

-- ---------------------------------------------------------------------------
-- emails
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emails (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id    UUID        NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
    lead_id        UUID        NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
    subject        VARCHAR(998) NOT NULL,
    body           TEXT        NOT NULL,
    sent_at        TIMESTAMPTZ,
    opened_at      TIMESTAMPTZ,
    clicked_at     TIMESTAMPTZ,
    bounced        BOOLEAN     NOT NULL DEFAULT FALSE,
    unsubscribed   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_campaign_id ON emails (campaign_id);
CREATE INDEX IF NOT EXISTS idx_emails_lead_id     ON emails (lead_id);
CREATE INDEX IF NOT EXISTS idx_emails_sent_at     ON emails (sent_at);
CREATE INDEX IF NOT EXISTS idx_emails_unsubscribed ON emails (unsubscribed);

-- ---------------------------------------------------------------------------
-- analytics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id  UUID         NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
    date         DATE         NOT NULL,
    emails_sent  INTEGER      NOT NULL DEFAULT 0,
    open_rate    NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    ctr          NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    conversions  INTEGER      NOT NULL DEFAULT 0,
    ai_cost_usd  NUMERIC(10,4) NOT NULL DEFAULT 0.0000,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_campaign_id ON analytics (campaign_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date        ON analytics (date);

-- ---------------------------------------------------------------------------
-- workflow_jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_jobs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID         REFERENCES campaigns (id) ON DELETE SET NULL,
    job_type    VARCHAR(64)  NOT NULL,
    current_step VARCHAR(128),
    status      workflow_step_status NOT NULL DEFAULT 'pending',
    payload     JSONB,
    result      JSONB,
    error_msg   TEXT,
    started_at  TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_jobs_campaign_id ON workflow_jobs (campaign_id);
CREATE INDEX IF NOT EXISTS idx_workflow_jobs_status      ON workflow_jobs (status);

-- ---------------------------------------------------------------------------
-- refresh_tokens (JWT refresh token store)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(256) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- ---------------------------------------------------------------------------
-- Trigger: auto-update updated_at columns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    CREATE TRIGGER trg_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER trg_projects_updated_at
        BEFORE UPDATE ON projects
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER trg_campaigns_updated_at
        BEFORE UPDATE ON campaigns
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER trg_leads_updated_at
        BEFORE UPDATE ON leads
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
