import {
  ALL_BLOCK_ORDER,
  BLOCK_CATALOG,
  DEFAULT_PLAN,
  NODE_HEIGHT,
  NODE_WIDTH,
  PIPELINE_ORDER,
  PLAN_PREREQUISITES,
  PROMPT_RULES,
} from "../constants";
import type {
  BlockGroup,
  BlockKind,
  EdgeGeometry,
  GraphBounds,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
} from "../types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getBlockGroups(query: string): BlockGroup[] {
  const normalized = query.trim().toLowerCase();
  const matches = ALL_BLOCK_ORDER.map((kind) => BLOCK_CATALOG[kind]).filter(
    (definition) =>
      `${definition.label} ${definition.group} ${definition.description}`
        .toLowerCase()
        .includes(normalized),
  );

  const groups: BlockGroup[] = [];
  for (const definition of matches) {
    const existing = groups.find((group) => group.name === definition.group);
    if (existing) {
      existing.blocks.push(definition);
      continue;
    }
    groups.push({ name: definition.group, blocks: [definition] });
  }

  return groups;
}

export function getEdgeGeometry(
  source: WorkflowNode,
  target: WorkflowNode,
): EdgeGeometry {
  const startX = source.x + NODE_WIDTH;
  const startY = source.y + NODE_HEIGHT / 2;
  const endX = target.x;
  const endY = target.y + NODE_HEIGHT / 2;
  const curve = Math.max(60, Math.abs(endX - startX) / 2);

  return {
    path: `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`,
    midX: (startX + endX) / 2,
    midY: (startY + endY) / 2,
  };
}

export function getGraphBounds(nodes: WorkflowNode[]): GraphBounds {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + NODE_WIDTH));
  const maxY = Math.max(...nodes.map((node) => node.y + NODE_HEIGHT));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function getExecutionOrder(graph: WorkflowGraph): string[] {
  const pending = new Map(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) {
    pending.set(edge.target, (pending.get(edge.target) ?? 0) + 1);
  }

  const queue = graph.nodes
    .filter((node) => pending.get(node.id) === 0)
    .map((node) => node.id);
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    order.push(current);
    for (const edge of graph.edges.filter((item) => item.source === current)) {
      const remaining = (pending.get(edge.target) ?? 0) - 1;
      pending.set(edge.target, remaining);
      if (remaining === 0) queue.push(edge.target);
    }
  }

  const unreached = graph.nodes
    .map((node) => node.id)
    .filter((id) => !order.includes(id));

  return [...order, ...unreached];
}

export function buildChainEdges(nodes: WorkflowNode[]): WorkflowEdge[] {
  return nodes.slice(1).map((node, index) => ({
    id: `edge-${nodes[index].id}-${node.id}`,
    source: nodes[index].id,
    target: node.id,
    label: `${index + 1}`,
  }));
}

export function createNode(
  kind: BlockKind,
  id: string,
  x: number,
  y: number,
): WorkflowNode {
  const definition = BLOCK_CATALOG[kind];
  return {
    id,
    kind,
    title: definition.label,
    subtitle: definition.subtitle,
    params: definition.params.map((param) => ({ ...param })),
    x,
    y,
  };
}

export function planBlocksFromPrompt(prompt: string): BlockKind[] {
  const normalized = prompt.toLowerCase();
  const matched = PROMPT_RULES.filter((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword)),
  ).map((rule) => rule.kind);

  const planned = new Set<BlockKind>(
    matched.length > 0 ? matched : DEFAULT_PLAN,
  );
  for (const kind of [...planned]) {
    for (const prerequisite of PLAN_PREREQUISITES[kind] ?? []) {
      planned.add(prerequisite);
    }
  }
  planned.add("trigger");

  return PIPELINE_ORDER.filter((kind) => planned.has(kind));
}

export function nameFromPlan(kinds: BlockKind[]): string {
  const named = kinds.filter((kind) => kind !== "trigger");
  const first = named.at(0);
  const last = named.at(-1);
  if (!first || !last) return "Untitled strategy";
  if (first === last) return `${BLOCK_CATALOG[first].label} flow`;
  return `${BLOCK_CATALOG[first].label} to ${BLOCK_CATALOG[last].label} flow`;
}

export function summarizePlan(kinds: BlockKind[]): string {
  const labels = kinds.map((kind) => BLOCK_CATALOG[kind].label);
  const noun = labels.length === 1 ? "block" : "blocks";
  return `Drafted ${labels.length} ${noun}: ${labels.join(" then ")}. Accept the workflow to drop it on the canvas, or ask for changes.`;
}

function toConfigKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export function getOutputRows(node: WorkflowNode) {
  return [
    { id: "tx-hash", name: "txHash", type: "String" },
    { id: "gas-used", name: "gasUsed", type: "Number" },
    ...node.params.map((param) => ({
      id: param.id,
      name: toConfigKey(param.label),
      type: "String",
    })),
  ];
}

export function toConfigLines(node: WorkflowNode): string[] {
  const key = toConfigKey;
  return [
    `strategy.${node.kind}({`,
    `  protocol: "${node.subtitle}",`,
    ...node.params.map((param) => `  ${key(param.label)}: "${param.value}",`),
    "})",
  ];
}
