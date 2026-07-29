-- Migration: 0001_initial
-- Creates all tables for the Archestra backend

CREATE TYPE run_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');
CREATE TYPE run_mode AS ENUM ('live', 'simulation');
CREATE TYPE step_state AS ENUM ('running', 'success', 'failed');

CREATE TABLE workflows (
  id           text PRIMARY KEY,
  owner_id     text NOT NULL,
  name         text NOT NULL,
  tokens       jsonb NOT NULL DEFAULT '[]'::jsonb,
  nodes        jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workflows_owner_created_idx ON workflows (owner_id, created_at DESC);

CREATE TABLE templates (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  description  text NOT NULL,
  tokens       jsonb NOT NULL,
  kinds        jsonb NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0
);

CREATE TABLE blocks (
  kind         text PRIMARY KEY,
  label        text NOT NULL,
  group_name   text NOT NULL,
  description  text NOT NULL,
  subtitle     text NOT NULL,
  params       jsonb NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0
);

CREATE TABLE runs (
  id             text PRIMARY KEY,
  workflow_id    text NOT NULL REFERENCES workflows (id) ON DELETE CASCADE,
  owner_id       text NOT NULL,
  status         run_status NOT NULL DEFAULT 'queued',
  mode           run_mode NOT NULL,
  graph_snapshot jsonb NOT NULL,
  estimated_gas  numeric(78, 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz
);
CREATE INDEX runs_workflow_created_idx ON runs (workflow_id, created_at DESC);
CREATE UNIQUE INDEX runs_one_active_per_workflow
  ON runs (workflow_id) WHERE status IN ('queued', 'running') AND mode = 'live';

CREATE TABLE run_steps (
  id           text PRIMARY KEY,
  run_id       text NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  node_id      text NOT NULL,
  kind         text NOT NULL,
  position     integer NOT NULL,
  state        step_state NOT NULL,
  tx_hash      text,
  gas_used     numeric(78, 0),
  error        text,
  started_at   timestamptz,
  finished_at  timestamptz,
  UNIQUE (run_id, position)
);
CREATE INDEX run_steps_run_position_idx ON run_steps (run_id, position);

CREATE TABLE assistant_sessions (
  id         text PRIMARY KEY,
  owner_id   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assistant_messages (
  id         text PRIMARY KEY,
  session_id text NOT NULL REFERENCES assistant_sessions (id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assistant_messages_session_idx ON assistant_messages (session_id, created_at);

CREATE TABLE workflow_drafts (
  id           text PRIMARY KEY,
  session_id   text NOT NULL REFERENCES assistant_sessions (id) ON DELETE CASCADE,
  name         text NOT NULL,
  version      integer NOT NULL,
  kinds        jsonb NOT NULL,
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, version)
);

CREATE TABLE schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (version) VALUES ('0001_initial');
