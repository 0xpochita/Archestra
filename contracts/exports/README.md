# Archestra Contracts: Backend Handoff

Everything the backend needs to build `ArcChainAdapter` and the indexer, with no Solidity reading required.

- ABIs: `exports/abi/*.json`. The `I` prefixed files are interface ABIs, stable across redeploys and enough for the core flow. The unprefixed files are the concrete contracts and are the only place some members exist: `sessionOf`, `sessionSpentToday`, `Deposited` and `Withdrawn` live in `StrategyVault.json`, `pause` state in `Executor.json`, `setAdapterAllowed` and `MAX_STEPS` in `WorkflowRegistry.json`. `DemoToken.json` is the ERC20 plus `mint` of the testnet demo tokens.
- Addresses: `exports/addresses.arc-testnet.json` (chain id `5042002`, RPC `https://rpc.testnet.arc.io`)
- The backend configures exactly one address: `core.registry`. Resolve the latest published executor with the `executor()` view call at boot and treat `ExecutorPublished` and `ExecutorRetired` as config reload triggers. Key on `runId`, never on the emitting address.
- `executor()` is discovery only. The executor a given vault actually obeys is `IStrategyVault.acceptedExecutor()`, so send a run through that address, not through `executor()`. `executor()` returns the zero address when the latest published version has been retired and no replacement is published yet.

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

Workflow lifecycle events from the registry: `WorkflowCreated(uint256 indexed workflowId, address indexed owner, address vault, uint256 stepCount)`, `WorkflowUpdated(uint256 indexed workflowId, uint256 stepCount)`, `ExecutorPublished(address indexed newExecutor)`, `ExecutorRetired(address indexed oldExecutor)`.

`ExecutorChanged(address,address)` is gone. It is replaced by the `ExecutorPublished` and `ExecutorRetired` pair, because the registry now holds a set of valid executor versions rather than one pointer every vault obeys.

## Executor acceptance and spending sessions

Two owner facing states gate every run, both emitted from the vault address:

- `ExecutorAccepted(address indexed vault, address indexed executor)`: the vault now obeys this executor version. It fires once at vault creation, bootstrapped to the registry's latest published executor, and again on every `acceptExecutor` call. Publishing a newer executor never moves a vault by itself, so a UI must prompt the owner to accept before runs continue on the new version.
- `SessionSet(address indexed vault, address indexed token, uint256 maxPerRun, uint256 maxPerDay, uint64 expiresAt)` and `SessionRevoked(address indexed vault, address indexed token)`: the per token spending budget. Every non zero allowance a run grants is metered against it, `BRIDGE` steps included, with `2^256 - 1` resolved to the concrete vault balance before the check. `maxPerDay` accumulates inside `block.timestamp / 86400` buckets and resets on the next bucket.

A run reverts before touching funds when the vault has no session for a token the run spends, when the session expired, or when a grant breaches either cap. `withdraw` is unaffected by all of it: it works while paused, with no session, and after any publish, retire or accept.

## Errors

Custom errors the frontend or backend may surface, by signature:

`NotOwner()`, `NotExecutor()`, `SystemPaused()`, `WorkflowInactive()`, `EmptyWorkflow()`, `TooManySteps(uint256,uint256)`, `AdapterNotAllowed(address,uint8)`, `UnexpectedStepType(uint8,uint8)`, `InsufficientOutput(uint256,uint256)`, `StaleFeed(uint256,uint256)`, `InvalidFeedAnswer(int256)`, `DeadlinePassed(uint64)`, `ResidualBalance(address,uint256)`, `ZeroAddress()`, `RunInFlight()`, `TriggerNotDue(uint256)`, `NoTriggerStep()`, `ExecutorNotAccepted(address,address)`, `NoActiveSession(address)`, `SessionCapExceeded(address,uint256,uint256)`

## Indexer test fixture

`exports/fixtures/run-fixture.json` holds the full decoded event sequence of a real run on Arc testnet (workflow 1), including `txHash` and `gasUsed`, shaped for mapping into `run_steps` rows without a chain connection.
