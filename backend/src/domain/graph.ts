import { invalidGraph } from "../lib/errors.js";
import type { WorkflowEdge, WorkflowNode } from "../schemas/workflow.js";

export function validateGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
  const nodeIds = new Set<string>();

  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      throw invalidGraph(`duplicate_node_id: node id "${node.id}" appears more than once`);
    }
    nodeIds.add(node.id);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      throw invalidGraph(`dangling_edge: edge source "${edge.source}" does not refer to a node`);
    }
    if (!nodeIds.has(edge.target)) {
      throw invalidGraph(`dangling_edge: edge target "${edge.target}" does not refer to a node`);
    }
  }

  const triggers = nodes.filter((n) => n.kind === "trigger");
  if (triggers.length > 1) {
    throw invalidGraph("multiple_triggers: at most one trigger node is allowed");
  }

  if (triggers.length === 1) {
    const triggerId = triggers[0]!.id;
    const hasIncoming = edges.some((e) => e.target === triggerId);
    if (hasIncoming) {
      throw invalidGraph("trigger_has_incoming: the trigger node must not have incoming edges");
    }
  }

  detectCycle(nodes, edges);
}

function detectCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  let visited = 0;
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    visited++;
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (visited < nodes.length) {
    throw invalidGraph("cycle: the graph contains a cycle");
  }
}

export function getExecutionOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  if (nodes.length === 0) return [];

  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const insertionIndex = new Map<string, number>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
    insertionIndex.set(node.id, i);
  }

  for (const edge of edges) {
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) {
      queue.push(node.id);
    }
  }

  queue.sort((a, b) => (insertionIndex.get(a) ?? 0) - (insertionIndex.get(b) ?? 0));

  const ordered: WorkflowNode[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    visited.add(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (node) ordered.push(node);

    const neighbors = adjacency.get(nodeId) ?? [];
    const readyNeighbors: string[] = [];

    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) readyNeighbors.push(neighbor);
    }

    readyNeighbors.sort((a, b) => (insertionIndex.get(a) ?? 0) - (insertionIndex.get(b) ?? 0));
    queue.push(...readyNeighbors);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }

  return ordered;
}
