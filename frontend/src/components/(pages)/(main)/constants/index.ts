import type {
  BlockDefinition,
  BlockKind,
  StrategyTemplate,
  WorkflowEdge,
  WorkflowNode,
} from "../types";

export const WORKFLOW_NAME = "USDC Auto-Compound Strategy";
export const WORKFLOW_UPDATED_LABEL = "Updated 24 minutes ago";
export const BREADCRUMB_TRAIL = ["Archestra", "Workflows", WORKFLOW_NAME];

export const NODE_WIDTH = 300;
export const NODE_HEIGHT = 72;
export const NODE_ICON_SIZE = 72;

export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 1.8;
export const ZOOM_STEP = 0.1;
export const FIT_PADDING = 72;
export const GRID_DOT_SPACING = 22;
export const HISTORY_LIMIT = 40;
export const RUN_STEP_DURATION_MS = 650;
export const AI_RESPONSE_DELAY_MS = 900;
export const SIMULATION_STEP_MS = 700;
export const NEW_NODE_STAGGER = 28;

export const INITIAL_VIEWPORT = { x: 48, y: 40, zoom: 0.82 };

export const ARC_LOGO_SRC = "/assets/images/logo/logo-chain/arc-logo.jpg";
export const USDC_LOGO_SRC = "/assets/images/logo/logo-token/usdc-logo.svg";

export const BLOCK_CATALOG: Record<BlockKind, BlockDefinition> = {
  trigger: {
    kind: "trigger",
    label: "Start",
    group: "Trigger",
    description: "Kick off the strategy on a schedule or on demand.",
    icon: "bolt",
    logoImages: [
      { src: USDC_LOGO_SRC, alt: "USDC" },
      { src: ARC_LOGO_SRC, alt: "Arc" },
    ],
    subtitle: "Every 24 hours",
    params: [
      { id: "schedule", label: "Schedule", value: "Daily 00:00 UTC" },
      { id: "network", label: "Network", value: "Arc" },
    ],
  },
  approve: {
    kind: "approve",
    label: "Approve Token",
    group: "Setup",
    description: "Grant a protocol permission to move an asset.",
    icon: "approve",
    logo: "ethereum",
    subtitle: "ERC-20 allowance",
    params: [
      { id: "asset", label: "Asset", value: "USDC" },
      { id: "spender", label: "Spender", value: "Aave V3 Pool" },
      { id: "amount", label: "Amount", value: "Exact" },
    ],
  },
  deposit: {
    kind: "deposit",
    label: "Deposit",
    group: "Liquidity",
    description: "Supply an asset into a lending pool or vault.",
    icon: "deposit",
    logo: "aave",
    subtitle: "Aave V3 Pool",
    params: [
      { id: "asset", label: "Asset", value: "USDC" },
      { id: "amount", label: "Amount", value: "5,000" },
      { id: "chain", label: "Chain", value: "Arc" },
    ],
  },
  swap: {
    kind: "swap",
    label: "Swap Token",
    group: "Trading",
    description: "Route a trade through the best available pool.",
    icon: "swap",
    logo: "uniswap",
    subtitle: "Uniswap V3",
    params: [
      { id: "from", label: "From", value: "USDC" },
      { id: "to", label: "To", value: "WETH" },
      { id: "slippage", label: "Slippage", value: "0.5%" },
    ],
  },
  yield: {
    kind: "yield",
    label: "Yield Farm",
    group: "Yield",
    description: "Stake an LP position and auto-compound rewards.",
    icon: "yield",
    logo: "curve",
    subtitle: "Curve Finance",
    params: [
      { id: "pool", label: "Pool", value: "USDC / WETH 0.05%" },
      { id: "strategy", label: "Strategy", value: "Auto-compound" },
      { id: "apy", label: "Est. APY", value: "18.4%" },
    ],
  },
  harvest: {
    kind: "harvest",
    label: "Harvest Rewards",
    group: "Yield",
    description: "Claim accrued incentives once they clear a threshold.",
    icon: "harvest",
    logo: "curve",
    subtitle: "Curve Gauge",
    params: [
      { id: "claim", label: "Claim", value: "CRV + CVX" },
      { id: "min-value", label: "Min value", value: "$25" },
    ],
  },
  bridge: {
    kind: "bridge",
    label: "Bridge Asset",
    group: "Routing",
    description: "Move an asset across chains before the next step.",
    icon: "bridge",
    logo: "chainlink",
    subtitle: "Chainlink CCIP",
    params: [
      { id: "from", label: "From", value: "Ethereum" },
      { id: "to", label: "To", value: "Arc" },
      { id: "asset", label: "Asset", value: "USDC" },
    ],
  },
  withdraw: {
    kind: "withdraw",
    label: "Withdraw",
    group: "Liquidity",
    description: "Pull a position back out of a pool or vault.",
    icon: "withdraw",
    logo: "aave",
    subtitle: "Aave V3 Pool",
    params: [
      { id: "asset", label: "Asset", value: "aUSDC" },
      { id: "amount", label: "Amount", value: "Max" },
    ],
  },
  condition: {
    kind: "condition",
    label: "Condition",
    group: "Logic",
    description: "Branch the run when a market value crosses a limit.",
    icon: "condition",
    logo: "chainlink",
    subtitle: "Chainlink Data Feed",
    params: [
      { id: "watch", label: "Watch", value: "Pool APY" },
      { id: "if", label: "If", value: "< 8%" },
      { id: "then", label: "Then", value: "Rebalance" },
    ],
  },
  alert: {
    kind: "alert",
    label: "Alert",
    group: "Monitoring",
    description: "Notify a channel when a step fails or drifts.",
    icon: "alert",
    logo: "telegram",
    subtitle: "Telegram",
    params: [
      { id: "trigger", label: "Trigger", value: "Failure or slippage" },
      { id: "channel", label: "Channel", value: "@defi-ops" },
    ],
  },
};

export const DOCK_BLOCK_ORDER: BlockKind[] = [
  "trigger",
  "deposit",
  "swap",
  "yield",
  "harvest",
  "bridge",
  "alert",
];

export const ALL_BLOCK_ORDER: BlockKind[] = [
  "trigger",
  "approve",
  "deposit",
  "swap",
  "yield",
  "harvest",
  "bridge",
  "withdraw",
  "condition",
  "alert",
];

export const INITIAL_NODES: WorkflowNode[] = [
  {
    id: "node-1",
    kind: "trigger",
    title: "Start",
    subtitle: "Every 24 hours",
    params: BLOCK_CATALOG.trigger.params,
    x: 60,
    y: 300,
  },
  {
    id: "node-2",
    kind: "deposit",
    title: "Deposit",
    subtitle: "Aave V3 Pool",
    params: BLOCK_CATALOG.deposit.params,
    x: 440,
    y: 300,
  },
  {
    id: "node-3",
    kind: "swap",
    title: "Swap Token",
    subtitle: "Uniswap V3",
    params: BLOCK_CATALOG.swap.params,
    x: 820,
    y: 300,
  },
  {
    id: "node-4",
    kind: "yield",
    title: "Yield Farm",
    subtitle: "Curve Finance",
    params: BLOCK_CATALOG.yield.params,
    x: 1200,
    y: 180,
  },
  {
    id: "node-5",
    kind: "alert",
    title: "Alert",
    subtitle: "Telegram",
    params: BLOCK_CATALOG.alert.params,
    x: 1200,
    y: 420,
  },
];

export const INITIAL_EDGES: WorkflowEdge[] = [
  { id: "edge-node-1-node-2", source: "node-1", target: "node-2", label: "1" },
  { id: "edge-node-2-node-3", source: "node-2", target: "node-3", label: "2" },
  { id: "edge-node-3-node-4", source: "node-3", target: "node-4", label: "3" },
  { id: "edge-node-3-node-5", source: "node-3", target: "node-5", label: "3" },
];

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: "stable-auto-compound",
    name: "Stablecoin auto-compound",
    description: "Supply USDC, farm the pair and reinvest rewards daily.",
    kinds: ["approve", "deposit", "yield", "harvest"],
  },
  {
    id: "weekly-dca",
    name: "Weekly ETH accumulation",
    description: "Swap a fixed amount into ETH every week and report it.",
    kinds: ["trigger", "swap", "alert"],
  },
  {
    id: "cross-chain-yield",
    name: "Cross-chain yield hop",
    description: "Bridge idle stables to Arc, then park them in a vault.",
    kinds: ["bridge", "approve", "deposit", "yield"],
  },
  {
    id: "guarded-exit",
    name: "Guarded farm exit",
    description: "Watch pool APY and unwind the position when it drops.",
    kinds: ["condition", "harvest", "withdraw", "alert"],
  },
  {
    id: "lp-bootstrap",
    name: "LP bootstrap",
    description: "Split a stable balance into a pair and stake the position.",
    kinds: ["approve", "swap", "yield"],
  },
];

export const PROMPT_RULES: { keywords: string[]; kind: BlockKind }[] = [
  { keywords: ["bridge", "cross chain", "cross-chain"], kind: "bridge" },
  { keywords: ["approve", "allowance"], kind: "approve" },
  { keywords: ["deposit", "supply", "lend"], kind: "deposit" },
  { keywords: ["swap", "trade", "dca", "convert"], kind: "swap" },
  { keywords: ["yield", "farm", "stake", "compound", "apy"], kind: "yield" },
  { keywords: ["harvest", "claim", "reward"], kind: "harvest" },
  { keywords: ["withdraw", "exit", "unstake"], kind: "withdraw" },
  { keywords: ["if", "guard", "condition", "drops"], kind: "condition" },
  { keywords: ["alert", "notify", "telegram", "discord"], kind: "alert" },
];

export const DEFAULT_PLAN: BlockKind[] = ["deposit", "swap", "yield"];

export const AI_SUGGESTIONS = [
  "Auto-compound my USDC yield",
  "DCA into ETH every week",
  "Alert me if APY drops",
];

export const AI_GREETING =
  "Describe a strategy and the blocks get wired onto the canvas.";
