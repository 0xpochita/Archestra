# Contracts Roadmap

Six milestones. Nothing touches real value until M5.

## M0 - Foundry setup (0.5 day)

`foundry.toml` with pinned Solidity 0.8.26, OpenZeppelin installed at a pinned commit, `forge fmt` config, CI running build, fmt check, and test.

Exit: `forge build` and `forge test` green on an empty suite in CI.

## M1 - Types and registry (2 days)

`Step`, `Workflow`, `StepType`, `IWorkflowRegistry`, `WorkflowRegistry` with the adapter allow list, per owner vault deployment through a minimal proxy factory, `MAX_STEPS`.

Exit: a workflow with the studio's demo chain can be created, read back with identical bytes, and rejected when it exceeds 16 steps.

## M2 - Vault and executor (3 days)

`StrategyVault`, `Executor` walking steps, allowance set and reset per step, pausing, roles, events from `spec/interfaces.md` section 7.

Exit: a run over a list of no-op mock adapters emits `RunStarted`, one `StepExecuted` per step, and `RunCompleted`. `INV-1`, `INV-2`, and `INV-4` hold.

## M3 - Adapters against mocks (4 days)

`AaveAdapter`, `UniswapAdapter`, `CurveAdapter`, `CcipAdapter`, `GuardModule`, `AutomationTrigger`, all tested against the mocks in `spec/testing.md` section 1.

Exit: the eight seeded strategy templates from the backend spec each run end to end on mocks. Fuzz suites pass.

## M4 - Invariants and gas (2 days)

Handler based invariant suite, gas snapshot, contract size check, coverage gate.

Exit: every invariant in `spec/testing.md` section 4 passes. Demo strategy run under 900k gas. Coverage gate met.

## M5 - Arc testnet (2 days)

Deployment scripts, `deployments/arc-testnet.json`, explorer verification, fork tests against real Aave, Uniswap, and CCIP addresses.

Exit: a workflow created and run from a real wallet on Arc testnet, with events the backend indexer can read.

## M6 - Backend handoff (1 day)

Publish ABIs and typed addresses, document the encoding table, help the backend swap `MockChainAdapter` for `ArcChainAdapter`.

Exit: the studio's Run button produces a real transaction and the canvas lights up from indexed events.

## M7 - User session layer (2 days)

The registry publishes executor candidates instead of pointing at one, each vault obeys only the executor its owner accepted, and every grant is clamped by an owner set session: per run cap, per day cap, expiry, one transaction revocation. Nothing moves without an active session.

Exit: a rogue executor published by a compromised admin can move nothing from any vault whose owner did not accept it, a session breach rolls the whole run back, and the eight templates plus a scheduled trigger run pass with sessions active on a fresh Arc testnet deployment.

## Out of scope for now

Fee collection, multi owner vaults, partial run resumption, cross chain callbacks. Each one changes storage layout or trust assumptions, so each needs its own design PR.

Upgradeability is decided, not deferred: nothing is upgradeable, iteration happens through redeploy and re-pointing. See `agents/rules/rules.template.md` section 8 for the decision record and the revisit triggers.
