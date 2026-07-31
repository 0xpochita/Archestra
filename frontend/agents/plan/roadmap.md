# Frontend Roadmap

Seven milestones from the current mock studio to a studio that creates, funds, and runs real workflows on Arc testnet. Design language, routes, and the existing canvas behaviour do not change. Every milestone ships behind the same rules: `agents/rules/rules.template.md`.

The mock path stays alive throughout. A user with no wallet keeps the canvas, the templates, the AI draft, and the simulation modal exactly as they are today.

## FM0 - Foundation (1 day)

Dependencies (`viem`, `wagmi`, `@tanstack/react-query`, `zod`), the contract sync script, the generated ABI and address module, `src/config/chain.ts` parsed with zod, `.env.example`, and the CI step that fails when the generated files are stale.

Exit: `pnpm sync:contracts` produces no diff, `pnpm build` is green, and no chain code is imported by the landing or workflows route.

## FM1 - Wallet and vault identity (1.5 days)

`ChainProvider` mounted on the studio subtree only, an injected connector button in the AppBar, a wrong network guard with a switch action, and the vault panel: address, explorer link, owner balances, vault balances.

Exit: connecting on Arc testnet shows the vault address from `vaultOf`, or the predicted address when the vault does not exist yet, with correct decimals per token.

## FM2 - Typed step configuration (2.5 days)

The largest change. `StepConfig` zod schemas per block kind, `defaultConfig` in `BLOCK_CATALOG`, `describeConfig` producing the display text the cards already render, and an inspector that edits typed fields instead of free text.

Exit: every one of the ten kinds round trips through the inspector, the canvas copy is unchanged to the eye, and the `condition` block reads as feed, bound, comparator and staleness rather than the old rebalance wording.

## FM3 - Encoding and preflight (1.5 days)

`encodeSteps`, the adapter map, the preflight rules, and inline problem reporting on the offending node. Includes the fan-out warning that shows the flattened execution order before signing.

Exit: the eight seeded templates each encode to a valid `Step[]`, unit tested. An empty graph, a seventeen step graph, a zero minimum output, and an unreachable node each produce a specific inline message and no transaction.

## FM4 - Create on chain (1 day)

`registry.create(steps)` from the user's wallet, `workflowId` captured from `WorkflowCreated`, and the workflow header showing the on chain id with an explorer link. The workflow id lives in the URL so a refresh keeps it.

Exit: a template loaded from `/workflows` can be created on Arc testnet and read back with `registry.get`, and the decoded steps match what was sent.

## FM5 - Sessions, funding and withdraw (2 days)

The activate strategy modal creating one session per token the strategy touches, the session status panel with remaining daily quota and expiry, revoke, the funding path (demo token mint, transfer or approve plus `vault.deposit`), and the withdraw control that is never gated.

Exit: a run blocked by a missing session offers the session modal instead of a revert, revoking takes effect immediately, and withdraw succeeds while paused, without a session, and with an expired session.

## FM6 - Run and receipt (2 days)

`executor.run(workflowId)` sent to `vault.acceptedExecutor()`, receipt decoding into a run outcome, canvas progress replayed from the real events with the existing per step animation, the run receipt panel, and the full error mapping table with an action per code.

Exit: a six step demo strategy runs on Arc testnet and lights the canvas from real logs. A guarded stop renders as a successful early finish, not a failure. A reverted run shows a decoded human message with the matching action button.

## FM7 - Consent, polish and production checklist (1.5 days)

The executor approval banner with its zero address rule, status tokens added to the theme, the four data states on every async surface, `error.tsx` and `not-found.tsx` coverage, CSP `connect-src` for the RPC origin, keyboard and contrast pass, and the section 17 checklist.

Exit: the production ready checklist passes, Lighthouse targets hold on `/studio`, and the two product promises are demonstrable: a newly published executor moves nothing until the owner accepts it, and withdraw works in every state.

## Sequencing notes

FM2 blocks FM3, which blocks FM4. FM1 is independent of FM2 and can run in parallel. FM5 and FM6 both need FM4. FM7 closes.

Total: about eleven working days for one engineer, less with FM1 and FM2 split across two.

## Deliberately deferred

Backend persistence and the SSE stream, workflow `update` and `setActive`, Chainlink Automation registration for the trigger block, multi connector wallet support, ENS and address book, mainnet configuration. Each needs either the backend or a contract path that does not exist yet, and adding a placeholder for it now would be code written for a hypothetical need.
