-- ============================================================================
-- Relay — Supabase PostgreSQL Schema
-- Run this entire script in the Supabase Dashboard: SQL Editor -> New Query -> Run
-- ============================================================================

-- Enable pgcrypto / uuid-ossp if needed (built-in gen_random_uuid() is standard in PG13+)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Session',
    active_provider TEXT DEFAULT '',
    fallback_chain JSONB DEFAULT '["anthropic:claude-3-5-sonnet-20241022", "openai:gpt-4o"]'::jsonb,
    token_cap INT DEFAULT 100000,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'error')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_updated ON sessions (user_id, updated_at DESC);

-- 3. Turns Table
CREATE TABLE IF NOT EXISTS turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'interrupted')),
    step_count INT DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    ended_at TIMESTAMPTZ
);

-- Invariant: at most one running turn per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_turns_single_running ON turns (session_id) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_turns_session_started ON turns (session_id, started_at DESC);

-- 4. Messages Table (Canonical Block Format)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq INT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    provider TEXT,
    model TEXT,
    usage JSONB DEFAULT '{"inputTokens": 0, "outputTokens": 0}'::jsonb,
    turn_id UUID REFERENCES turns(id) ON DELETE SET NULL,
    is_summary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_messages_session_seq UNIQUE (session_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_messages_session_seq ON messages (session_id, seq ASC);

-- 5. Virtual File System Table
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    content TEXT DEFAULT '',
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_files_session_path UNIQUE (session_id, path)
);

CREATE INDEX IF NOT EXISTS idx_files_session_path ON files (session_id, path);

-- 6. Structured Decision Ledger Table
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('decision', 'constraint', 'todo', 'fact')),
    body TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'done', 'superseded')),
    source_seq INT DEFAULT 0,
    superseded_by UUID REFERENCES ledger_entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_session_status ON ledger_entries (session_id, status);

-- 7. Provider Attempts Table
CREATE TABLE IF NOT EXISTS provider_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turn_id UUID NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'retryable', 'failover', 'fatal')),
    error_class TEXT,
    latency_ms INT DEFAULT 0,
    tokens_in INT DEFAULT 0,
    tokens_out INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempts_turn_id ON provider_attempts (turn_id);

-- 8. Handoffs Table
CREATE TABLE IF NOT EXISTS handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    turn_id UUID REFERENCES turns(id) ON DELETE SET NULL,
    from_provider TEXT NOT NULL,
    to_provider TEXT NOT NULL,
    reason TEXT NOT NULL,
    packet JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_handoffs_session_id ON handoffs (session_id, created_at ASC);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- Enables direct access when using Supabase client with anon or service_role key
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoffs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for server backend API access
DROP POLICY IF EXISTS "backend_users_policy" ON users;
CREATE POLICY "backend_users_policy" ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "backend_sessions_policy" ON sessions;
CREATE POLICY "backend_sessions_policy" ON sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "backend_turns_policy" ON turns;
CREATE POLICY "backend_turns_policy" ON turns FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "backend_messages_policy" ON messages;
CREATE POLICY "backend_messages_policy" ON messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "backend_files_policy" ON files;
CREATE POLICY "backend_files_policy" ON files FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "backend_ledger_policy" ON ledger_entries;
CREATE POLICY "backend_ledger_policy" ON ledger_entries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "backend_attempts_policy" ON provider_attempts;
CREATE POLICY "backend_attempts_policy" ON provider_attempts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "backend_handoffs_policy" ON handoffs;
CREATE POLICY "backend_handoffs_policy" ON handoffs FOR ALL USING (true) WITH CHECK (true);
