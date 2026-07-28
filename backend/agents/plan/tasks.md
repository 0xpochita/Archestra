# Backend Tasks

Each task is one pull request. Acceptance criteria are the review checklist. `BE-x` ids are stable, do not renumber.

## M0 - Skeleton

### BE-01 Project setup
Scope: pnpm workspace, TypeScript strict, Biome, vitest, Dockerfile, `docker-compose.yml` with PostgreSQL 16.
Accept: `pnpm lint`, `pnpm type-check`, `pnpm test` all pass on an empty suite. CI runs the three.

### BE-02 App shell
Scope: `app.ts` with Hono, request id middleware, JSON logger, CORS from config, error middleware mapping to the shape in `spec/api.md`.
Accept: unknown route returns 404 `not_found`, a thrown error returns 500 `internal_error` with a logged request id and no stack trace in the body.

### BE-03 Config and health
Scope: Zod parsed env, `GET /v1/health` with separate database check.
Accept: missing `DATABASE_URL` exits at boot with a readable message. Health returns 503 when PostgreSQL is down.

## M1 - Catalog

### BE-04 Drizzle and migrations
Scope: Drizzle setup, migration runner, `blocks` and `templates` tables from `spec/database.md`.
Accept: migration applies to an empty database and is not edited afterwards.

### BE-05 Seed
Scope: idempotent seed for the ten block kinds and the eight templates.
Accept: running the seed twice leaves the same row count. Values match `spec/domain-model.md` exactly.

### BE-06 Catalog endpoints
Scope: `GET /v1/blocks`, `GET /v1/templates`, cache headers.
Accept: response bodies match the examples in `spec/api.md` field for field.

## M2 - Workflow CRUD

### BE-07 Workflow schema and repository
Scope: `workflows` table, Zod schemas for node, edge, and workflow, repository with owner scoping.
Accept: a workflow belonging to another owner returns 403, never 404 leaking existence to the wrong user.

### BE-08 Graph validation
Scope: pure `validateGraph` in `domain/`, the four rules in `spec/domain-model.md`.
Accept: unit tests cover dangling edge, cycle, duplicate node id, two triggers, and trigger with an incoming edge. Each returns 422 `invalid_graph` with the failing rule in `details`.

### BE-09 Execution order
Scope: pure `getExecutionOrder`, Kahn with insertion order tie break, unreached nodes appended.
Accept: property test asserts every node appears exactly once. A fixture copied from the studio's demo graph produces the identical order to the frontend.

### BE-10 CRUD endpoints
Scope: list with cursor pagination, create with optional `templateId`, read, patch, delete.
Accept: creating from `stable-auto-compound` produces four nodes at `x = 60, 440, 820, 1200`, `y = 300`, and three edges labelled `1`, `2`, `3`.

## M3 - Simulation and runs

### BE-11 Chain port
Scope: `ChainAdapter` interface, `MockChainAdapter`, gas table, injected clock and id generator, `mockFail` injection.
Accept: two runs with the same run id produce identical hashes and gas. No `Math.random` or `Date.now` in the adapter.

### BE-12 Runs schema
Scope: `runs` and `run_steps` tables, partial unique index for one active live run.
Accept: two concurrent live run requests for one workflow result in exactly one run and one 409 `run_in_progress`.

### BE-13 Simulate endpoint
Scope: `POST /v1/workflows/:id/simulate`, persisted as `mode = simulation`, gas estimate, ordered steps.
Accept: `txHash` is null on every step. Empty workflow returns 422 `empty_workflow`. The run appears in history.

### BE-14 Run execution
Scope: `POST /v1/workflows/:id/runs`, background execution walking the order, step rows updated as it progresses, failure marks the run failed and stops.
Accept: a `mockFail` step leaves the run `failed`, the failing step `failed`, and later steps untouched.

### BE-15 SSE stream
Scope: `GET /v1/runs/:id/events`, `step`, `done`, and `error` events, `Last-Event-ID` resume.
Accept: a client connecting mid run receives the remaining steps and a terminal event. Connection closes cleanly on completion.

### BE-16 Run history
Scope: `GET /v1/workflows/:id/runs`, `GET /v1/runs/:id`.
Accept: both modes appear, newest first, paginated.

## M4 - Assistant

### BE-17 Sessions and messages
Scope: session create and delete, message append, ordered history.
Accept: deleting a session removes its messages and drafts.

### BE-18 Rules planner
Scope: `PlannerAdapter`, `RulesPlanner`, keyword table, prerequisites, canonical order, reply text, draft naming.
Accept: the three studio suggestions produce exactly the chains listed in `spec/domain-model.md`. Same prompt, same output, every time.

### BE-19 Draft accept
Scope: `POST /v1/assistant/drafts/:id/accept` building a workflow from the chain.
Accept: accepting twice returns 409 `draft_already_accepted`. The created workflow uses the draft name and matches the template layout rules.

## M5 - Hardening

### BE-20 Rate limiting
Scope: per owner limits, stricter on simulate, run, and assistant.
Accept: exceeding the limit returns 429 `rate_limited` with `Retry-After`.

### BE-21 OpenAPI
Scope: generate the document from the Zod schemas, serve at `/v1/openapi.json`.
Accept: every endpoint in `spec/api.md` is present with request and response schemas.

### BE-22 Frontend handoff
Scope: publish shared schema types, write a short integration note for the studio team.
Accept: the frontend imports request and response types instead of redeclaring them.
