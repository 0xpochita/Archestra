import { BLOCK_CATALOG, STRATEGY_TEMPLATES } from "@/constants/blocks";
import { createDefaultStepConfig } from "@/lib/step-config";
import type { LogoName } from "@/types/logo";
import type { BlockKind, WorkflowEdge, WorkflowNode } from "../types";

export { BLOCK_CATALOG, STRATEGY_TEMPLATES };

export const WORKFLOW_NAME = "USDC Auto-Compound Strategy";
export const BLANK_WORKFLOW_NAME = "Untitled strategy";
export const NAME_STRATEGY_TITLE = "Name your strategy";
export const NAME_STRATEGY_BODY =
  "The canvas is empty and ready. Give this strategy a name, then add the blocks it needs.";
export const NAME_STRATEGY_SUGGESTIONS = [
  "Weekly USDC compounding",
  "ETH accumulation",
  "Idle cash sweep",
];
export const STEP_RESULT_NOTES: Partial<Record<BlockKind, string>> = {
  trigger: "schedule checked",
  approve: "allowance granted",
  condition: "bound passed",
  alert: "alert emitted",
};
export const STEP_RESULT_FALLBACK = "no tokens moved";

export const GUIDED_TITLE = "Run this strategy end to end";
export const GUIDED_BODY =
  "Each step is one wallet signature. Anything already done is ticked off and skipped.";
export const GUIDED_DEMO_AMOUNT = "100";
export const GUIDED_SESSION_PER_RUN = "500";
export const GUIDED_SESSION_PER_DAY = "2000";
export const GUIDED_SESSION_DAYS = 30;
export const GUIDED_CTA = "Create workflow";

export const EMPTY_CANVAS_TITLE = "This canvas is empty";
export const EMPTY_CANVAS_BODY =
  "Add blocks from the dock below, or ask the assistant to draft the chain for you.";
export const WORKFLOW_TOKENS: LogoName[] = ["usdc"];
export const BREADCRUMB_TRAIL = ["Workflows", WORKFLOW_NAME];

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
    config: createDefaultStepConfig("trigger"),
    x: 60,
    y: 300,
  },
  {
    id: "node-2",
    kind: "deposit",
    title: "Deposit",
    subtitle: "Aave V3 Pool",
    config: createDefaultStepConfig("deposit"),
    x: 440,
    y: 300,
  },
  {
    id: "node-3",
    kind: "swap",
    title: "Swap Token",
    subtitle: "Uniswap V3",
    config: createDefaultStepConfig("swap"),
    x: 820,
    y: 300,
  },
  {
    id: "node-4",
    kind: "yield",
    title: "Yield Farm",
    subtitle: "Curve Finance",
    config: createDefaultStepConfig("yield"),
    x: 1200,
    y: 180,
  },
  {
    id: "node-5",
    kind: "alert",
    title: "Alert",
    subtitle: "Telegram",
    config: createDefaultStepConfig("alert"),
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

export const PIPELINE_ORDER: BlockKind[] = [
  "trigger",
  "bridge",
  "approve",
  "deposit",
  "swap",
  "yield",
  "harvest",
  "withdraw",
  "condition",
  "alert",
];

export const PLAN_PREREQUISITES: Partial<Record<BlockKind, BlockKind[]>> = {
  deposit: ["approve"],
  swap: ["approve"],
  yield: ["approve", "deposit", "harvest"],
  harvest: ["yield"],
  withdraw: ["harvest"],
  bridge: ["approve"],
  condition: ["alert"],
};

export const AI_SUGGESTIONS = [
  "Auto-compound my USDC yield",
  "DCA into ETH every week",
  "Alert me if APY drops",
];

export const AI_GREETING =
  "Describe a strategy and the blocks get wired onto the canvas.";
