# 2026-08-02 Follow up on the live Arc testnet findings

Input: `docs/frontend-onchain-findings.md` and `docs/project-integration-next-steps.md`, both written by isalkun after debugging the live flow on `localhost:3000`.

This plan continues `agents/plan/tasks.md`, so ids carry on from FE-35. Every task also carries the id isalkun used, so the two documents can be read side by side.

Everything below was checked against the code at `bc65e84`, not taken from the write up alone. Where the write up and the code disagree, the code is quoted.

---

## 1. What the code actually says

### 1.1 The bubbled error problem is real, and the cause is narrower than it looks

`Executor.json` declares these errors and no others:

```
AccessControlBadConfirmation, AccessControlUnauthorizedAccount, AdapterNotAllowed,
EmptyWorkflow, EnforcedPause, ExecutorNotAccepted, ExpectedPause, NotOwner,
ReentrancyGuardReentrantCall, SystemPaused, UnexpectedStepType, WorkflowInactive,
ZeroAddress
```

`NoActiveSession` lives in `StrategyVault.json`. The ERC20 errors live in `DemoToken.json`. When `Executor.run()` bubbles either one, viem has no matching entry in the call ABI, `ContractFunctionRevertedError.data` comes back undefined, and `toChainError` falls through to `unknown_revert`. The user sees a raw selector.

So the error table in `src/lib/chain/errors.ts` is not wrong, it is only reachable through the wrong door: the lookup is keyed by `errorName`, and in this path there is no name to key on.

### 1.2 Our RPC order contradicts the field report

`src/config/rpc-endpoints.ts` puts `rpc.testnet.arc.io` first. isalkun reports that endpoint throttling during demos and recommends blockdaemon. Both statements can be true, since our own probe on 2026-08-01 found `rpc.testnet.arc.network` returning 429 while `arc.io` answered 200. Throttling is per key and per moment, so the order should follow the endpoint that survives a demo, not the one that answered once.

### 1.3 What the rate limit fix cannot reach

`fallback` plus `batch: true` covers our reads and simulations. It does not cover `eth_sendRawTransaction`, because the wallet broadcasts through the RPC configured inside MetaMask. No frontend change fixes that. It belongs in the runbook and in a user facing message.

### 1.4 The backend is further along than the findings note suggests

These endpoints exist in `backend/src/routes/`:

| Endpoint | Returns |
| --- | --- |
| `POST /v1/workflows/:id/runs` | `{ data: { run, call, requiresWalletSignature } }`, status 202 |
| `POST /v1/runs/:id/tx` | `{ data: run }` after `{ txHash }` is posted |
| `GET /v1/runs/:id` | `{ data: run }` |
| `GET /v1/runs/:id/events` | SSE, events `step`, `done`, `error` |
| `GET /v1/onchain/summary?address=0x...` | vault, executor and session summary |
| `PATCH /v1/workflows/:id` | accepts `onchainId` and `vaultAddress` |

`RunCall` is `{ to: string; data: string; chainId: number }`. Auth is the `x-owner-id` header. `CORS_ORIGINS` defaults to `http://localhost:3000`. The `step` SSE payload is `{ nodeId, state, position, txHash, gasUsed, tokenOut, amountOut }`, which lines up with what the canvas already consumes.

`startRun` refuses with a validation error when `workflow.onchainId` is missing, so the PATCH in FE-38 is a hard prerequisite for the whole backend mediated flow, not an optional nicety.

---

## 2. Coordination risk, to settle before writing code

isalkun marks FE-CHAIN-01 and FE-CHAIN-02 as "Fix prepared locally" and lists the files:

```
frontend/src/lib/chain/errors.ts
frontend/src/lib/chain/errors.test.ts
frontend/src/hooks/useWorkflowRun.ts
frontend/src/components/(pages)/(main)/components/OnChainStatus.tsx
```

Those are exactly the files FE-36 and FE-37 touch. Two people editing the same four files from different starting points produces a merge nobody enjoys. Settle one of these before starting:

1. He pushes his branch, we review and merge it, and this plan drops FE-36 and FE-37.
2. He drops the local diff, we implement from this plan, and he reviews.

Option 2 is the assumption in the ordering below, because the work is small and the plan already states the acceptance criteria. Either way, do not start FE-36 before the answer arrives.

---

## 3. Tasks

Ids continue from `agents/plan/tasks.md`. The definition of done in that file applies unchanged: lint, type check, build, test, no `any`, no `as`, no comments, no em-dash.

### Unblocked, can start today

#### FE-36 Decode bubbled contract errors by selector
Maps to FE-CHAIN-01. Effort: S.

Scope: add a selector keyed fallback in `src/lib/chain/errors.ts`. Build the map from the ABIs we already generate rather than hand copying hex, so a redeploy cannot desynchronise it: walk `strategyVaultAbi`, `demoTokenAbi`, `workflowRegistryAbi` and `executorAbi`, compute `toFunctionSelector` for each error entry, and index the existing templates by that. When `reverted.data` is undefined, fall back to `reverted.signature` and look it up. Decode the arguments when the selector is known so `SessionCapExceeded` can still report its remaining quota.

Accept: `0x30278bcb` renders as the `NoActiveSession` message with the open session action. `0xe450d38c` renders as a plain sentence about the vault balance rather than a hex string. An unknown selector still degrades to the readable generic message. Tests cover both selectors and the unknown case.

Note: `ERC20InsufficientBalance` has no entry in the current table, so it needs one. Suggested code `insufficient_balance`, action `fund_vault`.

#### FE-37 Clear stale preflight and run errors
Maps to FE-CHAIN-02. Effort: S.

Scope: the simulation error from `useSimulateContract` and the write error from `useWriteContract` both outlive the condition that caused them. Invalidate the simulation query when the vault balances or the session for a spent token change, and reset the write errors on the same signal. The vault and session hooks already expose `refetch`, so the missing piece is a shared query key or an explicit `queryClient.invalidateQueries` after a session or funding write settles.

Accept: fund the vault after a failed run, and the button returns to `Run strategy` without a page refresh. Open a session after a `NoActiveSession` revert, and the error clears on its own.

#### FE-38 Mirror the on chain workflow id into the backend
Maps to INT-01a. Effort: S. Prerequisite for FE-40 and FE-41.

Scope: after `WorkflowCreated` gives us a `workflowId`, PATCH the backend workflow with `{ onchainId, vaultAddress }`. Needs a small typed API client first: base URL from `NEXT_PUBLIC_API_URL`, the `x-owner-id` header, zod parsed responses, and the backend error envelope mapped into something the UI can show.

Accept: after a create, `GET /v1/workflows/:id` reports the on chain id, and `POST /v1/workflows/:id/runs` no longer answers with "Workflow is not linked to an on-chain workflowId".

#### FE-39 Reorder the RPC list and name the rate limit
Maps to FE-CHAIN-03 and INT-04. Effort: S.

Scope: put `rpc.blockdaemon.testnet.arc.network` first and `arc-testnet.drpc.org` second in `src/config/rpc-endpoints.ts`, matching what survived the demo. Add a rate limit branch to `toChainError` so a throttled RPC reads as "Arc RPC is rate limiting. Wait about a minute or switch the endpoint" rather than a raw provider string. Document in the runbook that `eth_sendRawTransaction` throttling comes from the wallet's own RPC and cannot be fixed from our code.

Accept: a throttled read renders the rate limit sentence with no action button. The runbook names the endpoint to configure in MetaMask.

#### FE-42 Say that an on chain workflow is immutable
Maps to FE-CHAIN-05. Effort: XS.

Scope: one sentence next to the workflow id chip: editing blocks after creation does not change the stored steps, a changed strategy needs a new workflow.

Accept: the copy is visible whenever a workflow id exists, and it does not appear before creation.

### Blocked on other people

#### FE-40 Run through the backend instead of writing directly
Maps to INT-01b and INT-01c. Blocked by INT-02, the backend v2 deploy. Effort: M.

Scope: replace the direct `executor.run` write with `POST /v1/workflows/:id/runs`, send the returned `call` through the wallet, then report the hash with `POST /v1/runs/:id/tx`. Keep the direct path behind a flag until the backend path is proven, because the direct path is what works today.

Accept: a run started from the studio appears in `GET /v1/runs/:id` with the right steps, and the wallet still signs every transaction. No private key ever reaches the backend.

#### FE-41 Replace receipt polling with the backend event stream
Maps to INT-01d. Blocked by FE-40. Effort: M.

Scope: consume `GET /v1/runs/:id/events`. The `step` payload already carries `nodeId`, `state`, `position`, `tokenOut` and `amountOut`, so the canvas replay needs the source swapped, not rewritten. Handle `done` and `error`, and reconnect with `last-event-id`.

Accept: the canvas animates from server events with the wallet's own receipt watcher switched off, and a guarded stop still renders as a finished run.

#### FE-43 Enable the condition block once a feed exists
Maps to INT-03. Blocked by the contracts team. Effort: XS on our side.

Scope: after `MockAggregator` is deployed and `addresses.arc-testnet.json` carries a `feeds` entry, rerun `pnpm sync:contracts`, default the condition feed to that address, and drop the preflight message that says no feed is deployed.

Accept: `guarded-exit` encodes and runs end to end.

### Needs a product decision, not engineering

#### FE-44 Split the stablecoin template
Maps to FE-CHAIN-04. Effort: XS once decided.

isalkun simplified `stable-auto-compound` locally from `["approve","deposit","yield","harvest"]` to `["deposit","yield"]` because harvest fails when no rewards have accrued, and because the approve block confuses users when the executor already handles allowances per step.

Recommendation: keep both, so the demo has a safe path and the product still shows the full composition.

```
Stablecoin quick demo:        deposit -> yield
Stablecoin full auto-compound: approve -> deposit -> yield -> harvest
```

Do not merge a template change without that decision. It changes the demo story, and the failure modes of the full template need UI copy that explains them.

---

## 4. Suggested order

```
FE-36  selector decode        no dependency
FE-37  stale error clearing   no dependency
FE-39  rpc order and message  no dependency
FE-42  immutability copy      no dependency
FE-38  backend mirror         needs the api client, unblocks the rest
FE-40  run through backend    needs INT-02 deploy
FE-41  event stream           needs FE-40
FE-43  condition block        needs the contracts team
FE-44  template split         needs a product answer
```

FE-36 first: it is the smallest change with the largest effect on what a user sees when something goes wrong.

## 5. Frontend only lane

If the decision is to keep the work inside `frontend/` and touch neither the backend nor the contracts, four of the nine tasks are already there:

```
FE-36  decode bubbled errors by selector
FE-37  clear stale preflight and run errors
FE-39  rpc order and a named rate limit message
FE-42  immutability copy next to the workflow id
```

Nothing in that set imports from the backend, changes a contract, or waits on a deploy. Together they are roughly one focused day.

What the lane buys: every failure a user can hit today stops rendering as a hex selector or a stale sentence, and the endpoint that survives a demo is the one tried first. That is the whole visible surface of the current bug reports.

What the lane costs, stated plainly:

- The architecture stays `frontend -> wallet -> contracts`. The backend keeps no run history, the SSE stream stays unused, and `GET /v1/runs/:id` stays empty. That is a deliberate deferral of INT-01, not an oversight.
- `condition` stays unusable on Arc testnet, because that needs a deployed feed.
- The template question stays open.

Two smaller items from `agents/plan/tasks.md` also fit the lane if there is time after the four: FE-33, the studio shell that never prerenders, and FE-35, the component tests. Neither blocks a demo.

The coordination point in section 2 still applies. FE-36 and FE-37 touch the four files isalkun has open locally, so that has to be settled first no matter how narrow the scope is.

---

## 6. Out of scope here

The three items already recorded in `agents/plan/tasks.md` stay where they are: FE-33 studio prerender, FE-34 nonce based CSP, FE-35 component tests. None of them block the demo.
