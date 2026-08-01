# Frontend On-Chain Findings

Catatan dari debugging live Arc Testnet flow di `localhost:3000`. Fokus: hal yang bikin user bingung waktu run workflow, plus fix/development item buat FE + integration.

**Last updated:** 2026-08-02

---

## Confirmed Happy Path

Flow yang sudah berhasil di Arc Testnet:

1. Connect wallet ke Arc Testnet.
2. Create workflow on-chain.
3. Activate `dUSDC` spending session.
4. Mint dan fund vault dengan `dUSDC`.
5. Run strategy.

Run sukses terakhir:

```text
Workflow #4
Steps: 2
deposit -> 100 aUSDC
Gas used: 402651
Registry: 0x88d8Cd3009cd7905ec0E7f895c772Edd9878b42F
Vault: 0x4d93Ae508f0A94dDE04532C70C8Fb7a32ccF8e03
```

---

## Findings

### FE-CHAIN-01 — Custom errors need selector fallback

**Severity:** Medium
**Owner:** Frontend
**Status:** Fix prepared locally

Viem sometimes reports bubbled contract errors as raw selectors because the call ABI does not include the downstream contract error. Example: `Executor.run()` bubbles errors from `StrategyVault` or ERC20.

Observed selectors:

| Selector | Error | Meaning |
|---|---|---|
| `0x30278bcb` | `NoActiveSession(address)` | Vault has no active session for token being approved/spent. |
| `0xe450d38c` | `ERC20InsufficientBalance(address,uint256,uint256)` | Vault/token holder balance is below step spend amount. |

Recommended fix:

- Keep fallback selector map in `frontend/src/lib/chain/errors.ts`.
- Add tests in `frontend/src/lib/chain/errors.test.ts`.
- Add more common selectors if new raw errors appear.

---

### FE-CHAIN-02 — Preflight/run error can become stale after balance/session changes

**Severity:** Medium
**Owner:** Frontend
**Status:** Fix prepared locally

Top bar can keep showing old error like `Token balance is too low` even after the vault balance is already enough and session is active.

Why:

- `useSimulateContract` caches simulation error.
- `run.writeContract` error can remain in hook state.
- Vault/session reads update independently from simulation state.

Recommended fix:

- Refetch run preflight when relevant vault balances or session quota changes.
- Clear stale create/run transaction errors when balance/session changes.
- Files touched locally:
  - `frontend/src/hooks/useWorkflowRun.ts`
  - `frontend/src/components/(pages)/(main)/components/OnChainStatus.tsx`

---

### FE-CHAIN-03 — RPC rate limits look like contract failures

**Severity:** High for demo reliability
**Owner:** Frontend + DevOps
**Status:** Needs hardening

Common error:

```text
RPC 0x4cef52 Custom eth_sendRawTransaction: Request is being rate limited.
RPC 0x4cef52 Custom eth_gasPrice: Request is being rate limited.
```

This is Arc RPC throttling, not contract logic.

Recommended fix:

- Use stable fallback RPC in MetaMask and frontend env.
- Add user-facing message: `Arc RPC is rate-limiting. Wait 60 seconds or switch RPC.`
- Avoid retry loops that spam RPC.
- For demo, use one RPC consistently in app and MetaMask:

```text
https://rpc.blockdaemon.testnet.arc.network
```

Fallback:

```text
https://arc-testnet.drpc.org
```

---

### FE-CHAIN-04 — Template behavior needs FE/product decision

**Severity:** Medium
**Owner:** Frontend + Product/demo owner
**Status:** Needs decision before merge

During debugging, `stable-auto-compound` was temporarily simplified from:

```ts
["approve", "deposit", "yield", "harvest"]
```

to:

```ts
["deposit", "yield"]
```

Reason:

- Demo-safe flow ran successfully with two steps.
- `Harvest Rewards` can fail if rewards are not available yet.
- `Approve Token` is confusing because vault/session approvals are already handled by `Executor` per adapter step.

Important:

- This is UX/product behavior, not backend concern.
- Do not merge template change without FE/demo approval.
- Error handling fixes can be merged independently.

Recommended options:

| Option | Pros | Cons |
|---|---|---|
| Keep simplified `deposit -> yield` template | Stable demo, easy user tutorial | Less feature showcase |
| Restore full template | Shows more blocks | More failure modes, needs better UI explanations |
| Keep both templates | Best for demo + advanced flow | Needs template naming/copy update |

Suggested names:

```text
Stablecoin quick demo: deposit -> yield
Stablecoin full auto-compound: approve -> deposit -> yield -> harvest
```

---

### FE-CHAIN-05 — Old on-chain workflows cannot be patched

**Severity:** Low
**Owner:** Frontend
**Status:** Needs UI note

If a workflow has already been created on-chain, changing the frontend template does not update that workflow. User must create a new workflow.

Recommended fix:

- Add UI copy near workflow ID:

```text
This on-chain workflow is immutable. Template changes only affect new workflows.
```

- For demo docs, tell users not to reuse old broken workflow IDs after a template fix.

---

### INT-ONCHAIN-01 — Backend-mediated run flow still pending

**Severity:** High for final architecture
**Owner:** Frontend + Backend
**Status:** Pending

Current successful flow is still frontend-direct:

```text
Frontend -> Wallet -> Contracts
```

Target flow:

```text
Frontend -> Backend builds calldata -> Wallet signs/broadcasts -> Frontend reports txHash -> Backend indexes receipt/SSE
```

Needed work:

- FE creates/patches backend workflow mirror after on-chain create.
- FE calls `POST /v1/workflows/:id/runs` to get calldata.
- FE sends wallet transaction from backend-provided call.
- FE calls `POST /v1/runs/:id/tx` with tx hash.
- FE consumes backend SSE events for canvas progress.

---

## Merge Guidance

Safe to merge after FE review:

```text
frontend/src/lib/chain/errors.ts
frontend/src/lib/chain/errors.test.ts
frontend/src/hooks/useWorkflowRun.ts
frontend/src/components/(pages)/(main)/components/OnChainStatus.tsx
```

Needs FE/product decision before merge:

```text
frontend/src/constants/blocks.ts
```

Reason: this changes template behavior and demo story.

---

## Demo Checklist

Use this sequence for a stable demo:

1. Use Arc Testnet RPC with low throttling.
2. Connect wallet.
3. Create a fresh workflow after latest template changes.
4. Activate `dUSDC` session.
5. Mint `150 dUSDC`.
6. Fund vault with `150 dUSDC`.
7. Run strategy once.
8. If error looks stale but balances are correct, refresh page before changing contract state.
