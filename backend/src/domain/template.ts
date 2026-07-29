import type { BlockKind } from "../schemas/common.js";
import type { WorkflowEdge, WorkflowNode } from "../schemas/workflow.js";

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

const KIND_SUBTITLES: Record<BlockKind, string> = {
  trigger: "schedule on Arc",
  bridge: "Chainlink CCIP",
  approve: "ERC-20 allowance",
  deposit: "Aave V3 Pool",
  swap: "Uniswap V3",
  yield: "Curve Finance",
  harvest: "Curve Gauge",
  withdraw: "Aave V3 Pool",
  condition: "Chainlink Data Feed",
  alert: "Telegram",
};

export function buildNodesFromKinds(
  kinds: BlockKind[],
  generateNodeId: () => string,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const nodes: WorkflowNode[] = kinds.map((kind, i) => ({
    id: generateNodeId(),
    kind,
    title: KIND_LABELS[kind],
    subtitle: KIND_SUBTITLES[kind],
    params: [],
    x: 60 + i * 380,
    y: 300,
  }));

  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `edge-${i}`,
      source: nodes[i]!.id,
      target: nodes[i + 1]!.id,
      label: String(i + 1),
    });
  }

  return { nodes, edges };
}
