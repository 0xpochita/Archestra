# Interfaces

Every signature here is the contract between the executor, the adapters, and the backend indexer. Changing one is a breaking change and needs a version bump in `WorkflowRegistry`.

## 1. Shared types

```solidity
enum StepType {
    TRIGGER,
    APPROVE,
    SUPPLY,
    SWAP,
    STAKE,
    CLAIM,
    BRIDGE,
    REDEEM,
    GUARD,
    NOTIFY
}

struct Step {
    StepType stepType;
    address adapter;
    bytes params;
}

struct Workflow {
    address owner;
    address vault;
    uint64 createdAt;
    bool active;
    Step[] steps;
}
```

`params` is ABI encoded per step type. The encodings are fixed:

| Step type | `abi.encode(...)` |
| --- | --- |
| `TRIGGER` | `(uint64 intervalSeconds, uint64 startAt)` |
| `APPROVE` | `(address token, address spender, uint256 amount)` |
| `SUPPLY` | `(address asset, uint256 amount)` |
| `SWAP` | `(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 feeTier, uint64 deadline)` |
| `STAKE` | `(address pool, address gauge, uint256 amount, uint256 minLpOut)` |
| `CLAIM` | `(address gauge, uint256 minValueOut)` |
| `BRIDGE` | `(uint64 destinationChainSelector, address receiver, address token, uint256 amount)` |
| `REDEEM` | `(address asset, uint256 amount)` |
| `GUARD` | `(address feed, int256 bound, uint8 comparator, uint64 maxStaleSeconds)` |
| `NOTIFY` | `(bytes32 channel, bytes32 messageId)` |

`comparator`: `0` means stop when the answer is below `bound`, `1` means stop when it is above.

`amount = type(uint256).max` means "the vault's whole balance of that token" for `SUPPLY`, `SWAP`, `STAKE`, and `REDEEM`. The executor resolves it before the adapter call.

An `APPROVE` step grants an explicit allowance that is usable during the run only: the executor resets every allowance an `APPROVE` step granted to zero at run end, including when a guard stops the run early. `INV-2` holds on every path.

## 2. IWorkflowRegistry

```solidity
interface IWorkflowRegistry {
    function create(Step[] calldata steps) external returns (uint256 workflowId);
    function update(uint256 workflowId, Step[] calldata steps) external;
    function setActive(uint256 workflowId, bool active) external;
    function get(uint256 workflowId) external view returns (Workflow memory);
    function isAdapterAllowed(address adapter, StepType stepType) external view returns (bool);
    function executor() external view returns (address);
    function setExecutor(address newExecutor) external;
    function setRunInFlight(uint256 workflowId, bool inFlight) external;
}
```

Rules: `create` deploys the caller's vault on first use through the standalone `VaultFactory`. `update` reverts while a run is in flight. `MAX_STEPS` is 16. `setExecutor` is `DEFAULT_ADMIN_ROLE` only and emits `ExecutorChanged`. Vaults and modules resolve the executor through `executor()` and never store it. `setRunInFlight` is executor only and is what makes `update` revert with `RunInFlight` while a run is in flight, including against a reentrant call from inside the run itself.

## 3. IExecutor

```solidity
interface IExecutor {
    function run(uint256 workflowId) external returns (bytes32 runId);
    function estimate(uint256 workflowId) external view returns (uint256 gasEstimate);
}
```

`run` is callable by the workflow owner or by the adapter of the workflow's own `TRIGGER` step, nobody else. An allow listed trigger that is not part of the workflow cannot run it. It reverts when the system is paused, the workflow is inactive, or a step fails. Adapters are re-validated against the allow list at run time, not just at write time, so a delisted adapter can never execute again.

`estimate` sums a fixed per step type gas table that mirrors the backend `MockChainAdapter`, plus a ten percent buffer.

## 4. IStepAdapter

Every adapter implements one interface so the executor stays generic.

```solidity
interface IStepAdapter {
    function supportedType() external view returns (StepType);

    function pullPlan(bytes calldata params) external view returns (address tokenIn, uint256 amountIn);

    function execute(address vault, bytes calldata params)
        external
        returns (address tokenOut, uint256 amountOut);
}
```

`pullPlan` reports the token and amount the adapter will pull for the given params, so the executor can set the exact allowance without decoding per step type. An adapter that pulls nothing returns the zero address and zero. A `type(uint256).max` amount is resolved by the executor to the vault's balance before the approval.

Rules for every adapter:

- Pull funds from the vault with `safeTransferFrom` using the allowance the executor set for this step, never more.
- Send every output token to `vault` before returning.
- Hold no balance after the call. `assert(token.balanceOf(address(this)) == 0)` is an invariant test, not runtime code.
- Never read `msg.sender` for authorisation. The executor is the only caller and it is checked with a modifier.

## 5. IGuardModule

```solidity
interface IGuardModule {
    function check(bytes calldata params) external view returns (bool shouldContinue, int256 answer);
}
```

Reverts on a stale feed or a non positive answer. Returning `false` stops the run without reverting.

## 6. IStrategyVault

```solidity
interface IStrategyVault {
    function owner() external view returns (address);
    function deposit(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount, address to) external;
    function approveAdapter(address token, address adapter, uint256 amount) external;
}
```

`approveAdapter` is executor only, where the executor is resolved through `registry.executor()` at call time. `withdraw` is owner only and works while paused, in every reachable state.

## 6b. IVaultFactory

Standalone and immutable. Vault addresses depend only on the factory and its implementation, never on the registry.

```solidity
interface IVaultFactory {
    event VaultCreated(address indexed owner, address indexed vault);

    function createVault(address owner) external returns (address vault);
    function vaultOf(address owner) external view returns (address vault);
    function predictVault(address owner) external view returns (address vault);
    function implementation() external view returns (address);
    function registry() external view returns (address);
}
```

`createVault` is idempotent and callable by anyone: it deploys the owner's canonical vault or returns the existing one. The clone salt is derived from the owner alone. `VaultCreated` is a factory local event, the indexer does not depend on it.

## 7. Events

The backend indexer depends on these exactly.

```solidity
event WorkflowCreated(uint256 indexed workflowId, address indexed owner, address vault, uint256 stepCount);
event WorkflowUpdated(uint256 indexed workflowId, uint256 stepCount);
event ExecutorChanged(address indexed previousExecutor, address indexed newExecutor);

event RunStarted(bytes32 indexed runId, uint256 indexed workflowId, address indexed caller);
event StepExecuted(
    bytes32 indexed runId,
    uint256 indexed position,
    StepType stepType,
    address adapter,
    address tokenOut,
    uint256 amountOut
);
event GuardStopped(bytes32 indexed runId, uint256 indexed position, int256 answer);
event AlertRaised(bytes32 indexed runId, bytes32 indexed channel, bytes32 messageId);
event RunCompleted(bytes32 indexed runId, bool stopped, uint256 stepsExecuted);
```

`runId = keccak256(abi.encode(workflowId, block.number, caller, nonce))`. `nonce` is a single counter inside the executor, incremented once per run, so two runs in one block still get distinct ids. The backend uses `position` to line events up with `run_steps.position`.

Step semantics during a run: a passing `GUARD` emits `StepExecuted` like any step. A failing `GUARD` emits `GuardStopped` instead, is not counted in `stepsExecuted`, and ends the run successfully. A `NOTIFY` step emits `AlertRaised` then its `StepExecuted`. `TRIGGER` and `NOTIFY` never call an adapter.

## 8. Errors

```solidity
error NotOwner();
error NotExecutor();
error SystemPaused();
error WorkflowInactive();
error EmptyWorkflow();
error TooManySteps(uint256 given, uint256 max);
error AdapterNotAllowed(address adapter, StepType stepType);
error UnexpectedStepType(StepType given, StepType expected);
error InsufficientOutput(uint256 got, uint256 min);
error StaleFeed(uint256 updatedAt, uint256 maxStale);
error InvalidFeedAnswer(int256 answer);
error DeadlinePassed(uint64 deadline);
error ResidualBalance(address token, uint256 amount);
error ZeroAddress();
error RunInFlight();
error TriggerNotDue(uint256 nextRunAt);
error NoTriggerStep();
```
