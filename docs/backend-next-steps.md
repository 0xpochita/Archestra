# Backend Next Steps

Actionable roadmap for the Archestra backend. Grouped by priority. Each item lists context, acceptance criteria, and rough effort.

**Last updated:** 2026-08-01
**Companion doc:** [`backend-progress.md`](./backend-progress.md)

---

## Priority Legend

| Symbol | Meaning |
|---|---|
| 🔴 | Blocking — nothing else moves until this is done |
| 🟡 | Should be done this sprint |
| 🟢 | Backlog — nice to have or production hardening |

---

## Immediate (Blocking)

### 🔴 NS-01 — Frontend integration to backend endpoints

**Owner:** Frontend team
**Effort:** M (1-2 days)

Frontend currently calls contracts directly via wagmi/viem. Rewire to backend-mediated flow.

**Tasks:**

1. After `WorkflowRegistry.create()` succeeds on chain, PATCH backend:
   ```
   PATCH /v1/workflows/:id
   { "onchainId": "1", "vaultAddress": "0x..." }
   ```
2. Replace direct `Executor.run()` call with:
   ```
   POST /v1/workflows/:id/runs
   → response.call = { to, data, chainId }
   → wallet.sendTransaction(call)
   → obtain txHash
   POST /v1/runs/:id/tx
   { "txHash": "0x..." }
   ```
3. Consume SSE `/v1/runs/:id/events` for canvas animation instead of `useWaitForTransactionReceipt`.
4. (Optional) Replace direct vault reads with `GET /v1/onchain/summary?address=0x...` for caching.

**Acceptance:**
- User can complete a full run without any frontend contract write except `wallet.sendTransaction(call)`.
- Canvas animation is driven by SSE events, not local timers.

---

### 🔴 NS-02 — Deploy backend v2 to VPS

**Owner:** Backend/DevOps
**Effort:** S (30 min)

Local build with `CHAIN_ADAPTER=arc` is verified. Push to production.

**Tasks:**

1. `git push` or `scp` the latest backend to VPS.
2. Update `.env` on VPS:
   ```env
   CHAIN_ADAPTER=arc
   RPC_URL=https://rpc.testnet.arc.io
   CHAIN_ID=5042002
   REGISTRY_ADDRESS=0x88d8Cd3009cd7905ec0E7f895c772Edd9878b42F
   ```
3. Rebuild image: `docker-compose build`
4. Restart: `docker-compose up -d`
5. Run migration 0002: `docker-compose exec backend node dist/db/migrate.js`
6. Verify: `curl http://43.157.204.55:8787/v1/health` → `status: ok`
7. Verify chain reads: `curl "http://43.157.204.55:8787/v1/onchain/summary?address=0xc355C11Ab8CDBeF9cd515aCe678F421133C2B764" -H "x-owner-id: test"`

**Acceptance:**
- VPS returns valid vault/session data from Arc chain.
- Migration 0002 applied cleanly.

---

### 🔴 NS-03 — RPC rate-limit workaround

**Owner:** Frontend team (backend already handles it)
**Effort:** S (5 min)

`rpc.testnet.arc.io` throttles `writeContract` and `readContract` frequently.

**Tasks:**

1. Create `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_ARC_RPC_URL=https://arc-testnet.drpc.org
   ```
2. Restart FE dev server.
3. Confirm no more `Request is being rate limited` errors during mint/read.

**Alternative RPCs (ranked):**
- `https://arc-testnet.drpc.org` ✓ CORS `*`, stable
- `https://rpc.blockdaemon.testnet.arc.network` ✓ CORS `*`
- `https://rpc.quicknode.testnet.arc.network` ✓ CORS present

**Acceptance:**
- FE mint + vault read work without rate-limit errors.

---

## Short-term (This Sprint)

### 🟡 NS-04 — End-to-end walkthrough on Arc testnet

**Owner:** Both teams + QA
**Effort:** M (half day)

Once NS-01 and NS-02 are done, run the full happy path.

**Script:**

1. Connect wallet → mint dUSDC → create vault
2. Open session for dUSDC (maxPerRun 1000, maxPerDay 5000, 7 days)
3. Fund vault with 100 dUSDC
4. Create workflow from `stable-auto-compound` template
5. Publish workflow on-chain → backend receives `onchainId`
6. Simulate → verify all step gas estimates
7. Run → wallet signs → tx broadcast → backend indexes → SSE fires → canvas animates
8. Verify `GET /v1/runs/:id` returns:
   - `status: succeeded`
   - `stopped: false`
   - `totalGasUsed > 0`
   - `steps[]` with correct `tokenOut` and `amountOut` per position
9. Withdraw funds → verify session did not need to be re-opened

**Acceptance:**
- Every step above passes with real testnet transactions.
- Screenshot or video for demo material.

---

### 🟡 NS-05 — Update OpenAPI spec

**Owner:** Backend
**Effort:** S (30 min)

Add new chain endpoints to `backend/src/routes/openapi.ts`:

- `POST /v1/runs/:id/tx` — body `{txHash}`, response 200 with updated run
- `GET /v1/onchain/summary` — query `address`, response with vault + sessions + executor state
- Extend `POST /v1/workflows/:id/runs` response schema:
  ```json
  {
    "data": {
      "run": {...},
      "call": { "to": "0x...", "data": "0x...", "chainId": 5042002 },
      "requiresWalletSignature": true
    }
  }
  ```
- Extend `PATCH /v1/workflows/:id` body schema with `onchainId` and `vaultAddress`.

**Acceptance:**
- `/v1/docs` renders new endpoints in Scalar UI.
- Manual curl tests match schema.

---

### 🟡 NS-06 — Update backend README

**Owner:** Backend
**Effort:** S (30 min)

Add sections to `backend/README.md`:

1. **Chain integration overview** — mock vs arc mode, what changes
2. **Env vars for arc mode** — full list with defaults
3. **Live run flow diagram** — sequence diagram (mermaid) showing FE → BE → wallet → chain → BE receipt watcher → SSE
4. **Error code reference** — table of all `code` values FE might receive

**Acceptance:**
- New dev can set up arc mode without asking questions.

---

## Longer-term (Production Hardening)

### 🟢 NS-07 — Receipt watcher robustness

**Owner:** Backend
**Effort:** M (1 day)

Current watcher uses `setImmediate` + direct `getTransactionReceipt`. Brittle.

**Improvements:**

1. Use `waitForTransactionReceipt({ timeout: 60_000 })` to handle unmined tx.
2. Retry on RPC failure with exponential backoff (max 3 attempts).
3. Add a boot-time recovery job:
   - Query `runs WHERE status IN ('queued', 'running') AND tx_hash IS NOT NULL`
   - Re-spawn watcher for each
4. (Optional) Move to a persistent job queue (BullMQ + Redis) for full crash-safety.

**Acceptance:**
- Backend restart mid-run does not leave orphaned `running` runs.
- Slow RPC does not fail runs prematurely.

---

### 🟢 NS-08 — Executor cache invalidation

**Owner:** Backend
**Effort:** M (half day)

Backend caches `registry.executor()` in-memory. Never refreshes automatically.

**Tasks:**

1. Subscribe to `ExecutorPublished` and `ExecutorRetired` events via viem `watchContractEvent`.
2. On event, call `invalidateExecutorCache()`.
3. Log the change with old/new addresses.
4. Add a manual endpoint `POST /v1/admin/reload-executor` (admin-only) as escape hatch.

**Acceptance:**
- Contracts team publishes new executor → backend picks it up without restart within 1 block.

---

### 🟢 NS-09 — Per-endpoint rate limits for chain-touching routes

**Owner:** Backend
**Effort:** S (1 hour)

Chain-touching endpoints hit RPC on every call. Need stricter limits than default 100/min:

- `GET /v1/onchain/summary` — 30/min per owner
- `POST /v1/runs/:id/tx` — 10/min per owner (already strict, keep)
- `POST /v1/workflows/:id/runs` — 10/min per owner (already strict, keep)

**Acceptance:**
- Load test with 200 concurrent `/onchain/summary` calls returns 429 for >30/min.

---

### 🟢 NS-10 — Metrics and observability

**Owner:** Backend + DevOps
**Effort:** L (1-2 days)

Structured JSON logs exist. Wire to a metrics backend.

**Tasks:**

1. Add Prometheus-compatible counters:
   - `runs_total{status="succeeded|failed|stopped"}`
   - `receipt_watcher_failures_total`
   - `rpc_latency_seconds` (histogram)
   - `db_query_duration_seconds` (histogram)
2. Expose `/v1/metrics` endpoint (Prometheus format, no auth for internal scraping).
3. Provision Prometheus + Grafana on VPS or use a hosted service (e.g. Grafana Cloud free tier).
4. Build one dashboard: runs per minute, error rate, p95 RPC latency, DB pool usage.

**Acceptance:**
- Dashboard shows live traffic during E2E walkthrough.

---

### 🟢 NS-11 — Update seed with default configs (BE-INT-17 follow-up)

**Owner:** Backend
**Effort:** S (1 hour)

`db/seed.ts` currently seeds blocks with legacy `params` (label/value pairs). Frontend already uses `config` (typed union). Update seed so:

- Each block in the catalog has a default `config` object matching the frontend `stepConfigSchema`.
- Each template has default `config` per kind, so FE can create a workflow directly from `templateId` without hand-populating.

**Acceptance:**
- `POST /v1/workflows { name: "test", templateId: "stable-auto-compound" }` returns a workflow whose nodes have valid `config` objects that pass encoder validation.

---

### 🟢 NS-12 — MockAggregator deploy (contracts team dependency)

**Owner:** Contracts team (not backend)
**Effort:** External

The `condition` block cannot run on Arc testnet because `MockAggregator` (Chainlink data feed mock) is not deployed. Templates `guarded-exit` and `risk-off-unwind` are unusable end-to-end.

**Request to contracts team:**

1. Deploy `MockAggregator` to Arc testnet.
2. Add its address to `contracts/exports/addresses.arc-testnet.json` under `adapters.priceFeed` (or similar key).
3. Sync updated addresses to backend + frontend via `scripts/sync-contracts.mjs`.

**Acceptance:**
- Backend encoder no longer rejects `condition` blocks with default feed.
- `guarded-exit` template runs end-to-end.

---

## Nice-to-haves (Backlog)

### 🟢 NS-13 — Idempotency keys for POST endpoints

Protect against duplicate calls when frontend retries after network failure.

- Accept `Idempotency-Key` header on `POST /v1/workflows`, `POST /v1/workflows/:id/runs`, `POST /v1/runs/:id/tx`.
- Store `(owner_id, key) → response` in Redis with 24h TTL.
- Return cached response on repeat.

### 🟢 NS-14 — Pagination cursor stability

Current cursor uses `createdAt` timestamp. Two rows with same `createdAt` (unlikely but possible) would skip. Use composite `(createdAt, id)` cursor.

### 🟢 NS-15 — SSE reconnection with Last-Event-ID

Backend already reads `last-event-id` header but only replays existing steps once. Should support resume from any position (persist `event_seq` per run event).

### 🟢 NS-16 — WebSocket alternative to SSE

Some proxies/CDNs mishandle SSE. Offer `/v1/runs/:id/ws` as an alternative for FE flexibility. Low priority — SSE works everywhere Archestra targets.

### 🟢 NS-17 — Batch endpoint for on-chain reads

FE dashboards may need vault state for many owners at once. Add `POST /v1/onchain/summary/batch` accepting `{addresses: [...]}` and returning a map. Reduces round-trips.

### 🟢 NS-18 — Rate-limit budget per owner tier

Anonymous vs authenticated vs premium owners could get different rate limits. Not needed for hackathon.

---

## Dependencies Between Tasks

```
NS-01 (FE integration) ─┐
                        ├─► NS-04 (E2E walkthrough)
NS-02 (VPS deploy) ─────┘
                        ├─► NS-05 (OpenAPI update)
NS-03 (RPC fix) ────────┘

NS-04 ─► NS-07 (watcher hardening — surfaces bugs)
NS-04 ─► NS-10 (metrics — needs real traffic)

NS-08 (executor cache) — independent, can start anytime
NS-11 (seed configs) — independent, unblocks better FE onboarding
NS-12 (MockAggregator) — external blocker for full template coverage
```

---

## How to Update This Doc

When picking up an item:

1. Change status marker in the heading (e.g. add `— IN PROGRESS` after the title).
2. Note the assignee and start date.
3. When done, move the item to a new `## Done` section at the bottom with completion date.
4. Update the "Last updated" timestamp at the top.

Cross-reference commits and PRs with the NS-ID (e.g. commit message `feat(chain): NS-08 auto-reload executor cache`).
