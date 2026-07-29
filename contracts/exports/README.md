# Archestra Contracts: Backend Handoff

Everything the backend needs to build `ArcChainAdapter` and the indexer, with no Solidity reading required.

- ABIs: `exports/abi/*.json` (interface ABIs, stable across redeploys)
- Addresses: `exports/addresses.arc-testnet.json` (chain id `5042002`, RPC `https://rpc.testnet.arc.io`)
- The backend configures exactly one address: `core.registry`. Resolve the executor with the `executor()` view call at boot and treat an `ExecutorChanged` event as a config reload trigger. Key on `runId`, never on the emitting address.

## StepType enum

`Step.stepType` and the `StepExecuted.stepType` field are this enum, encoded as uint8:

| Value | StepType | Studio block kind |
| --- | --- | --- |
| 0 | TRIGGER | trigger |
| 1 | APPROVE | approve |
| 2 | SUPPLY | deposit |
| 3 | SWAP | swap |
| 4 | STAKE | yield |
| 5 | CLAIM | harvest |
| 6 | BRIDGE | bridge |
| 7 | REDEEM | withdraw |
| 8 | GUARD | condition |
| 9 | NOTIFY | alert |

## Step encoding

`WorkflowRegistry.create(Step[] steps)` takes `(uint8 stepType, address adapter, bytes params)` tuples. `params` is `abi.encode(...)` per step type:

| StepType | abi.encode(...) |
| --- | --- |
| TRIGGER | `(uint64 intervalSeconds, uint64 startAt)` |
| APPROVE | `(address token, address spender, uint256 amount)` |
| SUPPLY | `(address asset, uint256 amount)` |
| SWAP | `(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 feeTier, uint64 deadline)` |
| STAKE | `(address pool, address gauge, uint256 amount, uint256 minLpOut)` |
| CLAIM | `(address gauge, uint256 minValueOut)` |
| BRIDGE | `(uint64 destinationChainSelector, address receiver, address token, uint256 amount)` |
| REDEEM | `(address asset, uint256 amount)` |
| GUARD | `(address feed, int256 bound, uint8 comparator, uint64 maxStaleSeconds)` |
| NOTIFY | `(bytes32 channel, bytes32 messageId)` |

Rules the encoder must respect:

- `amount = 2^256 - 1` (max uint256) means "the vault's whole balance of that token" for SUPPLY, SWAP, STAKE and REDEEM.
- A zero `minAmountOut`, `minLpOut` or `minValueOut` is rejected on chain as missing slippage protection.
- GUARD `comparator`: `0` stops the run when the answer is below `bound`, `1` stops when it is above.
- The adapter address per step type comes from `addresses.arc-testnet.json` under `adapters`. APPROVE and NOTIFY use the executor address itself, TRIGGER uses `core.automationTrigger`, GUARD uses `core.guardModule`.
- Max 16 steps, min 1. Steps run in array order; the backend sends its topological order.

## Run event stream (what the indexer consumes)

`runId = keccak256(abi.encode(uint256 workflowId, uint256 blockNumber, address caller, uint256 nonce))` where `nonce` is a per executor counter incremented once per run.

Sequence per run, from the executor address:

1. `RunStarted(bytes32 indexed runId, uint256 indexed workflowId, address indexed caller)`
2. Per executed step, in order: `StepExecuted(bytes32 indexed runId, uint256 indexed position, uint8 stepType, address adapter, address tokenOut, uint256 amountOut)`. `position` is zero based and maps to `run_steps.position`.
3. A NOTIFY step also emits `AlertRaised(bytes32 indexed runId, bytes32 indexed channel, bytes32 messageId)` right before its own StepExecuted.
4. A GUARD stop emits `GuardStopped(bytes32 indexed runId, uint256 indexed position, int256 answer)` instead of a StepExecuted for that position, then ends the run early. This is a successful run.
5. `RunCompleted(bytes32 indexed runId, bool stopped, uint256 stepsExecuted)` always closes the stream.

A reverted run emits nothing at all: the transaction rolls back, so only successful transactions reach the indexer.

Workflow lifecycle events from the registry: `WorkflowCreated(uint256 indexed workflowId, address indexed owner, address vault, uint256 stepCount)`, `WorkflowUpdated(uint256 indexed workflowId, uint256 stepCount)`, `ExecutorChanged(address indexed previousExecutor, address indexed newExecutor)`.

## Errors

Custom errors the frontend or backend may surface, by signature:

`NotOwner()`, `NotExecutor()`, `SystemPaused()`, `WorkflowInactive()`, `EmptyWorkflow()`, `TooManySteps(uint256,uint256)`, `AdapterNotAllowed(address,uint8)`, `UnexpectedStepType(uint8,uint8)`, `InsufficientOutput(uint256,uint256)`, `StaleFeed(uint256,uint256)`, `InvalidFeedAnswer(int256)`, `DeadlinePassed(uint64)`, `ResidualBalance(address,uint256)`, `ZeroAddress()`, `RunInFlight()`, `TriggerNotDue(uint256)`, `NoTriggerStep()`

## Indexer test fixture

`exports/fixtures/run-fixture.json` holds the full decoded event sequence of a real run on Arc testnet (workflow 1), including `txHash` and `gasUsed`, shaped for mapping into `run_steps` rows without a chain connection.
