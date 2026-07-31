# Frontend Chain Integration Architecture

Target: connect the existing studio to the live Arc testnet deployment described in `plan/infoutkFE.md`, without breaking the mock experience that already ships.

Sources of truth, in this order: `contracts/exports/addresses.arc-testnet.json`, `contracts/exports/abi/*.json`, `plan/infoutkFE.md`, `contracts/exports/README.md`. Nothing in this document restates an address; the code reads them from the generated module in section 6.

## 1. What exists today

| Area | State |
| --- | --- |
| Routes | `/` landing, `/workflows` gallery, `/studio` builder. All static, no data fetching. |
| Studio state | `useWorkflowStudio` (518 lines): history, viewport, run simulation, AI draft, template deep link. All in memory. |
| Graph model | `WorkflowNode { id, kind, title, subtitle, params: BlockParam[], x, y }` plus `WorkflowEdge`. |
| Params | `BlockParam { id, label, value }` where `value` is display text: `"5,000"`, `"0.5%"`, `"Aave V3 Pool"`, `"Daily 00:00 UTC"`. |
| Execution | `runWorkflow` walks `getExecutionOrder` on a timer and paints node states. No network. |
| Deps | next 16.2.12, react 19.2.4, framer-motion, react-icons. No wallet, no fetch client, no validator. |
| Tokens | Monochrome `@theme` set in `globals.css`. No semantic status colors. |

## 2. What the contracts demand

1. A connected wallet on chain `5042002`. Every write is signed by the user, never by a server.
2. `Step[]` tuples of `(uint8 stepType, address adapter, bytes params)`, at least 1 and at most 16, in backend topological order, with `params` ABI encoded per step type.
3. A per user vault, discovered through `factory.vaultOf(owner)` or `predictVault(owner)`.
4. A per token spending session before any run: `setSession(token, maxPerRun, maxPerDay, expiresAt)`.
5. Runs sent to `vault.acceptedExecutor()`, not to `registry.executor()`.
6. Run results read from a single transaction receipt: one `RunStarted`, `StepExecuted` per position, optional `GuardStopped`, closing `RunCompleted`.
7. Custom error decoding for a revert, because a failed run emits nothing at all.

## 3. Gap analysis

| Gap | Impact | Resolution |
| --- | --- | --- |
| Params are free text, contracts need typed ABI values | Encoding is impossible today | Section 7: typed `StepConfig` per node, display strings derived from it |
| Canvas allows branching, chain executes a flat array | A fan-out silently becomes sequential | Validate and warn at encode time, section 8 |
| `condition` block copy says "Then: Rebalance", GUARD only stops the run | Misleading UI | Rewrite the block copy and fields to feed, bound, comparator, staleness |
| No wallet, no RPC client, no validator | Nothing can reach chain | Section 5 dependency decision |
| `deadline` and `startAt` are stored on chain at create time | A short swap deadline breaks every later scheduled run | Default deadline to 30 days, surface it as an editable field with an explicit warning |
| `minAmountOut`, `minLpOut`, `minValueOut` must be non zero | Run reverts `InsufficientOutput` on a zero default | Required field, zod refuses zero, no silent default |
| No status tokens in the theme | Session and error surfaces have nothing to render with | Resolved without colour: the palette is deliberately black and white, so a field error is marked by weight and a left rule (`border-l-2 border-ink`) rather than a red token. Meaning never rests on colour alone, which is also the accessible answer |
| No price feed is deployed on Arc testnet | A `condition` block can be configured but can never run there | `MockAggregator` exists only in `contracts/test/mocks/`, so `GuardModule` has nothing to read. The feed field stays user supplied and preflight blocks a zero address. The contracts team has to deploy an aggregator and add it to `addresses.arc-testnet.json` before `guarded-exit` and `risk-off-unwind` can run end to end |
| No backend yet | Graphs are not persisted | Phase 1 reads chain directly from the browser as `plan/infoutkBE.md` section 6 recommends. Persistence lands when the backend exists, behind the same hook boundary |

## 4. Target layer map

Additions only. Existing files keep their place.

```
frontend/
├── scripts/
│   └── sync-contracts.mjs          # copies exports into src/lib/chain/generated
└── src/
    ├── config/
    │   └── chain.ts                # env parsed with zod, chain definition, explorer helpers
    ├── lib/
    │   ├── chain/
    │   │   ├── generated/          # committed output of sync-contracts
    │   │   │   ├── abi.ts
    │   │   │   └── deployments.ts
    │   │   ├── tokens.ts           # token registry: address, symbol, decimals, logo
    │   │   ├── adapters.ts         # BlockKind to (stepType, adapter address)
    │   │   ├── encode-steps.ts     # StepConfig[] to Step[]
    │   │   ├── decode-run.ts       # receipt to RunOutcome
    │   │   └── errors.ts           # custom error decode to AppChainError
    │   ├── schemas/
    │   │   ├── step-config.ts      # zod discriminated union, source of the TS types
    │   │   └── session.ts
    │   └── format.ts               # units, addresses, durations
    ├── providers/
    │   └── ChainProvider.tsx       # wagmi + react-query, client component
    ├── hooks/
    │   ├── useVault.ts             # vault address, accepted executor, balances
    │   ├── useSession.ts           # sessionOf, sessionSpentToday, set, revoke
    │   └── useWorkflowRun.ts       # create, run, receipt decode, progress
    └── components/
        ├── ui/                     # existing primitives plus StatusPill, AddressLink
        └── (pages)/(main)/
            └── components/         # new: WalletButton, VaultPanel, SessionModal,
                                    #      ExecutorBanner, RunReceiptPanel
```

Dependency rule: `lib/*` and `config/*` are framework free and never import a component. Hooks may import `lib`. Components may import hooks. Nothing in `(pages)/(landing)` or `(pages)/(workflows)` imports chain code, so the landing route ships zero wallet bytes.

That last rule forced one promotion, since `(workflows)` used to reach the block catalog through `(pages)/(main)/index.tsx`. Once that index mounts `ChainProvider`, the import pulled wagmi into the workflows bundle. The catalog is shared by two features, so rules section 3 puts it in the shared layer: `src/types/block.ts` (`BlockKind`, `BlockParam`, `BlockDefinition`, `StrategyTemplate`, `BlockGroup`), `src/constants/blocks.ts` (`BLOCK_CATALOG`, `STRATEGY_TEMPLATES`) and `src/components/ui/BlockGlyph.tsx`. `(pages)/(main)` re-exports them for its own internals, and `(pages)/(main)/index.tsx` is now only the studio page.

## 5. Dependency decision

Add four runtime packages:

| Package | Why | Rejected alternative |
| --- | --- | --- |
| `viem` | ABI encode and decode, typed reads, receipt parsing, custom error decode. Required by every other choice. | ethers v6: larger, weaker ABI typing, no first class custom error decode helper |
| `wagmi` | Connection lifecycle, chain switching, account and receipt hooks. Removes the hand written wallet state machine that rules section 11 forbids. | Hand rolled `window.ethereum` code: no dedup, no reconnect, no chain guard, more code to own |
| `@tanstack/react-query` | Peer requirement of wagmi and the server state layer rules section 9 mandates. Chain reads become stale while revalidate with explicit invalidation. | `useEffect` fetching: forbidden by rules section 9 |
| `zod` | Rules section 2 item 5: every trust boundary. Env vars, generated deployment JSON, step config forms, decoded chain reads. | Hand written guards: more code, no schema reuse for forms |

Connector policy: injected connector only. No WalletConnect project id, so no new secret and no extra network origin under the CSP. Bundle impact is confined to `/studio` because `ChainProvider` mounts in the studio subtree, not in the root layout.

## 6. Chain configuration and address sync

`scripts/sync-contracts.mjs` reads `contracts/exports/` and writes two committed files under `src/lib/chain/generated/`:

- `abi.ts`: `as const` ABI arrays for `WorkflowRegistry`, `StrategyVault`, `Executor`, `VaultFactory`, `DemoToken`, `AutomationTrigger`. `as const` is what gives viem its type inference, so the copy is not optional.
- `deployments.ts`: the parsed contents of `addresses.arc-testnet.json` with the commit hash it was generated from.

Reasons the files are copied rather than imported across the repo boundary: the Next build root is `frontend/`, imports above it are outside `tsconfig` paths, and a redeploy must produce a reviewable diff rather than a silent change.

`pnpm sync:contracts` runs the script. CI runs it and fails when the working tree changes, so a redeploy cannot land without refreshing the frontend.

`src/config/chain.ts` parses `NEXT_PUBLIC_ARC_RPC_URL` and `NEXT_PUBLIC_REGISTRY_ADDRESS` with zod, falling back to the generated values. The transport is a viem `fallback` over several public endpoints rather than a single URL: `rpc.testnet.arc.network` answers `429 request limit reached` under the read volume a single canvas produces, and it drops its CORS headers on that response, so the browser reports a CORS failure for what is really a rate limit. The endpoint list lives in `src/config/rpc-endpoints.ts` because `next.config.ts` needs the same origins for `connect-src`. Only the registry address is configuration; the executor is resolved at runtime with `registry.executor()`, and the address a vault obeys is `vault.acceptedExecutor()`. `.env.example` documents both variables.

## 7. Typed step configuration

The central change. Each node gains `config`, a discriminated union keyed by `BlockKind`, defined once as a zod schema and inferred into TypeScript.

`AmountInput` is `{ mode: "max" }` or `{ mode: "exact", value: string }` where `value` is a decimal string in display units. Encoding multiplies by the token decimals read from the token registry, and `max` becomes `2n ** 256n - 1n`. No component ever hardcodes 18.

| Kind | Step type | Fields the inspector edits | Encoded as |
| --- | --- | --- | --- |
| `trigger` | 0 TRIGGER | interval preset, start time | `(uint64 intervalSeconds, uint64 startAt)` |
| `approve` | 1 APPROVE | token, spender adapter, amount | `(address, address, uint256)` |
| `deposit` | 2 SUPPLY | asset, amount | `(address, uint256)` |
| `swap` | 3 SWAP | tokenIn, tokenOut, amountIn, minAmountOut, fee tier, deadline | `(address, address, uint256, uint256, uint24, uint64)` |
| `yield` | 4 STAKE | pool, gauge, amount, minLpOut | `(address, address, uint256, uint256)` |
| `harvest` | 5 CLAIM | gauge, minValueOut | `(address, uint256)` |
| `bridge` | 6 BRIDGE | destination selector, receiver, token, amount | `(uint64, address, address, uint256)` |
| `withdraw` | 7 REDEEM | asset, amount | `(address, uint256)` |
| `condition` | 8 GUARD | feed, bound, comparator, max staleness | `(address, int256, uint8, uint64)` |
| `alert` | 9 NOTIFY | channel, message id | `(bytes32, bytes32)` |

Rules the schema enforces before a transaction is ever built:

- `minAmountOut`, `minLpOut` and `minValueOut` are required and strictly greater than zero.
- `comparator` is `0` (stop below bound) or `1` (stop above bound). The block copy says exactly that; the old "Then: Rebalance" wording is removed because the contract has no such branch.
- `deadline` is stored on chain and never re-derived at run time. Default is 30 days from creation, the field is editable, and the inspector states that a scheduled run after the deadline fails with `DeadlinePassed`.
- `channel` and `messageId` are short strings padded to `bytes32`, rejected when longer than 31 bytes.
- Addresses are checksum validated; adapter addresses come from `adapters.ts`, never from user input.

Migration of the existing display params: `BLOCK_CATALOG` gains a `defaultConfig` per kind, `createNode` seeds it, and `params` becomes derived display text produced by a `describeConfig(config)` function. The canvas card and the simulation modal keep rendering the same shape, so no visual regression.

## 8. Encoding and preflight

`encodeSteps(graph)` returns either the `Step[]` array or a typed list of problems. It is a pure function in `lib/chain`, unit tested without a browser.

Preflight checks, all client side and all mirrored by the contract:

1. At least 1 node, at most 16 (`EmptyWorkflow`, `TooManySteps`).
2. Every node config parses against its schema.
3. Each `(adapter, stepType)` pair exists in the adapter map, which mirrors the registry allow list (`AdapterNotAllowed`).
4. The graph is a DAG and `getExecutionOrder` consumed every node. An unreachable node is an error, not a silent drop.
5. Fan-out warning: when a node has more than one outgoing edge, the UI states that the chain executes the flattened order sequentially and shows that order before the user signs.

Preflight failures render inline on the offending node, never as a raw revert after a signature.

## 9. Read model

All reads are `useReadContract` or multicall through wagmi, keyed and cached by react-query. Nothing chain derived is copied into component state.

| Read | Source | Staleness |
| --- | --- | --- |
| vault address | `factory.vaultOf`, fallback `predictVault` | until the account changes |
| accepted executor | `vault.acceptedExecutor()` | 30s, invalidated after `acceptExecutor` |
| published executor | `registry.executor()` | 60s |
| session per token | `vault.sessionOf(token)` | 15s, invalidated after set or revoke |
| spent today | `vault.sessionSpentToday(token)` | 15s, invalidated after a run |
| balances | `DemoToken.balanceOf(vault)` and of the owner | 15s, invalidated after deposit, withdraw or run |
| stored workflow | `registry.get(workflowId)` | on demand |

Zod covers the boundaries a schema can actually defend: environment variables, any JSON read from disk or network (the run fixture, a future backend response), form input, and browser storage. It is not applied on top of viem's ABI decoding: the ABI is the schema there, a mismatch throws inside the decoder, and a second parse would only restate types the compiler already knows.

## 10. Write flows

One state machine per workflow, derived from chain reads rather than stored:

```
draft            no workflowId yet
  -> created     registry.create(steps), workflowId from WorkflowCreated
  -> sessioned   vault.setSession per token the strategy touches
  -> funded      owner sends tokens to the vault, or approve plus vault.deposit
  -> runnable    executor.run(workflowId) on vault.acceptedExecutor()
```

The Run button reflects the first unmet precondition rather than failing after a signature: "Create on chain", "Open a session", "Fund the vault", "Run strategy". Withdraw is never gated by any of them.

Run handling: send `run`, wait for the receipt, then decode. On `status === "reverted"`, decode the revert data against the merged error ABI and map it through section 11. On success, parse `RunStarted`, `StepExecuted`, `GuardStopped` and `RunCompleted` from the logs, then replay them onto the canvas with the existing per step delay so the animation stays, as `plan/infoutkBE.md` section 5 recommends. The timing is a frontend presentation choice; the data stays honest, and `stopped = true` renders as a successful guarded stop, never as a failure.

## 11. Error mapping

`lib/chain/errors.ts` decodes the revert and returns `{ code, title, detail, action }`. The action drives a button, so no error is a dead end.

| Error | Code | Action offered |
| --- | --- | --- |
| `NoActiveSession(token)` | `session_required` | Open session modal for that token |
| `SessionCapExceeded(token, requested, remaining)` | `session_cap_exceeded` | Show remaining, offer to raise the cap |
| `ExecutorNotAccepted(given, accepted)` | `executor_approval_required` | Approve the published executor |
| `NotOwner()` | `wrong_account` | Show the connected account and the owner |
| `SystemPaused()` | `system_paused` | Explain maintenance, keep withdraw enabled |
| `WorkflowInactive()` | `workflow_inactive` | Offer reactivate |
| `EmptyWorkflow()` / `TooManySteps` | `invalid_graph` | Never reaches chain, blocked by preflight |
| `AdapterNotAllowed` | `encoder_bug` | Report path, this is our bug not the user's |
| `InsufficientOutput(got, min)` | `slippage` | Offer a looser minimum, then retry |
| `DeadlinePassed(deadline)` | `deadline_passed` | Offer to update the swap deadline |
| `StaleFeed` / `InvalidFeedAnswer` | `oracle_unavailable` | Offer a higher staleness tolerance or retry later |
| `TriggerNotDue(nextRunAt)` | `not_due` | Show the next scheduled time |
| `NoTriggerStep()` | `no_trigger` | Blocked by preflight for scheduled runs |
| `RunInFlight()` | `run_in_flight` | Disable save while a run is pending |
| user rejected signature | `rejected` | Silent return to the previous state, no error toast |

## 12. Required UI surfaces

From `plan/infoutkFE.md` section 8, all five are mandatory:

1. Activate strategy modal: creates a session per token the strategy touches, defaulting to 30 days and caps proposed from the encoded amounts, in one confirmation flow.
2. Session status panel in the studio right rail: cap per run, remaining today, expiry, revoke button.
3. Executor approval banner: rendered only when `registry.executor()` is non zero and differs from `vault.acceptedExecutor()`. A zero published executor means nothing has been published, so the banner stays hidden.
4. Withdraw control, always enabled, with no precondition of any kind.
5. Vault address with an explorer link, so the user can verify custody themselves.

Plus the run receipt panel: transaction hash, total gas, steps executed, and the guarded stop state when `stopped` is true.

## 13. Rendering strategy

`/`, `/workflows` and `/studio` stay static. `ChainProvider` sits in the `(main)` route group layout, so the studio and the template gallery share one connection and one query cache, and a wallet connected on either page stays connected across the navigation. The landing route lives in its own group and ships no wallet bytes at all: 781 kB against 1794 kB for the gallery. `'use client'` stays at the leaves as rules section 8 requires, and no route becomes `force-dynamic`.

`RainbowKitProvider` renders a real `div[data-rk]`, not a context only wrapper, so it has to sit outside the `h-svh` container rather than between it and the page content. Putting it in the middle breaks the flex height chain and collapses the canvas.

## 14. Security notes

- No private keys, no signing outside the user's wallet, no server in the transaction path.
- Only `NEXT_PUBLIC_ARC_RPC_URL` and `NEXT_PUBLIC_REGISTRY_ADDRESS` reach the browser, and neither is a secret.
- CSP `connect-src` is limited to self plus the Arc RPC origins. `script-src` still needs `'unsafe-inline'` and `'unsafe-eval'` until the nonce work in FE-34 lands, which is recorded rather than hidden.
- Contract addresses always come from the generated module, never from user input or a query parameter, so a crafted link cannot redirect an approval.
- The approve banner shows the full executor address and its explorer link before the user signs `acceptExecutor`.

## 15. Testing

- Unit: `encode-steps`, `decode-run`, `errors`, `format`, and every zod schema. Vitest, no browser needed. Fixtures come from `contracts/exports/fixtures/run-fixture.json` for the decode path, with the note from `plan/infoutkFE.md` that its addresses belong to an older deployment and are not an address source.
- Integration: the session modal, the run precondition machine, and the error mapping rendered through Testing Library with the network mocked at the transport boundary.
- Manual on Arc testnet before merge of the run milestone: mint, create, session, fund, run, guarded stop, withdraw.

## 16. Out of scope for this plan

Backend persistence of graphs, the SSE progress stream, workflow update and `setActive`, Chainlink Automation registration for the trigger block, multi wallet connectors, and mainnet. Each lands after the backend exists or after the contracts team ships the matching path.
