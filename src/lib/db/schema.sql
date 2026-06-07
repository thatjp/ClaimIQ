-- Enable pgvector extension (required for embedding column)
-- Run: CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  state TEXT NOT NULL,
  policy_type TEXT NOT NULL,
  date_of_loss DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS claims_user_id_idx ON claims(user_id);
CREATE INDEX IF NOT EXISTS claims_status_idx ON claims(status);

CREATE TABLE IF NOT EXISTS claim_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  estimated_age NUMERIC,
  quantity INTEGER NOT NULL DEFAULT 1,
  adjuster_notes TEXT,
  price NUMERIC,
  price_sources JSONB,
  price_cached_at TIMESTAMPTZ,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  flag_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS claim_items_claim_id_idx ON claim_items(claim_id);

-- Requires pgvector extension (CREATE EXTENSION IF NOT EXISTS vector;)
CREATE TABLE IF NOT EXISTS item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  condition TEXT NOT NULL,
  price NUMERIC NOT NULL,
  sources JSONB,
  embedding vector(512),
  price_source TEXT,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, brand, condition)
);

CREATE INDEX IF NOT EXISTS item_prices_cached_at_idx ON item_prices(cached_at);
CREATE INDEX IF NOT EXISTS item_prices_embedding_idx ON item_prices USING ivfflat (embedding vector_cosine_ops);
