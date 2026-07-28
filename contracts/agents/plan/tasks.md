# Contract Tasks

One task per pull request. `SC-x` ids are stable, do not renumber. Every task inherits the Definition of Done in `agents/rules/rules.template.md` section 9.

## M0 - Setup

### SC-01 Foundry project
Scope: `foundry.toml` pinned to Solidity 0.8.26, optimizer 200 runs, remappings, OpenZeppelin at a pinned commit, `.env.example`, `.gitignore` covering `.env` and `cache/`.
Accept: `forge build` and `forge test` pass in CI. No floating pragma anywhere.

### SC-02 CI pipeline
Scope: workflow running `forge fmt --check`, `forge build --sizes`, `forge test -vvv`, `forge coverage`, `forge snapshot --check`.
Accept: a formatting violation and a gas regression each fail the pipeline.

## M1 - Types and registry

### SC-03 Shared types and interfaces
Scope: `StepType`, `Step`, `Workflow`, and every `I*.sol` from `spec/interfaces.md`, plus the error list.
Accept: interfaces compile standalone. Encoding table documented in NatSpec on `Step`.

### SC-04 Vault factory
Scope: standalone immutable `VaultFactory`, one `StrategyVault` clone per owner, CREATE2 address derived from the owner, `deposit`, `withdraw`, `approveAdapter`. The vault resolves the executor through `registry.executor()` and never stores it.
Accept: a second `create` for the same owner reuses the vault. `withdraw` by a non owner reverts `NotOwner`. `approveAdapter` by a non executor reverts `NotExecutor`. The factory address is independent of the registry, so vault addresses survive a registry redeploy.

### SC-05 WorkflowRegistry
Scope: create, update, `setActive`, get, adapter allow list keyed by `(adapter, stepType)`, `MAX_STEPS = 16`, `executor` pointer with `setExecutor` under `DEFAULT_ADMIN_ROLE` emitting `ExecutorChanged`.
Accept: 0 steps reverts `EmptyWorkflow`, 17 steps reverts `TooManySteps`, update during a run reverts. `WorkflowCreated` and `WorkflowUpdated` emitted with the right arguments. `setExecutor` by a non admin reverts.

## M2 - Vault and executor

### SC-06 Executor core
Scope: `run`, ownership check, pause check, step walk, `runId` derivation, event emission.
Accept: events match `spec/interfaces.md` section 7 exactly, including `position` ordering. Non owner reverts `NotOwner`.

### SC-07 Allowance lifecycle
Scope: set allowance before an adapter call, reset to zero after, `type(uint256).max` amount resolution against the vault balance.
Accept: `INV-2` passes. A reverting adapter leaves no allowance behind because the whole run reverts.

### SC-08 Pause and roles
Scope: `AccessControl` with `DEFAULT_ADMIN_ROLE`, `CURATOR_ROLE`, `PAUSER_ROLE`, `Pausable` on execution only.
Accept: paused run reverts `SystemPaused`, paused withdrawal still succeeds. Role changes emit standard events.

## M3 - Adapters

### SC-09 Mock suite
Scope: `MockERC20` (6 and 18 decimals), `MockAavePool`, `MockSwapRouter`, `MockGauge`, `MockAggregator`, `MockCcipRouter`, `RevertingAdapter`.
Accept: mocks live only in `test/mocks/` and are never imported from `src/`.

### SC-10 AaveAdapter
Scope: `SUPPLY` and `REDEEM`, aToken accounting, output forwarded to the vault.
Accept: supply then redeem round trips with no residual balance. `ResidualBalance` invariant holds.

### SC-11 UniswapAdapter
Scope: `SWAP` with `minAmountOut`, `feeTier`, and `deadline`.
Accept: output below the minimum reverts `InsufficientOutput`. A past deadline reverts `DeadlinePassed`. Fuzz suite passes.

### SC-12 CurveAdapter
Scope: `STAKE` add liquidity and gauge deposit, `CLAIM` reward collection with `minValueOut`.
Accept: rewards land in the vault, not the adapter. Claiming with nothing accrued reverts `InsufficientOutput`.

### SC-13 CcipAdapter
Scope: `BRIDGE` with destination selector and receiver, fee handling.
Accept: the router receives the encoded message and the token leaves the vault exactly once.

### SC-14 GuardModule
Scope: `check` reading a Chainlink feed, comparator, staleness and answer bounds, `GuardStopped` path in the executor.
Accept: stale feed reverts `StaleFeed`, non positive answer reverts `InvalidFeedAnswer`, a failed bound ends the run with `stopped = true` and does not revert.

### SC-15 AutomationTrigger
Scope: `checkUpkeep` and `performUpkeep`, interval and start time from the `TRIGGER` params, executor allow listed as caller.
Accept: performing before the interval elapses reverts. Only the trigger and the owner can call `run`.

### SC-16 Template end to end tests
Scope: one test per seeded template in `backend/agents/spec/domain-model.md` section 3.
Accept: all eight run to completion on mocks with the expected vault balance change.

## M4 - Invariants and gas

### SC-17 Invariant suite
Scope: handler contract driving deposits, runs, withdrawals, pauses, and the six invariants in `spec/testing.md` section 4.
Accept: 256 runs, depth 64, all invariants hold in CI.

### SC-18 Gas and size budget
Scope: `.gas-snapshot`, size report, split any contract approaching 24kB.
Accept: demo strategy run under 900k gas, every contract under the size limit with margin.

## M5 - Arc testnet

### SC-19 Deployment scripts
Scope: `script/DeployCore.s.sol` and `script/DeployAdapters.s.sol`, idempotent, addresses from environment.
Accept: rerunning the script does not deploy a duplicate. `deployments/arc-testnet.json` records address, commit, constructor arguments, and verification status.

### SC-20 Fork tests
Scope: fork tests for Aave, Uniswap, and CCIP adapters against Arc testnet, skipped without an RPC variable.
Accept: each asserts a real vault balance change, not just a non reverting call.

## M6 - Handoff

### SC-21 ABI package
Scope: export ABIs and addresses in a shape the backend can import, document the `params` encoding table in one place.
Accept: the backend builds `ArcChainAdapter` without reading Solidity source.

### SC-22 Indexer contract test
Scope: a fixture emitting the full event sequence for one run so the backend can test its indexer without a chain.
Accept: the backend maps the fixture into `run_steps` rows with the correct `position`, `state`, `txHash`, and `gasUsed`.
