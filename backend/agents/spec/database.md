# Database

PostgreSQL 16. Schema managed by Drizzle migrations in `src/db/migrations`. Never edit an applied migration.

## Design decisions

- The workflow graph is stored as JSONB, not as normalised node and edge tables. The canvas always reads and writes the whole graph, joins are never needed, and node ids only have to be unique inside one workflow. Runs are normalised because they are queried per step.
- Amounts are `numeric(78, 0)` in base units. `78` covers `uint256`.
- Ids are ULIDs stored as `text`, prefixed by resource (`wf_`, `run_`, `msg_`). Sortable by creation time and safe to log.

## Tables

```sql
create table workflows (
  id           text primary key,
  owner_id     text not null,
  name         text not null,
  tokens       jsonb not null default '[]'::jsonb,
  nodes        jsonb not null default '[]'::jsonb,
  edges        jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index workflows_owner_created_idx on workflows (owner_id, created_at desc);

create table templates (
  id           text primary key,
  name         text not null,
  description  text not null,
  tokens       jsonb not null,
  kinds        jsonb not null,
  sort_order   integer not null default 0
);

create table blocks (
  kind         text primary key,
  label        text not null,
  group_name   text not null,
  description  text not null,
  subtitle     text not null,
  params       jsonb not null,
  sort_order   integer not null default 0
);

create type run_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type run_mode   as enum ('live', 'simulation');
create type step_state as enum ('running', 'success', 'failed');

create table runs (
  id             text primary key,
  workflow_id    text not null references workflows (id) on delete cascade,
  owner_id       text not null,
  status         run_status not null default 'queued',
  mode           run_mode not null,
  graph_snapshot jsonb not null,
  estimated_gas  numeric(78, 0),
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);
create index runs_workflow_created_idx on runs (workflow_id, created_at desc);
create unique index runs_one_active_per_workflow
  on runs (workflow_id) where status in ('queued', 'running') and mode = 'live';

create table run_steps (
  id           text primary key,
  run_id       text not null references runs (id) on delete cascade,
  node_id      text not null,
  kind         text not null,
  position     integer not null,
  state        step_state not null,
  tx_hash      text,
  gas_used     numeric(78, 0),
  error        text,
  started_at   timestamptz,
  finished_at  timestamptz,
  unique (run_id, position)
);
create index run_steps_run_position_idx on run_steps (run_id, position);

create table assistant_sessions (
  id         text primary key,
  owner_id   text not null,
  created_at timestamptz not null default now()
);

create table assistant_messages (
  id         text primary key,
  session_id text not null references assistant_sessions (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  text       text not null,
  created_at timestamptz not null default now()
);
create index assistant_messages_session_idx on assistant_messages (session_id, created_at);

create table workflow_drafts (
  id           text primary key,
  session_id   text not null references assistant_sessions (id) on delete cascade,
  name         text not null,
  version      integer not null,
  kinds        jsonb not null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (session_id, version)
);
```

## Notes

- `runs_one_active_per_workflow` is what makes `run_in_progress` (409) reliable under concurrency. Do not enforce it in application code only.
- `blocks` and `templates` are seed data. The seed is idempotent and runs on boot in development, and as a migration step in other environments.
- `updated_at` is maintained by the repository layer, not by a trigger, so the value is visible in the returning row.
- Cascade deletes keep run history tied to its workflow. If history has to outlive deletion, change the workflow delete to a soft delete instead of loosening the constraint.

## Environment

```
DATABASE_URL=postgres://user:pass@localhost:5432/archestra
PORT=8787
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:3000
CHAIN_ADAPTER=mock            # mock | arc
AI_PLANNER=rules              # rules | llm
```

Parsed with Zod at boot. The process exits when a required variable is missing or malformed. `.env*` is never committed.
