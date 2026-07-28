# Domain Model

Every shape here is derived from what the studio already renders in `frontend/src/components/(pages)/(main)`. Field names match the frontend on purpose so no translation layer is needed.

## 1. Block kinds

```ts
type BlockKind =
  | "trigger"
  | "approve"
  | "deposit"
  | "swap"
  | "yield"
  | "harvest"
  | "bridge"
  | "withdraw"
  | "condition"
  | "alert";
```

The catalog is server owned data, not user data. One row per kind.

| Kind | Group | Protocol shown in UI | Meaning |
| --- | --- | --- | --- |
| `trigger` | Trigger | schedule on Arc | starts the run |
| `approve` | Setup | ERC-20 allowance | grant spender allowance |
| `deposit` | Liquidity | Aave V3 Pool | supply an asset |
| `swap` | Trading | Uniswap V3 | route a trade |
| `yield` | Yield | Curve Finance | stake an LP position |
| `harvest` | Yield | Curve Gauge | claim rewards |
| `bridge` | Routing | Chainlink CCIP | move an asset across chains |
| `withdraw` | Liquidity | Aave V3 Pool | exit a position |
| `condition` | Logic | Chainlink Data Feed | branch on a market value |
| `alert` | Monitoring | Telegram | notify a channel |

```ts
interface BlockParam { id: string; label: string; value: string }

interface BlockDefinition {
  kind: BlockKind;
  label: string;
  group: string;
  description: string;
  subtitle: string;
  params: BlockParam[];
}
```

`icon`, `logo`, and `logoImages` stay a frontend concern. The API returns `kind`, and the client maps it to artwork.

## 2. Workflow

```ts
interface WorkflowNode {
  id: string;
  kind: BlockKind;
  title: string;
  subtitle: string;
  params: BlockParam[];
  x: number;
  y: number;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

interface Workflow {
  id: string;
  ownerId: string;
  name: string;
  tokens: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}
```

`x` and `y` are canvas coordinates. The server stores them but never interprets them.

### Graph rules (enforced server side, 422 on violation)

1. Every `edge.source` and `edge.target` refers to an existing node id.
2. No cycles. Validation runs the same Kahn ordering used for execution.
3. At most one `trigger` node, and if present it has no incoming edge.
4. A node id is unique inside its workflow.
5. A workflow with zero nodes can be saved but cannot be run or simulated.

### Execution order

Kahn topological sort over the edges, nodes with no incoming edge first, insertion order as the tie breaker. Any node left unreached is appended at the end so a partial graph still produces a full ordering. This mirrors `getExecutionOrder` in the frontend and must produce the identical sequence for the same input.

## 3. Strategy template

```ts
interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  tokens: string[];
  kinds: BlockKind[];
}
```

Seeded, read only for clients. Applying a template builds a left to right chain: node `i` at `x = 60 + i * 380`, `y = 300`, edges connecting each node to the next with `label = index`.

Seed set: `stable-auto-compound`, `weekly-dca`, `cross-chain-yield`, `guarded-exit`, `idle-cash-sweep`, `reward-compounding-loop`, `risk-off-unwind`, `lp-bootstrap`.

## 4. Run

```ts
type NodeRunState = "running" | "success" | "failed";
type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

interface RunStep {
  id: string;
  runId: string;
  nodeId: string;
  kind: BlockKind;
  position: number;
  state: NodeRunState;
  txHash: string | null;
  gasUsed: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

interface Run {
  id: string;
  workflowId: string;
  status: RunStatus;
  mode: "live" | "simulation";
  graphSnapshot: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  steps: RunStep[];
  estimatedGas: string | null;
  createdAt: string;
  finishedAt: string | null;
}
```

A run always stores a snapshot of the graph. Editing a workflow later must not rewrite history.

The studio only knows `running` and `success` today. `failed` is additive and the client can ignore it until it handles the state.

## 5. Assistant

```ts
type ChatRole = "user" | "assistant";

interface ChatMessage { id: string; sessionId: string; role: ChatRole; text: string; createdAt: string }

interface WorkflowDraft {
  id: string;
  sessionId: string;
  name: string;
  version: number;
  kinds: BlockKind[];
  createdAt: string;
}
```

A draft is never applied automatically. The client shows it, and a separate accept call turns it into a workflow. `version` increments per session, starting at 1.

### Planner rules (deterministic in phase 1)

Keyword match, then prerequisite expansion, then canonical ordering. Identical to the frontend planner so the two stay comparable during migration.

Keyword table:

| Keywords | Kind |
| --- | --- |
| bridge, cross chain, cross-chain | `bridge` |
| approve, allowance | `approve` |
| deposit, supply, lend | `deposit` |
| swap, trade, dca, convert | `swap` |
| yield, farm, stake, compound, apy | `yield` |
| harvest, claim, reward | `harvest` |
| withdraw, exit, unstake | `withdraw` |
| if, guard, condition, drops | `condition` |
| alert, notify, telegram, discord | `alert` |

Prerequisites added once, based on the matched set only:

| Kind | Pulls in |
| --- | --- |
| `deposit` | `approve` |
| `swap` | `approve` |
| `yield` | `approve`, `deposit`, `harvest` |
| `harvest` | `yield` |
| `withdraw` | `harvest` |
| `bridge` | `approve` |
| `condition` | `alert` |

`trigger` is always added. No match at all falls back to `["deposit", "swap", "yield"]`.

Canonical order: `trigger, bridge, approve, deposit, swap, yield, harvest, withdraw, condition, alert`.

Draft name: `"<first non trigger label> to <last label> flow"`, or `"<label> flow"` when both are the same.

## 6. Identity

Phase 1 has no real auth. Every request carries `x-owner-id`, and the service treats it as the owner. The header is replaced by a wallet session in a later milestone, so no code should read it outside `middleware/auth.ts`.
