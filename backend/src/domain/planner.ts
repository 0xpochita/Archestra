import type { BlockKind } from "../schemas/common.js";

const CANONICAL_ORDER: BlockKind[] = [
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

const KEYWORD_MAP: Array<{ keywords: string[]; kind: BlockKind }> = [
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

const PREREQUISITES: Partial<Record<BlockKind, BlockKind[]>> = {
  deposit: ["approve"],
  swap: ["approve"],
  yield: ["approve", "deposit", "harvest"],
  harvest: ["yield"],
  withdraw: ["harvest"],
  bridge: ["approve"],
  condition: ["alert"],
};

const DEFAULT_PLAN: BlockKind[] = ["deposit", "swap", "yield"];

function matchKeywords(prompt: string): Set<BlockKind> {
  const lower = prompt.toLowerCase();
  const matched = new Set<BlockKind>();
  for (const { keywords, kind } of KEYWORD_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.add(kind);
    }
  }
  return matched;
}

function expandPrerequisites(kinds: Set<BlockKind>): Set<BlockKind> {
  const expanded = new Set<BlockKind>(kinds);
  for (const kind of kinds) {
    const prereqs = PREREQUISITES[kind] ?? [];
    for (const prereq of prereqs) {
      expanded.add(prereq);
    }
  }
  return expanded;
}

function canonicalOrder(kinds: Set<BlockKind>): BlockKind[] {
  return CANONICAL_ORDER.filter((k) => kinds.has(k));
}

export interface PlanResult {
  kinds: BlockKind[];
  name: string;
  reply: string;
}

const KIND_LABELS: Record<BlockKind, string> = {
  trigger: "Start",
  bridge: "Bridge Asset",
  approve: "Approve Token",
  deposit: "Deposit",
  swap: "Swap Token",
  yield: "Yield Farm",
  harvest: "Harvest Rewards",
  withdraw: "Withdraw",
  condition: "If Condition",
  alert: "Alert",
};

export function planFromPrompt(prompt: string, _previousVersion: number): PlanResult {
  let matched = matchKeywords(prompt);

  if (matched.size === 0) {
    matched = new Set(DEFAULT_PLAN);
  }

  const expanded = expandPrerequisites(matched);
  expanded.add("trigger");
  const ordered = canonicalOrder(expanded);

  const labels = ordered.map((k) => KIND_LABELS[k]);
  const nonTriggerLabels = labels.filter((_, i) => ordered[i] !== "trigger");
  const first = nonTriggerLabels[0] ?? labels[0] ?? "Start";
  const last = nonTriggerLabels[nonTriggerLabels.length - 1] ?? first;

  const name = first === last ? `${first} flow` : `${first} to ${last} flow`;

  const n = ordered.length;
  const labelList = labels.join(" then ");
  const reply = `Drafted ${n} ${n === 1 ? "block" : "blocks"}: ${labelList}. Accept the workflow to drop it on the canvas, or ask for changes.`;

  return { kinds: ordered, name, reply };
}
