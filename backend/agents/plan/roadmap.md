# Backend Roadmap

Five milestones. Each one ends with something the studio can call.

## M0 - Skeleton (1 day)

Hono app, config parsing, logger, error middleware, `/v1/health`, Dockerised PostgreSQL, Drizzle wired, CI running lint, type-check, and tests.

Exit: `GET /v1/health` returns 200 locally and in CI.

## M1 - Catalog (1 day)

`blocks` and `templates` tables, seed, `GET /v1/blocks`, `GET /v1/templates`.

Exit: the frontend can drop its hardcoded `BLOCK_CATALOG` and `STRATEGY_TEMPLATES` and render from the API with no visual change.

## M2 - Workflow CRUD (2 days)

Workflows table, graph validation, list, create, read, update, delete, template instantiation.

Exit: the canvas saves and reloads a graph across a refresh, and an invalid graph is rejected with `invalid_graph`.

## M3 - Simulation and runs (3 days)

Runs and steps tables, `ChainAdapter` port with `MockChainAdapter`, simulate endpoint, run endpoint, SSE stream, history.

Exit: the Simulate modal and the Run strategy button are driven by the API, and the canvas lights nodes from the SSE stream.

## M4 - Assistant (2 days)

Sessions, messages, drafts, `RulesPlanner`, accept endpoint.

Exit: the Generate Workflows with AI modal talks to the API, and Accept Workflow creates a real workflow.

## M5 - Hardening (2 days)

Rate limits, pagination everywhere, request ids in every log line, OpenAPI document generated from the Zod schemas, load check on simulate.

Exit: the checklist in `agents/rules/rules.template.md` section 11 passes for every endpoint.

## Out of scope for now

Wallet auth, real chain execution, LLM planning, multi tenant billing, websockets. Each one has a port already so it lands without a rewrite.
