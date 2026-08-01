# Archestra — Project Integration & Roadmap

Cross-cutting next steps that touch all three layers: **contracts**, **frontend**, and **backend**. Focus on integration, demo readiness, and post-hackathon hardening.

**Last updated:** 2026-08-01
**Companion docs:**
- [`backend-progress.md`](./backend-progress.md) — backend delivery log
- [`backend-next-steps.md`](./backend-next-steps.md) — backend-scoped roadmap
- [`frontend-onchain-findings.md`](./frontend-onchain-findings.md) — live FE on-chain debugging findings
- [`plan/report/report.md`](./plan/report/report.md) — frontend Arc integration report
- [`plan/infoutkBE.md`](./plan/infoutkBE.md) — backend chain info
- [`plan/infoutkFE.md`](./plan/infoutkFE.md) — frontend chain info

---

## Current State (Snapshot)

| Layer | Status | Notes |
|---|---|---|
| **Contracts** | Deployed on Arc testnet | chainId 5042002, registry `0x88d8...b42F`. `MockAggregator` NOT deployed. |
| **Frontend** | Full on-chain via wagmi/viem | Calls contracts directly. Not yet wired to new backend chain endpoints. |
| **Backend** | v2 with chain integration (local verified) | Not yet deployed to VPS. Endpoints ready. |
| **Integration** | Frontend ↔ Contracts: DONE | Frontend ↔ Backend: PARTIAL. Backend ↔ Contracts: DONE (reads only). |

### Actual today

```
Frontend ─────────────────► Contracts (wagmi/viem, direct)
    │
    └───► Backend (mock CRUD + AI assistant only)
```

### Target after this roadmap

```
Frontend ──► Backend ──► Contracts (build calldata, read state)
    │           ▲
    │           │ POST /runs/:id/tx {txHash}
    └──► Wallet (sign & broadcast only)
                │
                ▼
              Chain ──► Events ──► Backend indexer ──► SSE ──► Frontend canvas
```

---

## Priority Legend

| Symbol | Meaning |
|---|---|
| 🔴 | Blocking for demo — must be done before hackathon showcase |
| 🟡 | Should be done before demo — improves UX / reliability |
| 🟢 | Post-hackathon — polish, hardening, scale |

---

## Immediate — Demo Blocking

### 🔴 INT-01 — Wire frontend to backend chain endpoints

**Owner:** Frontend team
**Depends on:** Backend v2 deployed (INT-02)
**Effort:** M (1-2 days)

Frontend currently bypasses backend for all on-chain actions. Rewire so backend becomes the source of truth for run history and event indexing.

**Sub-tasks:**

| ID | Task | File(s) |
|---|---|---|
| INT-01a | After `WorkflowRegistry.create()` succeeds, PATCH backend with `{onchainId, vaultAddress}` | `useWorkflowRun.ts` |
| INT-01b | Replace `Executor.run()` write with `POST /v1/workflows/:id/runs` → get calldata → wallet.sendTransaction | `useWorkflowRun.ts`, `ActivateStrategyModal.tsx` |
| INT-01c | After tx broadcast, POST `/v1/runs/:id/tx` with the returned `txHash` | Same as above |
| INT-01d | Replace local `useWaitForTransactionReceipt` polling with SSE `/v1/runs/:id/events` | `RunReceiptPanel.tsx` |
| INT-01e | (Optional) Replace direct `vault.sessionOf` / `vaultOf` reads with `GET /v1/onchain/summary` | `useVault.ts`, `useSession.ts` |

**Acceptance:**
- User runs a workflow. Backend `/v1/runs/:id` returns the correct `steps[]` with `tokenOut` and `amountOut`. Canvas animates from SSE events, not from local timers.

---

### 🔴 INT-02 — Deploy backend v2 to VPS

**Owner:** Backend/DevOps
**Effort:** S (30 min)

See [`backend-next-steps.md` NS-02](./backend-next-steps.md).

**Additional integration checkpoint:** After deploy, expose to frontend team:

- Full API base URL: `http://43.157.204.55:8787` (or new domain if provisioned)
- Confirm CORS_ORIGINS includes the frontend dev + prod origins
- Provide sample `x-owner-id` values for testing

---

### 🔴 INT-03 — Contract dependency: deploy MockAggregator

**Owner:** Contracts team
**Blocks:** `condition` block on Arc testnet (templates `guarded-exit`, `risk-off-unwind`)
**Effort:** S for contracts team (deploy + address publish)

`MockAggregator` (Chainlink price feed mock) is not deployed. Without it, `condition` blocks cannot run end-to-end.

**Deliverables:**

1. Deploy `MockAggregator` to Arc testnet with a reasonable initial answer (e.g. ETH/USD at `2000_00000000` with 8 decimals).
2. Add address to `contracts/exports/addresses.arc-testnet.json`, e.g.:
   ```json
   "feeds": {
     "ethUsd": "0x..."
   }
   ```
3. Bump the `commit` field in `addresses.arc-testnet.json`.
4. Notify FE + BE teams to re-run `scripts/sync-contracts.mjs` (FE) and copy new ABI/addresses to `backend/src/chain/generated/` (BE).

**Acceptance:**
- FE encoder no longer rejects `condition` with `feed=0x0`.
- Full run of `guarded-exit` template completes on Arc testnet.

---

### 🔴 INT-04 — RPC configuration hardening

**Owner:** Frontend + DevOps
**Effort:** S (15 min)

`rpc.testnet.arc.io` throttles frequently during demo scenarios.

**Actions:**

1. Frontend: set `NEXT_PUBLIC_ARC_RPC_URL` in production `.env` to a fallback (drpc.org or blockdaemon).
2. Backend: viem already uses `batch: true`. Add fallback logic if primary fails (optional).
3. Document in a runbook: "If demo starts throwing rate-limit errors, switch RPC via env var and redeploy FE."

**Acceptance:**
- Zero RPC rate-limit errors during a 10-minute demo run.

---

## Short-term — Demo Readiness

### 🟡 INT-05 — Full happy-path end-to-end test

**Owner:** Both teams + QA
**Depends on:** INT-01, INT-02, INT-03, INT-04
**Effort:** M (half day)

Real testnet, real wallet, all templates.

**Test matrix:**

| # | Scenario | Expected result |
|---|---|---|
| T1 | New user connects wallet, creates vault, opens session, funds vault | Vault deployed, session active, dUSDC balance shows in vault |
| T2 | Run `stable-auto-compound` template | Succeeds, `run.steps` has 5 entries (trigger, approve, deposit, yield, harvest) |
| T3 | Run `weekly-dca` template | Succeeds, `stopped: false`, `tokenOut` shows correct dWETH amount |
| T4 | Run `guarded-exit` with feed below threshold | Succeeds, `stopped: true`, run halts at condition |
| T5 | Run `guarded-exit` with feed above threshold | Succeeds, `stopped: false`, all steps execute |
| T6 | Attempt run without opening session | `POST /runs` returns 200 with call; wallet sim (or backend receipt watcher) reports `session_required` |
| T7 | Attempt run with expired session | Same as T6 with `session_required` or `session_cap_exceeded` |
| T8 | Publish a new executor version (contracts team helper), attempt run | Backend returns `executor_approval_required` |
| T9 | Withdraw funds during pause | Succeeds regardless of session/executor state |
| T10 | Two runs fired in quick succession | Second gets `run_in_flight` or waits properly |

**Deliverables:**
- Test results table filled in
- Screen recording of T2 + T4 for demo
- Log of failures with owner + fix ETA

---

### 🟡 INT-06 — Demo runbook

**Owner:** Whoever presents
**Effort:** S (1 hour)

Written script for the hackathon showcase.

**Sections:**

1. **Pre-demo checklist**
   - Wallet has ≥ 5 USDC native for gas
   - Wallet has ≥ 1000 dUSDC minted
   - FE and BE deployed and healthy (curl `/health`)
   - Test tx on the same session confirmed working within the last hour
2. **Demo script** (5-7 minutes)
   - Slide 1: Problem statement
   - Slide 2: Show landing page (0-bytes wallet library, brag about it)
   - Slide 3: Show workflow templates, pick one
   - Slide 4: Studio walkthrough — inspector, canvas, blocks
   - Slide 5: Connect wallet, fund vault
   - Slide 6: Simulate → run → live canvas animation from SSE
   - Slide 7: Show backend dashboard (if metrics available) + Arc explorer link
3. **Fallback plan** if anything breaks:
   - Have a second wallet with pre-funded vault
   - Have `stable-auto-compound` template already published on-chain (workflowId=1)
   - Have Scalar API docs open in another tab as backup content
4. **Q&A prep**: expected questions with 2-sentence answers

---

### 🟡 INT-07 — Contract type sync automation

**Owner:** Contracts team + Backend
**Effort:** M (half day)

Currently BE manually copies ABIs from `contracts/exports/`. FE has `scripts/sync-contracts.mjs`. Backend should have the same.

**Tasks:**

1. Create `backend/scripts/sync-contracts.mjs`:
   - Copy `abi/*.json` and `addresses.arc-testnet.json` from `../contracts/exports/`
   - Regenerate `backend/src/chain/generated/index.ts` with fresh imports
   - Write a `commit.txt` marker for CI to compare
2. Add npm script: `"sync:contracts": "node scripts/sync-contracts.mjs"`
3. Add CI check that fails if generated files are older than `contracts/exports/addresses.arc-testnet.json`

**Acceptance:**
- Running `pnpm sync:contracts` updates all generated files.
- CI fails when contracts publish new addresses but backend didn't sync.

---

### 🟡 INT-08 — Update OpenAPI + API docs public link

**Owner:** Backend
**Effort:** S (1 hour)

See [`backend-next-steps.md` NS-05](./backend-next-steps.md).

**Integration checkpoint:** Once updated, share the public URL with FE team:

- Spec: `http://43.157.204.55:8787/v1/openapi.json`
- UI: `http://43.157.204.55:8787/v1/docs`

FE team can import spec into Postman/Insomnia collections.

---

### 🟡 INT-09 — Cross-project README

**Owner:** Anyone
**Effort:** S (30 min)

Root-level `README.md` is missing. Should introduce the three sub-projects and how they connect.

**Sections:**

1. **What is Archestra** — 3-sentence pitch
2. **Repository layout** — table of `contracts/`, `frontend/`, `backend/`, `docs/`
3. **Quick start (each layer)** — link to per-layer README with `pnpm dev` / `forge test` commands
4. **Architecture overview** — mermaid diagram of FE ↔ BE ↔ Contracts
5. **Demo** — link to public URL(s)
6. **Team + credits**

---

## Longer-term — Post-hackathon

### 🟢 INT-10 — Mainnet readiness

**Owner:** All
**Effort:** L (multi-week)

Everything the team deferred for the hackathon.

**Contracts:**
- Formal audit (Trail of Bits / Certora / competitive audit)
- Deploy real Chainlink price feeds (replace MockAggregator)
- Deploy real CCIP router adapter
- Multi-sig for admin roles
- Timelock for executor publish/retire

**Backend:**
- Persistent job queue (BullMQ + Redis) for receipt watcher
- Executor cache auto-invalidation via event listener (NS-08)
- Prometheus metrics + Grafana dashboard (NS-10)
- Rate limits scaled per owner tier (NS-18)
- Backup + restore strategy for Postgres
- Multi-region deployment (or at least standby)

**Frontend:**
- CSP with nonce (FE-34)
- Prerender studio route (FE-33)
- Component testing (FE-35)
- Wallet-agnostic UX (currently RainbowKit + MetaMask focused)
- ENS + address book support

**Integration:**
- Auth beyond `x-owner-id` — either wallet signature (SIWE) or session cookie
- Idempotency keys on write endpoints (NS-13)
- Multi-chain support — currently hard-coded to Arc

---

### 🟢 INT-11 — Analytics + observability across the stack

**Owner:** All
**Effort:** L (1 week)

Currently there is no unified view of user journeys.

**Instrument each layer:**

- **Frontend:** page views, wallet-connect success rate, run-start attempts vs successes
- **Backend:** request counters, RPC latency, DB latency, run outcomes
- **Contracts:** already emit rich events, just need an indexer to summarize

**Backend:** ship metrics endpoint (NS-10). Frontend: ship simple `plausible.io` or `posthog` integration (respect DNT). Aggregate: Grafana dashboards with joined views.

---

### 🟢 INT-12 — Docs site

**Owner:** Anyone
**Effort:** L (1 week)

Move the ad-hoc markdown docs to a proper site (mintlify / docusaurus / astro-starlight).

**Content structure:**

- Getting started
- Concept: workflows, blocks, sessions
- Tutorials: build your first strategy
- API reference (auto-generated from OpenAPI)
- Contract reference (Solidity natspec → markdown)
- Deployment guide

Host on `docs.archestra.xyz` or similar.

---

### 🟢 INT-13 — Multi-strategy composition

**Owner:** Product decision
**Effort:** L (open-ended)

Today one workflow = one linear graph. Users may want to compose:

- "Run strategy A daily, and if condition X, run strategy B once"
- "Run strategy A on Arc, strategy B on Ethereum, share balance"

Would require:
- Contracts: nested workflow calls or cross-workflow triggers
- Backend: DAG of workflows, not just DAG of steps
- Frontend: canvas of canvases

Design spike required before commitment.

---

### 🟢 INT-14 — Non-EVM support

**Owner:** Product decision
**Effort:** XL (multi-month)

Arc is EVM. Users may want Solana or Move-based chains too.

Would require adapter abstraction at all three layers. Currently baked into every viem call.

---

## Dependency Graph

```
INT-02 (BE deploy) ──┐
                     ├─► INT-01 (FE wire) ──┐
INT-03 (feed) ───────┤                       ├─► INT-05 (E2E test) ──► INT-06 (demo runbook)
INT-04 (RPC fix) ────┘                       │
                                             │
INT-08 (OpenAPI) ────────────────────────────┘

INT-07 (sync script) — independent, unblocks reliable rebuilds
INT-09 (root README) — independent, quick win

INT-10 (mainnet) — all-hands, blocks on hackathon end
INT-11 (analytics) — depends on INT-05 for real traffic
INT-12 (docs site) — content ready after INT-09
INT-13, INT-14 — product spikes
```

---

## Timeline Suggestion

**Hackathon week (assume 3-5 days remaining):**

| Day | Focus |
|---|---|
| Day 1 | INT-02 deploy + INT-03 request to contracts + INT-04 RPC hardening |
| Day 2 | INT-01 FE wiring |
| Day 3 | INT-05 E2E test + fix bugs uncovered |
| Day 4 | INT-06 demo runbook + INT-08 OpenAPI + INT-09 root README |
| Day 5 | Rehearse demo, buffer for fixes |

**Post-hackathon month 1:** INT-07, NS-07, NS-08, NS-10, INT-11 start
**Post-hackathon month 2+:** INT-10 mainnet prep, INT-12 docs site

---

## Communication Channels

Suggested to establish for cross-team coordination during integration:

- **Sync stand-up** daily at fixed time (15 min max)
- **Blocker channel** on Discord/Slack — anyone can post, response within 2h
- **Contract change announcements** — when contracts team publishes new addresses, they post the diff + which teams need to sync

---

## Rollback Plan (if demo goes wrong)

Order of fallback:

1. **Full flow broken on chain:** switch demo to backend simulation endpoint (`POST /simulate`). Same UX, no on-chain writes.
2. **Backend down:** switch demo to frontend-only mode (mock timers). Loses realism but functional.
3. **Everything down:** show pre-recorded video of last successful run + walk through code.

Keep the video updated after every successful E2E test (INT-05).
