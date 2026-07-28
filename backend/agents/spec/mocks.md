# Mock Strategy

Phase 1 ships a complete API with no chain and no LLM behind it. Everything external sits behind an interface with two implementations, selected by environment variable.

| Port | Interface | Phase 1 | Later |
| --- | --- | --- | --- |
| Chain | `ChainAdapter` | `MockChainAdapter` | `ArcChainAdapter` calling the contracts |
| Planner | `PlannerAdapter` | `RulesPlanner` | `LlmPlanner` |
| Notifier | `NotifierAdapter` | `MemoryNotifier` | `TelegramNotifier` |

Swapping an implementation must not touch a service, a route, or a test that is not about that adapter.

## ChainAdapter

```ts
interface StepRequest {
  kind: BlockKind;
  params: Record<string, string>;
}

interface StepResult {
  txHash: string | null;
  gasUsed: bigint;
  error: string | null;
}

interface ChainAdapter {
  estimateGas(steps: StepRequest[]): Promise<bigint>;
  execute(step: StepRequest): Promise<StepResult>;
}
```

`MockChainAdapter` behaviour:

- `execute` resolves after `STEP_DELAY_MS` (default 700) so the UI progress feels real.
- `txHash` is a deterministic hash of run id plus position, prefixed `0x`. Simulation mode returns `null`.
- `gasUsed` per kind: trigger 0, approve 46000, deposit 180000, swap 145000, yield 210000, harvest 120000, bridge 250000, withdraw 160000, condition 35000, alert 0.
- `estimateGas` is the sum of the table plus a 10 percent buffer, no randomness.
- Failure injection: when a param `mockFail` is `"true"`, the step returns an error instead of a hash. Tests use this to cover the failed path.

No `Math.random`, no `Date.now` inside the adapter. A clock and an id generator are injected so tests can freeze both.

## PlannerAdapter

```ts
interface PlanResult {
  kinds: BlockKind[];
  name: string;
  reply: string;
}

interface PlannerAdapter {
  plan(prompt: string, previousVersion: number): Promise<PlanResult>;
}
```

`RulesPlanner` implements exactly the algorithm in `domain-model.md` section 5: keyword match, prerequisite expansion, canonical ordering, `trigger` always present, default plan on no match.

Reply text template:

```
Drafted {n} {block|blocks}: {labels joined by " then "}. Accept the workflow to drop it on the canvas, or ask for changes.
```

The same prompt always produces the same plan. This is a test requirement, not an implementation detail.

## NotifierAdapter

```ts
interface NotifierAdapter {
  send(channel: string, text: string): Promise<void>;
}
```

`MemoryNotifier` records calls in an array so tests can assert an `alert` block fired without a network call.

## Seeds

`src/db/seed.ts` loads the block catalog and the eight strategy templates listed in `domain-model.md`. The seed is idempotent, keyed by primary key, and safe to run repeatedly.

A development seed also creates one demo workflow that matches the studio's initial canvas: Start, Deposit, Swap Token, then a branch into Yield Farm and Alert.

## What mocks must not do

- Never fake the HTTP layer. Routes, validation, persistence, and error mapping are real from day one.
- Never fake the database. Integration tests use a real PostgreSQL in Docker.
- Never hide a shape difference. If the real chain will return a field, the mock returns it too, even if the value is constant.
