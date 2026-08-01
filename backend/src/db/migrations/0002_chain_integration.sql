-- Migration: 0002_chain_integration
-- Adds chain integration columns for on-chain workflow and run tracking.

ALTER TABLE workflows
  ADD COLUMN onchain_id numeric(78, 0),
  ADD COLUMN vault_address text;

CREATE INDEX workflows_onchain_id_idx ON workflows (onchain_id) WHERE onchain_id IS NOT NULL;

ALTER TABLE runs
  ADD COLUMN tx_hash text,
  ADD COLUMN onchain_run_id text,
  ADD COLUMN total_gas_used numeric(78, 0),
  ADD COLUMN stopped boolean NOT NULL DEFAULT false,
  ADD COLUMN caller_address text,
  ADD COLUMN error_code text;

CREATE INDEX runs_tx_hash_idx ON runs (tx_hash) WHERE tx_hash IS NOT NULL;
CREATE INDEX runs_onchain_run_id_idx ON runs (onchain_run_id) WHERE onchain_run_id IS NOT NULL;

ALTER TABLE run_steps
  ADD COLUMN token_out text,
  ADD COLUMN amount_out numeric(78, 0);

CREATE TABLE workflow_id_map (
  onchain_id numeric(78, 0) PRIMARY KEY,
  workflow_id text NOT NULL UNIQUE REFERENCES workflows (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
