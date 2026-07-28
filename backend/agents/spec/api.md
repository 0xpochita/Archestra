# HTTP API

Base path `/v1`. JSON in, JSON out, UTF-8. All timestamps are ISO 8601 UTC strings.

Every request carries `x-owner-id` until wallet sessions land. Missing header returns 401.

## Conventions

- List responses are `{ "data": [...] }`. Single resources are `{ "data": {...} }`.
- Errors are `{ "error": { "code", "message", "details" } }`.
- Unknown fields in a request body are rejected, not ignored.
- `PATCH` accepts a partial body and returns the full resource.

---

## Catalog

### `GET /v1/blocks`

Returns the block catalog used by the dock, the block library, and the inspector.

```json
{ "data": [
  { "kind": "deposit", "label": "Deposit", "group": "Liquidity",
    "description": "Supply an asset into a lending pool or vault.",
    "subtitle": "Aave V3 Pool",
    "params": [
      { "id": "asset", "label": "Asset", "value": "USDC" },
      { "id": "amount", "label": "Amount", "value": "5,000" },
      { "id": "chain", "label": "Chain", "value": "Arc" }
    ] }
] }
```

Cacheable for 5 minutes. No auth required.

### `GET /v1/templates`

Returns seeded strategy templates for the gallery at `/workflows`.

```json
{ "data": [
  { "id": "stable-auto-compound", "name": "Stablecoin auto-compound",
    "description": "Supply USDC, farm the pair and reinvest rewards daily.",
    "tokens": ["usdc"], "kinds": ["approve", "deposit", "yield", "harvest"] }
] }
```

---

## Workflows

### `GET /v1/workflows`

Query: `limit` (default 20, max 100), `cursor`.

Returns workflows owned by the caller, newest first, without node and edge payloads.

### `POST /v1/workflows`

```json
{ "name": "USDC Auto-Compound Strategy", "tokens": ["usdc"],
  "nodes": [], "edges": [], "templateId": "stable-auto-compound" }
```

`templateId` is optional. When present and `nodes` is empty, the server builds the chain from the template and ignores `edges`.

Returns 201 with the full workflow.

### `GET /v1/workflows/:id`

Full graph. 404 when missing, 403 when owned by someone else.

### `PATCH /v1/workflows/:id`

Accepts any of `name`, `tokens`, `nodes`, `edges`. Sending `nodes` or `edges` replaces the whole array, which matches how the canvas edits state. Graph rules from `domain-model.md` run before the write, and a violation returns 422 `invalid_graph` with the failing rule in `details`.

### `DELETE /v1/workflows/:id`

204 on success, idempotent.

---

## Simulation

### `POST /v1/workflows/:id/simulate`

Body is empty. Runs the dry run the studio modal shows.

```json
{ "data": {
  "id": "run_01H...", "mode": "simulation", "status": "succeeded",
  "estimatedGas": "2100000000000000",
  "steps": [
    { "nodeId": "node-1", "kind": "trigger", "position": 0, "state": "success",
      "gasUsed": "0", "txHash": null, "error": null }
  ] } }
```

Rules:

- The step order equals the execution order in `domain-model.md`.
- Nothing is broadcast. `txHash` is always `null` in simulation mode.
- 422 `empty_workflow` when the graph has no nodes.
- The response is stored as a run with `mode = "simulation"` so it appears in history.

---

## Runs

### `POST /v1/workflows/:id/runs`

Starts a live run. Returns 202 with the run in `queued` state.

```json
{ "data": { "id": "run_01H...", "status": "queued", "mode": "live", "steps": [] } }
```

### `GET /v1/workflows/:id/runs`

Paginated history, newest first, both modes.

### `GET /v1/runs/:id`

Run with steps.

### `GET /v1/runs/:id/events`

Server sent events so the canvas can light nodes up while a run progresses.

```
event: step
data: { "nodeId": "node-2", "state": "running", "position": 1 }

event: step
data: { "nodeId": "node-2", "state": "success", "txHash": "0x...", "gasUsed": "84000" }

event: done
data: { "status": "succeeded" }
```

The stream closes after `done` or `error`. Clients reconnect with `Last-Event-ID`.

---

## Assistant

### `POST /v1/assistant/sessions`

Creates a session and returns its id. Sessions are per user and disposable.

### `POST /v1/assistant/sessions/:id/messages`

```json
{ "text": "Auto-compound my USDC yield" }
```

Response contains the user message, the assistant reply, and the draft:

```json
{ "data": {
  "messages": [
    { "id": "msg_1", "role": "user", "text": "Auto-compound my USDC yield" },
    { "id": "msg_2", "role": "assistant", "text": "Drafted 5 blocks: Start then Approve Token then Deposit then Yield Farm then Harvest Rewards. Accept the workflow to drop it on the canvas, or ask for changes." }
  ],
  "draft": { "id": "draft_1", "name": "Approve Token to Harvest Rewards flow", "version": 1,
             "kinds": ["trigger", "approve", "deposit", "yield", "harvest"] } } }
```

Planning is deterministic in phase 1. See `mocks.md`.

### `POST /v1/assistant/drafts/:id/accept`

Creates a workflow from the draft chain and returns it. The draft is marked accepted and cannot be accepted twice (409 `draft_already_accepted`).

### `DELETE /v1/assistant/sessions/:id`

Clears the conversation, matching the "Clear chat" button.

---

## Health

### `GET /v1/health`

```json
{ "data": { "status": "ok", "database": "ok", "uptimeSeconds": 1234 } }
```

Returns 503 when the database check fails.

---

## Error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `unauthorized` | 401 | missing or unknown owner |
| `forbidden` | 403 | resource belongs to another owner |
| `not_found` | 404 | unknown id |
| `validation_failed` | 400 | body, query, or params failed schema parsing |
| `invalid_graph` | 422 | cycle, dangling edge, or duplicate node id |
| `empty_workflow` | 422 | run or simulate with zero nodes |
| `run_in_progress` | 409 | a live run is already active for the workflow |
| `draft_already_accepted` | 409 | draft was consumed |
| `rate_limited` | 429 | too many requests |
| `internal_error` | 500 | unexpected failure, correlate with the logged request id |
