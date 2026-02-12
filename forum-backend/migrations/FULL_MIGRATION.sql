-- ================================================================
-- K.I.T. FULL MIGRATION - Run this in Supabase SQL Editor
-- This creates all necessary tables and columns for the Journal
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. USERS TABLE (GitHub Users)
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    name VARCHAR(200),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);

-- ================================================================
-- 2. PLATFORM CONNECTIONS (Store encrypted credentials)
-- ================================================================
CREATE TABLE IF NOT EXISTS platform_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    credentials JSONB NOT NULL,
    broker VARCHAR(100),
    account_type VARCHAR(20) DEFAULT 'live',
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_connections_user_id ON platform_connections(user_id);

-- ================================================================
-- 3. JOURNAL ACCOUNTS (Trading accounts per user)
-- ================================================================
-- First ensure the table exists with basic structure
CREATE TABLE IF NOT EXISTS journal_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    broker VARCHAR(100),
    account_type VARCHAR(20) DEFAULT 'demo',
    initial_balance DECIMAL(15,2) DEFAULT 10000,
    currency VARCHAR(10) DEFAULT 'USD',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add all required columns (IF NOT EXISTS prevents errors if they already exist)
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'manual';
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS prop_firm_name VARCHAR(100);
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS profit_target DECIMAL(15,2);
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS profit_target_progress DECIMAL(10,2) DEFAULT 0;
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS max_daily_loss DECIMAL(15,2);
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS current_daily_loss DECIMAL(10,2) DEFAULT 0;
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS max_total_drawdown DECIMAL(15,2);
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS current_drawdown DECIMAL(10,2) DEFAULT 0;
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS challenge_phase VARCHAR(50);
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES platform_connections(id);
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS is_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS current_balance DECIMAL(15,2) DEFAULT 10000;
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS total_trades INTEGER DEFAULT 0;
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS winning_trades INTEGER DEFAULT 0;
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS losing_trades INTEGER DEFAULT 0;
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS total_pnl DECIMAL(15,2) DEFAULT 0;
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS win_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS profit_factor DECIMAL(10,2) DEFAULT 0;
ALTER TABLE journal_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_journal_accounts_user_id ON journal_accounts(user_id);

-- ================================================================
-- 4. JOURNAL ENTRIES (Trades)
-- ================================================================
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES journal_accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    quantity DECIMAL(20,8) NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add all required columns
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS exit_price DECIMAL(20,8);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS stop_loss DECIMAL(20,8);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS take_profit DECIMAL(20,8);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS risk_amount DECIMAL(15,2);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS r_multiple DECIMAL(10,2);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS setup VARCHAR(100);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS strategy VARCHAR(100);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS timeframe VARCHAR(20);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS emotion VARCHAR(50);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS emotion_notes TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_reason TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS exit_reason TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS lesson_learned TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS mistake VARCHAR(100);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS screenshot_entry TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS screenshot_exit TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_time TIMESTAMPTZ;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS exit_time TIMESTAMPTZ;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS pnl DECIMAL(15,2);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS pnl_percent DECIMAL(10,2);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS is_win BOOLEAN;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS external_id VARCHAR(100);
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_account_id ON journal_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_time ON journal_entries(entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_external_id ON journal_entries(external_id);

-- ================================================================
-- 5. ENABLE ROW LEVEL SECURITY (Optional but recommended)
-- ================================================================
-- These policies allow the service role full access
-- In production, you'd add more granular policies

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Service role full access users" ON users;
DROP POLICY IF EXISTS "Service role full access connections" ON platform_connections;
DROP POLICY IF EXISTS "Service role full access accounts" ON journal_accounts;
DROP POLICY IF EXISTS "Service role full access entries" ON journal_entries;

-- Create service role policies
CREATE POLICY "Service role full access users" ON users 
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access connections" ON platform_connections 
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access accounts" ON journal_accounts 
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access entries" ON journal_entries 
    FOR ALL USING (auth.role() = 'service_role');

-- ================================================================
-- DONE! Your K.I.T. Journal database is now ready.
-- ================================================================
SELECT 'Migration complete! Tables created/updated successfully.' as status;
