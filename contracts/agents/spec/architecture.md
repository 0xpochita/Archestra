# Contract Architecture

The studio lets a user compose a chain of blocks and press Run. On chain this becomes: a stored workflow definition, a vault holding the user's funds, and an executor that walks the steps through protocol adapters.

Target chain: **Arc testnet**, USDC native. Assets in phase 1: USDC and WETH.

## 1. Component map

```
            +---------------------+
            |  WorkflowRegistry   |  stores step lists, owner, and the adapter allow list
            +----------+----------+
                       |
        reads steps    v
            +---------------------+       +------------------+
   user --> |      Executor       |-----> |  GuardModule     | Chainlink feed checks
            +----------+----------+       +------------------+
                       |
        moves funds    v
            +---------------------+
            |    StrategyVault    |  one per owner, holds ERC20 balances
            +----------+----------+
                       |
       protocol calls  v
   +---------+---------+---------+---------+
   |  Aave   | Uniswap |  Curve  |  CCIP   |   adapters, one per protocol
   +---------+---------+---------+---------+
```

`AutomationTrigger` sits beside the executor and is what a `trigger` block compiles to. It exposes a Chainlink Automation compatible `checkUpkeep` and `performUpkeep` pair.

`VaultFactory` is its own permanent, immutable contract, separate from the registry. The registry calls it on a user's first `create`, and vault addresses are CREATE2 derived from the owner, so they survive a registry or executor replacement. Nothing in the system is upgradeable: see `agents/rules/rules.template.md` section 8 for the decision record.

## 2. Block kind to on chain action

The ten kinds the studio renders map one to one onto step types. The mapping is the contract between the two teams.

| Block kind | Step type | Contract | Effect |
| --- | --- | --- | --- |
| `trigger` | `TRIGGER` | `AutomationTrigger` | schedule, no state change during a run |
| `approve` | `APPROVE` | `Executor` | vault approves an adapter for an exact amount |
| `deposit` | `SUPPLY` | `AaveAdapter` | supply asset, receive aToken into the vault |
| `swap` | `SWAP` | `UniswapAdapter` | exact input swap with `minAmountOut` and deadline |
| `yield` | `STAKE` | `CurveAdapter` | add liquidity and stake the LP in a gauge |
| `harvest` | `CLAIM` | `CurveAdapter` | claim gauge rewards into the vault |
| `bridge` | `BRIDGE` | `CcipAdapter` | send asset to a destination chain and receiver |
| `withdraw` | `REDEEM` | `AaveAdapter` | redeem aToken back to the underlying |
| `condition` | `GUARD` | `GuardModule` | read a feed, revert or stop the run when the bound fails |
| `alert` | `NOTIFY` | `Executor` | emit `AlertRaised`, an off chain worker forwards it |

`alert` is deliberately an event only. Contracts never call a web service.

## 3. Funds custody

- A `StrategyVault` is deployed per owner through a minimal proxy factory. The owner is the only address that can withdraw.
- The executor never holds a balance between steps. Anything it receives inside one run is forwarded to the vault before the run ends, and a non zero executor balance at run end is an invariant violation.
- The vault approves an adapter for one step, the adapter pulls, and the executor resets the allowance to zero in the same transaction.
- A vault never stores the executor address. It resolves `registry.executor()` at call time, so replacing the executor never touches deployed vaults.
- Trust statement, said plainly: the admin multisig can, subject to the timelock, point vaults at new executor code, and executor code can move vault funds through `approveAdapter`. The user's protection is that `withdraw` stays open in every state, including paused: the timelock delay is the exit window.

## 4. Execution model

`Executor.run(workflowId)`:

1. Load the step list from the registry and check the caller owns the workflow.
2. Check the system is not paused, and the workflow has at least one step.
3. Walk steps in stored order. The registry already stores them in the topological order the backend computed, so the executor does not sort.
4. For each step: resolve the adapter from the allow list, run the checks, move funds, call the adapter, then write the result.
5. Emit `StepExecuted` per step and `RunCompleted` at the end.
6. Any revert bubbles up and the whole run reverts. Phase 1 is all or nothing, no partial runs.

A `GUARD` step that fails its bound is not an error. It emits `GuardStopped` and ends the run successfully with a `stopped` flag, so a "risk-off unwind" strategy that finds a healthy pool is not a failed transaction.

Gas ceiling: a workflow is capped at `MAX_STEPS = 16`. The registry rejects longer lists so a run can never exceed the block gas limit.

## 5. Roles

| Role | Holder | Powers |
| --- | --- | --- |
| `DEFAULT_ADMIN_ROLE` | multisig | grant and revoke roles |
| `CURATOR_ROLE` | team key | add and remove adapters from the allow list |
| `PAUSER_ROLE` | team key and monitor bot | pause execution |
| owner | end user | create workflows, run them, withdraw from their vault |

Pausing stops execution and new runs. Withdrawal from a vault stays open while paused, always.

`DEFAULT_ADMIN_ROLE` and `CURATOR_ROLE` sit behind the multisig plus an OpenZeppelin `TimelockController`. The delay is zero on Arc testnet and is raised to 48 hours as a hard gate before any deployment that holds real value. `setExecutor` and allow list changes go through this path. `PAUSER_ROLE` stays hot on the team key and the monitor bot so pausing is never delayed.

## 6. Backend interaction

The backend does not sign transactions in phase 1. The flow is:

1. Studio calls the backend, the backend stores the graph and returns it.
2. When a user presses Run, the frontend asks the backend for the encoded step list, then the user's wallet sends `Executor.run`.
3. The backend indexes `StepExecuted` and `RunCompleted` events and fills `run_steps`, so the canvas progress in `backend/agents/spec/api.md` is the same stream whether the source is a mock or a chain.

`ChainAdapter` in the backend is the seam. `MockChainAdapter` fakes hashes now, `ArcChainAdapter` reads these events later.

The backend configures exactly one address: the registry. It resolves `executor()` with a view call at boot and treats an `ExecutorChanged` event as a config reload trigger. `deployments/arc-testnet.json` stays flat, with no proxy or implementation distinction. Historical run events remain valid at a replaced executor's address, so the indexer keys on `runId`, never on the emitting address.
