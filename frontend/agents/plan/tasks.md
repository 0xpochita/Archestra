# Frontend Tasks

One task per pull request, one commit scope per task. `FE-x` ids are stable, do not renumber. Every task inherits the production ready checklist in `agents/rules/rules.template.md` section 17, and the architecture decisions in `agents/plan/architecture.md`.

Definition of done for every task: `pnpm lint`, `pnpm type-check`, `pnpm build` green, no `any`, no `as`, no comments, no em-dash, no hex literal in a component, and loading, empty, error and success handled on any async surface the task touches.

## FM0 - Foundation

### FE-01 Dependencies
Scope: add `viem`, `wagmi`, `@tanstack/react-query`, `zod`. No connector beyond injected. Record the bundle delta in the PR body.
Accept: `pnpm build` green, `/` and `/workflows` route JS unchanged, since no chain code is imported there.

### FE-02 Contract sync script
Scope: `scripts/sync-contracts.mjs` reading `contracts/exports/` and writing `src/lib/chain/generated/abi.ts` and `deployments.ts`, ABIs exported `as const`. Add the `sync:contracts` package script. Commit the generated output.
Accept: rerunning the script twice produces no diff. Deleting a generated file and rerunning restores it byte for byte.

### FE-03 Chain config and env
Scope: `src/config/chain.ts` defining the Arc testnet chain object from the generated values, `NEXT_PUBLIC_ARC_RPC_URL` and `NEXT_PUBLIC_REGISTRY_ADDRESS` parsed with zod and falling back to the generated defaults, explorer URL helpers for address, transaction and token. Add `.env.example`.
Accept: a malformed env value fails at boot with a named message, not a runtime crash deep in a component. `.env.local` stays untracked.

### FE-04 CI freshness gate
Scope: CI step running `pnpm sync:contracts` and failing when the working tree changes.
Accept: a hand edited generated file fails the pipeline.

## FM1 - Wallet and vault identity

### FE-05 Chain provider
Scope: `src/providers/ChainProvider.tsx` wiring wagmi and react-query, mounted inside the studio subtree only, never in the root layout.
Accept: `/` and `/workflows` ship no wagmi bytes, verified in the build output.

### FE-06 Connect and network guard
Scope: a wallet button in the studio AppBar with connected, disconnected and wrong network states, plus a switch chain action. Truncated address, copy, disconnect.
Accept: connecting on the wrong chain offers a switch and blocks every write path until it succeeds. Rejecting a connection returns to the disconnected state with no error toast.

### FE-07 Token registry
Scope: `src/lib/chain/tokens.ts` mapping the demo tokens to symbol, address, decimals and logo, sourced from the generated deployment. `src/lib/format.ts` for units, address truncation and durations.
Accept: no decimal literal appears anywhere outside this module. Formatting a 6 decimal and an 18 decimal amount both round trip through parse and format.

### FE-08 Vault panel
Scope: vault address from `vaultOf` with `predictVault` fallback and a not created yet state, explorer link, owner and vault balances per demo token, refresh on account change.
Accept: an account with no vault shows the predicted address labelled as not deployed. Balances show the correct units for both decimal families.

## FM2 - Typed step configuration

### FE-09 Step config schemas
Scope: `src/lib/schemas/step-config.ts`, a zod discriminated union over the ten block kinds matching the encoding table in `architecture.md` section 7, with `AmountInput`, the non zero minimum output refinements, the comparator enum, and the bytes32 string length rule. Types inferred with `z.infer`.
Accept: a zero `minAmountOut`, a 32 byte channel string, a non checksum address and an unknown kind each fail with a field level message.

### FE-10 Catalog defaults and describe
Scope: `defaultConfig` per kind in `BLOCK_CATALOG`, `describeConfig(config)` producing the display params the cards render, `createNode` seeding config, and `WorkflowNode.config` added to the types.
Accept: every card, the block library, the dock and the simulation modal render identically to the current build. Screenshot diff in the PR.

### FE-11 Typed inspector
Scope: rewrite `InspectorPanel` to render typed controls per kind: token selects from the registry, amount input with an exact or max toggle, numeric fields with units, comparator select, duration presets. Free text param add and remove is removed.
Accept: every kind is editable and keyboard reachable, each control has a label, and an invalid value shows an inline message without discarding the node.

### FE-12 Condition block correction
Scope: replace the `condition` copy and fields with feed, bound, comparator and max staleness, and state plainly that a failing guard ends the run early rather than branching.
Accept: no surface in the app still promises a rebalance branch that the contract does not implement.

## FM3 - Encoding and preflight

### FE-13 Adapter map
Scope: `src/lib/chain/adapters.ts` mapping each block kind to its `stepType` and adapter address from the generated deployment, including approve and alert pointing at the executor, and trigger and guard at their modules.
Accept: the map is exhaustive over `BlockKind` at the type level, so a new kind fails to compile until it is mapped.

### FE-14 Step encoder
Scope: `src/lib/chain/encode-steps.ts` turning an ordered node list into `Step[]`, resolving `max` to `2n ** 256n - 1n`, converting display amounts by token decimals, and encoding each params tuple with viem.
Accept: unit tests cover all ten kinds. The eight seeded templates each encode without error. A `max` amount encodes to the exact uint256 maximum.

### FE-15 Preflight validation
Scope: graph level checks: at least 1 and at most 16 steps, every config valid, every adapter pair known, DAG with no unreachable node, and the fan-out notice showing the flattened order. A `condition` block with a zero feed address is blocked here, and the message names the real cause: Arc testnet has no aggregator deployed yet.
Accept: each failure renders inline on the offending node with a specific message, and no transaction is offered while any error stands.

## FM4 - Create on chain

### FE-16 Create workflow
Scope: `useWorkflowRun` create path sending `registry.create(steps)`, reading `workflowId` from `WorkflowCreated`, writing it into the URL, and showing pending, confirmed and rejected states.
Accept: a created workflow survives a page refresh through the URL, and `registry.get(workflowId)` decodes back to the same steps.

### FE-17 On chain workflow header
Scope: workflow id, vault address and executor version shown in the studio header with explorer links, plus a not yet on chain state.
Accept: every address rendered is a link, and the not created state offers the create action rather than a dead label.

## FM5 - Sessions, funding and withdraw

### FE-18 Session reads
Scope: `useSession` reading `sessionOf` and `sessionSpentToday` per token the strategy touches, with parsing and cache invalidation on write.
Accept: an expired session is reported as expired rather than as active with a past timestamp.

### FE-19 Activate strategy modal
Scope: one modal creating a session per token used by the strategy, defaulting to 30 days and caps proposed from the encoded amounts, with a per token confirmation list and progress across multiple signatures.
Accept: a two token strategy walks two signatures without losing state, and rejecting the second leaves the first in place and reported honestly.

### FE-20 Session status panel
Scope: right rail panel per token with cap per run, remaining today, expiry countdown, and revoke. States the rule that revoking does not restore spent daily quota.
Accept: revoking updates the panel without a manual refresh, and the spent quota stays spent.

### FE-21 Funding and withdraw
Scope: demo token mint for testnet, direct transfer to the vault or approve plus `vault.deposit`, and a withdraw control that is enabled in every state with no precondition.
Accept: withdraw succeeds while paused, with no session, and with an expired session. The button is never disabled by a session, an executor or a run state.

## FM6 - Run and receipt

### FE-22 Run preconditions
Scope: derive the run state machine from chain reads and label the primary button with the first unmet precondition: create, open a session, fund the vault, run.
Accept: no signature is ever requested for a state the chain will reject, and each label maps to the action that resolves it.

### FE-23 Run transaction
Scope: send `run(workflowId)` to `vault.acceptedExecutor()`, not to `registry.executor()`, with pending, mined and rejected states and the transaction hash linked to the explorer.
Accept: a vault bound to an older accepted executor still runs through that address after a newer one is published.

### FE-24 Receipt decoding
Scope: `src/lib/chain/decode-run.ts` parsing `RunStarted`, `StepExecuted`, `GuardStopped` and `RunCompleted` into a run outcome, keyed on `runId` and never on the emitting address.
Accept: `contracts/exports/fixtures/run-fixture.json` decodes into the expected positions and states in a unit test, with its own addresses treated as fixture data and not as configuration.

### FE-25 Canvas progress from real events
Scope: replay the decoded steps onto the canvas with the existing per step delay so the animation stays, without inventing timing data anywhere except the presentation layer. Guarded stop renders as a successful early finish.
Accept: a guarded template shows a stopped state, not an error, and the steps after the guard render as not executed rather than failed.

### FE-26 Error mapping
Scope: `src/lib/chain/errors.ts` decoding revert data against the merged error ABI into `{ code, title, detail, action }`, covering every row of the table in `architecture.md` section 11, with a user rejection returning silently.
Accept: each mapped code renders a human message and an action button that resolves it. An unknown selector degrades to a readable generic message plus the raw selector, never a blank screen.

### FE-27 Run receipt panel
Scope: transaction hash, total gas, steps executed, stopped flag, and per step outputs with token symbols and correct decimals.
Accept: gas is reported at the run level, since the chain has no per step gas, and the panel says so rather than showing a fabricated per step number.

## FM7 - Consent, polish and checklist

### FE-28 Executor approval banner
Scope: banner shown only when `registry.executor()` is non zero and differs from `vault.acceptedExecutor()`, showing both addresses with explorer links, calling `acceptExecutor` on confirm.
Accept: a zero published executor shows no banner. Accepting updates the vault reads without a manual refresh.

### FE-29 Status treatment and states
Scope: keep the monochrome palette and mark state with weight, rules and icons rather than colour tokens. Ship a `StatusPill` primitive alongside the existing `AddressLink`, and the four data states on every async surface added by this plan.
Accept: no component holds a hex literal, contrast meets WCAG AA, and no async surface can render blank on failure.

### FE-30 Security headers and CSP
Scope: `connect-src` limited to self plus the Arc RPC origins, plus `frame-ancestors`, `object-src`, nosniff, referrer policy, permissions policy and HSTS, configured once in `next.config`.
Accept: the studio functions with the policy enforced, and no origin beyond the RPC list and self is allowed.

### FE-34 Nonce based script policy
Scope: `script-src` currently carries `'unsafe-inline'` and `'unsafe-eval'`, which is what Next needs without a nonce. Add nonce injection through middleware and drop both keywords.
Accept: the studio runs with `script-src 'self' 'nonce-...'` and no inline keyword, and the change does not turn a static route dynamic without saying so in the PR.

### FE-31 Test suite
Scope: Vitest over the pure layer: `encode-steps`, `decode-run`, `errors`, `run-stage`, `format`, the schemas and the graph preflight. The run precondition machine is a pure function (`getRunStage`) precisely so it can be tested without a wallet. Wire `pnpm test` into CI.
Accept: the suite runs under a minute locally, and a deliberate encoding regression fails it.

### FE-35 Component tests
Scope: Testing Library plus jsdom for the surfaces that only exist as components: the activation modal walking two signatures, the vault panel states, and the error mapping rendered as an action button. Needs the wagmi transport mocked at the boundary.
Accept: a broken multi token activation flow fails the suite. Deferred from FE-31 because the logic underneath is already covered by pure tests and the component layer needs three new dev dependencies.

### FE-33 Studio shell prerender
Scope: `/studio` currently renders nothing above the fold on the server, because the whole studio sits inside the `Suspense` boundary that `useSearchParams` forces. Move the deep link read to a leaf so the header, sidebar and canvas frame prerender, and give the boundary a skeleton instead of `null`.
Accept: the built `studio.html` contains the app bar and the canvas frame, and the Lighthouse LCP target in FM7 is measured against real server output.

### FE-32 Testnet walkthrough
Scope: a documented manual pass on Arc testnet covering mint, create, session, fund, run, guarded stop and withdraw, with the transaction hashes recorded in the PR.
Accept: every step links to the explorer, and the two product promises are demonstrated: an unaccepted executor moves nothing, and withdraw works in every state.
