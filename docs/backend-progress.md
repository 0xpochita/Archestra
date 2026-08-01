# Backend Progress & Next Steps

Progress log for the Archestra backend, covering the initial mock backend delivery and the follow-up Arc testnet chain integration.

**Last updated:** 2026-08-01

---

## Overview

| | |
|---|---|
| Location | `backend/` |
| Stack | Hono, Node.js 22, PostgreSQL 16, Drizzle ORM, Zod, TypeScript strict, Biome, Vitest, viem |
| Local dev URL | `http://localhost:8787` |
| VPS URL | `http://43.157.204.55:8787` |
| Chain (arc mode) | Arc Testnet (chainId `5042002`) |
| Registry | `0x88d8Cd3009cd7905ec0E7f895c772Edd9878b42F` |
| Test coverage | 33 unit tests, all passing |
| Lint / type-check | Clean |

---

## Phase 1 — Initial Backend (Complete)

All 22 tasks `BE-01` through `BE-22` delivered. Mock-mode backend is production-ready.

### Endpoints shipped

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/health` | Public | DB probe, returns 503 on DB failure |
| GET | `/v1/blocks` | Public | 10 block catalog, cache 5 min |
| GET | `/v1/templates` | Public | 8 strategy templates, cache 5 min |
| GET | `/v1/workflows` | `x-owner-id` | Cursor-paginated list |
| POST | `/v1/workflows` | `x-owner-id` | Optional `templateId` to seed nodes/edges |
| GET | `/v1/workflows/:id` | `x-owner-id` | Owner-scoped |
| PATCH | `/v1/workflows/:id` | `x-owner-id` | Partial updates, re-validates graph |
| DELETE | `/v1/workflows/:id` | `x-owner-id` | Cascades to runs |
| POST | `/v1/workflows/:id/simulate` | `x-owner-id` | Returns full simulated run |
| POST | `/v1/workflows/:id/runs` | `x-owner-id` | Starts live run (mock or arc) |
| GET | `/v1/workflows/:id/runs` | `x-owner-id` | Run history |
| GET | `/v1/runs/:id` | `x-owner-id` | Run detail with steps |
| GET | `/v1/runs/:id/events` | `x-owner-id` | SSE stream |
| POST | `/v1/assistant/sessions` | `x-owner-id` | Create AI session |
| DELETE | `/v1/assistant/sessions/:id` | `x-owner-id` | Delete session |
| POST | `/v1/assistant/sessions/:id/messages` | `x-owner-id` | Send message, returns draft |
| POST | `/v1/assistant/drafts/:id/accept` | `x-owner-id` | Accept draft as workflow |
| GET | `/v1/openapi.json` | Public | OpenAPI 3.0 spec |
| GET | `/v1/docs` | Public | Scalar API reference UI |

### Middleware stack

1. `request-id` — inject `x-request-id` header (ULID if missing)
2. `logger` — structured JSON logs with `requestId`, `method`, `path`, `status`, `durationMs`
3. `cors` — origin allowlist from `CORS_ORIGINS`
4. `auth` — reject requests without `x-owner-id` (non-public routes only)
5. `rate-limit` — default 100/min, strict 10/min for simulate/runs/assistant
6. `error` — normalized `AppError` responses, ZodError handling

### Domain logic

- `validateGraph()` — cycle detection (Kahn), dangling edges, duplicate IDs, multi-trigger, trigger-with-incoming
- `getExecutionOrder()` — topological sort preserving insertion order for tie-breaking
- `planFromPrompt()` — rules-based AI planner mapping keywords to canonical block sequences

### Tests

| Suite | Count |
|---|---|
| `domain/graph.test.ts` | 14 |
| `domain/planner.test.ts` | 7 |
| `chain/decode-run.test.ts` | 5 |
| `chain/errors.test.ts` | 7 |
| **Total** | **33** |

---

## Phase 2 — Arc Chain Integration (17 of 18 tasks complete)

### Trigger for this phase

Frontend already integrated with Arc testnet contracts via wagmi/viem (see `plan/report/report.md`). Backend mock model did not match on-chain reality:

1. **A run is one atomic transaction** — cannot execute step-by-step with delays
2. **Backend has no private key** — user's wallet signs and broadcasts
3. **No per-step `txHash` or `gasUsed`** — only run-level totals exist
4. **Session layer** — vault requires executor acceptance + spending sessions per token before any run
5. **Event rename** — `ExecutorChanged` replaced by `ExecutorPublished` + `ExecutorRetired`

### What was built

**Chain layer (`backend/src/chain/`):**

| File | Purpose |
|---|---|
| `client.ts` | viem `publicClient` for Arc testnet |
| `encode-steps.ts` | Encode workflow into contract `Step[]` (mirrors frontend) |
| `decode-run.ts` | Decode transaction receipt → run outcome + steps |
| `errors.ts` | Decode custom revert errors to frontend-friendly codes |
| `step-types.ts` | Map `stepType` uint8 ↔ `BlockKind` |
| `generated/` | ABIs + addresses copied from `contracts/exports/` |

**New schema (`backend/src/schemas/step-config.ts`):**

Zod discriminated union `StepConfig` for all 10 block kinds, mirroring the frontend contract. `WorkflowNode` now carries an optional `config` field alongside legacy `params` for backward compatibility.

**DB migration `0002_chain_integration.sql`:**

- `workflows.onchain_id numeric(78,0)` (nullable uint256)
- `workflows.vault_address text`
- `runs.tx_hash text`, `runs.onchain_run_id text` (bytes32), `runs.total_gas_used numeric(78,0)`, `runs.stopped boolean`, `runs.caller_address text`, `runs.error_code text`
- `run_steps.token_out text`, `run_steps.amount_out numeric(78,0)`
- New table `workflow_id_map` for dual-ID lookup

**Adapters:**

| Adapter | Mode | Responsibilities |
|---|---|---|
| `MockChainAdapter` | `mock` | Original behaviour — execute steps sequentially with 700ms delay |
| `ArcChainAdapter` | `arc` | Build calldata via `encodeFunctionData(run(workflowId))`, read receipt, decode events |

Selected via env `CHAIN_ADAPTER=mock` or `CHAIN_ADAPTER=arc`.

**New env vars:**

```env
RPC_URL=https://rpc.testnet.arc.io
CHAIN_ID=5042002
REGISTRY_ADDRESS=0x88d8Cd3009cd7905ec0E7f895c772Edd9878b42F
```

**New / changed endpoints:**

- `POST /v1/workflows/:id/runs` (live mode) — returns `{ run, call: {to, data, chainId}, requiresWalletSignature: true }`. Backend does **not** broadcast.
- `POST /v1/runs/:id/tx` — frontend reports `{txHash}` after wallet broadcast. Backend spawns a background receipt watcher via `setImmediate`.
- `GET /v1/onchain/summary?address=0x...` — aggregates vault + session + executor state directly from chain reads.
- `PATCH /v1/workflows/:id` now accepts `onchainId` and `vaultAddress` for wf_ULID ↔ uint256 mapping.
- SSE stream `/v1/runs/:id/events` supports batch mode (all step events from receipt broadcast at once once the receipt arrives).

### Custom error decoding

| Revert selector | Mapped code | Purpose |
|---|---|---|
| `NoActiveSession(address)` | `session_required` | Prompt user to open a session |
| `SessionCapExceeded(address,uint256,uint256)` | `session_cap_exceeded` | Prompt user to raise or extend cap |
| `ExecutorNotAccepted(address,address)` | `executor_approval_required` | Prompt user to accept latest executor |
| `DeadlinePassed(uint64)` | `deadline_passed` | Regenerate swap deadline |
| `InsufficientOutput(uint256,uint256)` | `insufficient_output` | Adjust slippage |
| ...15 more | See `backend/src/chain/errors.ts` | |

---

## End-to-End Verification (local dev)

Completed:

1. ✅ Backend running with `CHAIN_ADAPTER=arc` — startup log confirms mode
2. ✅ `GET /v1/onchain/summary?address=0x5D3Ac56e...` — successfully read vault, executor version, and session limits per token from Arc RPC
3. ✅ Workflow create → `PATCH onchainId=1` → `POST /v1/workflows/:id/runs` — returned valid calldata:
   - `to`: `0xde0733d8...` (Executor from registry)
   - `data`: selector `0xa444f5e9` (`run(uint256)`) + `...001`
   - `chainId`: `5042002`
4. ✅ `POST /v1/runs/:id/tx` with fixture txHash — attach + background watcher pipeline works. `totalGasUsed=685001` matches fixture exactly. Steps decoded as empty (expected — fixture emitter is a retired executor).

Not yet completed:

- ❌ Full live run with real wallet — blocked on RPC rate limit during `mint()` and vault reads in local dev. Backend integration path is verified; the blocker is the frontend RPC configuration.

---

## What Was Skipped

- **BE-INT-17** (update seed catalog with default `config`): skipped because backward compatibility is fine. `WorkflowNode` accepts both `params` (legacy) and `config` (new).

---

## Architecture Decision

**Chosen: backend-mediated architecture.**

All frontend → chain traffic should flow through the backend:

- Backend builds calldata (frontend never encodes steps)
- Backend indexes events (frontend consumes SSE for animation)
- Backend caches on-chain reads (frontend reads via `/onchain/summary`)

Frontend still calls contracts directly today — the wiring to new backend endpoints is pending.

---

## Next Steps

### Immediate (blocking for frontend integration)

1. **Frontend integration.** Frontend team must:
   - Update `useWorkflowRun`: after `WorkflowRegistry.create`, PATCH backend `workflows/:id` with `{onchainId}`
   - Replace direct `Executor.run()` call with:
     `POST /v1/workflows/:id/runs` → obtain calldata → wallet signs → `POST /v1/runs/:id/tx`
   - Consume SSE `/v1/runs/:id/events` for canvas animation
   - (Optional) replace ad-hoc vault reads with `GET /v1/onchain/summary?address=...` for caching

2. **Deploy backend to VPS.** Local build is verified. Steps:
   - `git push` / `scp` the new code
   - Update VPS `.env`: add `CHAIN_ADAPTER=arc`, `RPC_URL`, `CHAIN_ID`, `REGISTRY_ADDRESS`
   - Rebuild: `docker-compose build`
   - Restart: `docker-compose up -d`
   - Run migration 0002: `docker-compose exec backend node dist/db/migrate.js`

3. **RPC rate-limit mitigation.** Frontend hits limits often on `rpc.testnet.arc.io`. Workaround:
   - Set `NEXT_PUBLIC_ARC_RPC_URL` in `frontend/.env.local` to a fallback:
     `https://arc-testnet.drpc.org` or `https://rpc.blockdaemon.testnet.arc.network`
   - Backend uses `batch: true` and is less affected.

### Short-term (post-integration)

4. **End-to-end walkthrough.** Once FE is wired:
   - Connect wallet → mint dUSDC → create vault → open session → fund vault → create workflow on-chain → simulate → run → verify backend indexer fills `run_steps` correctly → SSE streams events to canvas

5. **OpenAPI docs update.** Add to spec:
   - `POST /v1/runs/:id/tx`
   - `GET /v1/onchain/summary`
   - Extend `POST /v1/workflows/:id/runs` response schema with `call` object and `requiresWalletSignature` flag

6. **Update backend README.** New sections:
   - Chain integration overview
   - Env vars for arc mode
   - Live run flow diagram
   - Error code reference

### Longer-term (production hardening)

7. **Receipt watcher robustness.** Currently uses `setImmediate` + direct `getTransactionReceipt`. Improvements:
   - Handle unmined tx: use `waitForTransactionReceipt` with timeout
   - Retry on RPC failure with exponential backoff
   - Persistent job queue so watchers survive restart (currently in-memory)

8. **Executor cache invalidation.** Backend caches the executor address from `registry.executor()`. Needs a listener for `ExecutorPublished` / `ExecutorRetired` events to auto-reload. Currently manual via `invalidateExecutorCache()`.

9. **Per-endpoint rate limits.** Chain-touching endpoints (`/onchain/summary`, `/runs/:id/tx`) may need their own rate limits because each request hits RPC.

10. **Metrics + observability.** Add counters for: total runs per status, watcher failures, RPC latency, DB query time. Structured logs already exist — wire them to Prometheus/Grafana.

11. **BE-INT-17 follow-up.** Update `db/seed.ts` so block catalog and templates ship with default `config` (not the legacy `params` label/value). Lets FE create workflows from templates without hand-populating configs.

12. **Contract dependency: MockAggregator.** The `condition` block cannot run on Arc testnet because `MockAggregator` has not been deployed. Backend handles this gracefully (encoder rejects `feed=zeroAddress`), but UX suffers. Escalate to the contracts team.

---

## Quick Reference

### Env vars

| Var | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — | Required |
| `PORT` | `8787` | HTTP port |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated |
| `CHAIN_ADAPTER` | `mock` | `mock` or `arc` |
| `AI_PLANNER` | `rules` | `rules` or `llm` |
| `RPC_URL` | `https://rpc.testnet.arc.io` | Only used when `CHAIN_ADAPTER=arc` |
| `CHAIN_ID` | `5042002` | Arc testnet |
| `REGISTRY_ADDRESS` | `0x88d8Cd3009cd7905ec0E7f895c772Edd9878b42F` | Only address the backend needs |

### Endpoint summary

Grouped by domain:

- **Health / docs (public):** `/health`, `/blocks`, `/templates`, `/openapi.json`, `/docs`
- **Workflows:** CRUD under `/workflows`
- **Runs:** `POST /workflows/:id/simulate`, `POST /workflows/:id/runs`, `GET /workflows/:id/runs`, `GET /runs/:id`, `POST /runs/:id/tx`, `GET /runs/:id/events`
- **Assistant:** `POST /assistant/sessions`, `DELETE /assistant/sessions/:id`, `POST /assistant/sessions/:id/messages`, `POST /assistant/drafts/:id/accept`
- **Chain reads:** `GET /onchain/summary?address=0x...`

### Auth

All non-public routes require `x-owner-id: <opaque-string>` header. Public routes: `/health`, `/blocks`, `/templates`, `/openapi.json`, `/docs`.

### Error envelope

```json
{
  "error": {
    "code": "session_required",
    "message": "Session required for this token",
    "details": {}
  }
}
```

---

## Known Issues

1. **RPC rate limit on `rpc.testnet.arc.io`.** Frontend `writeContract` and `readContract` calls get throttled with `Request is being rate limited`. Mitigated by setting `NEXT_PUBLIC_ARC_RPC_URL` to a fallback endpoint. Not a backend bug.

2. **`condition` block unusable on Arc testnet.** `MockAggregator` is not deployed. Encoder rejects `feed=zeroAddress` early with a clear error. Templates `guarded-exit` and `risk-off-unwind` cannot be executed end-to-end. Requires contracts team action.

3. **Fixture txHash from retired deployment.** `contracts/exports/fixtures/run-fixture.json` was captured pre-session-layer. `readRun()` filters events by the current executor address, so fixture events do not decode against the live executor. Fixture is still valid for unit tests (event shape parity).

4. **Executor address cache is not auto-refreshed.** Backend caches the result of `registry.executor()` in-memory. If contracts team publishes a new executor, backend must be restarted or `invalidateExecutorCache()` must be called manually. Event listener for `ExecutorPublished` / `ExecutorRetired` is not yet implemented.

5. **Receipt watcher is in-memory.** If the backend restarts mid-watch, the run stays stuck in `queued` or `running`. No recovery job on boot. Acceptable for hackathon, must fix before production.
