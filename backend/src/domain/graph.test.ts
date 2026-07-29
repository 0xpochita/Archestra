import { describe, expect, it } from "vitest";
import type { WorkflowEdge, WorkflowNode } from "../schemas/workflow.js";
import { getExecutionOrder, validateGraph } from "./graph.js";

function makeNode(id: string, kind: WorkflowNode["kind"] = "deposit"): WorkflowNode {
  return { id, kind, title: id, subtitle: "", params: [], x: 0, y: 0 };
}

function makeEdge(source: string, target: string): WorkflowEdge {
  return { id: `${source}-${target}`, source, target, label: "" };
}

describe("validateGraph", () => {
  it("passes for valid graph", () => {
    const nodes = [makeNode("a", "trigger"), makeNode("b")];
    const edges = [makeEdge("a", "b")];
    expect(() => validateGraph(nodes, edges)).not.toThrow();
  });

  it("rejects dangling edge source", () => {
    const nodes = [makeNode("a")];
    const edges = [makeEdge("x", "a")];
    expect(() => validateGraph(nodes, edges)).toThrow(/dangling_edge/);
  });

  it("rejects dangling edge target", () => {
    const nodes = [makeNode("a")];
    const edges = [makeEdge("a", "x")];
    expect(() => validateGraph(nodes, edges)).toThrow(/dangling_edge/);
  });

  it("rejects duplicate node id", () => {
    const nodes = [makeNode("a"), makeNode("a")];
    expect(() => validateGraph(nodes, [])).toThrow(/duplicate_node_id/);
  });

  it("rejects two trigger nodes", () => {
    const nodes = [makeNode("a", "trigger"), makeNode("b", "trigger")];
    expect(() => validateGraph(nodes, [])).toThrow(/multiple_triggers/);
  });

  it("rejects trigger with incoming edge", () => {
    const nodes = [makeNode("a"), makeNode("b", "trigger")];
    const edges = [makeEdge("a", "b")];
    expect(() => validateGraph(nodes, edges)).toThrow(/trigger_has_incoming/);
  });

  it("rejects cycles", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("c", "a")];
    expect(() => validateGraph(nodes, edges)).toThrow(/cycle/);
  });

  it("allows empty graph", () => {
    expect(() => validateGraph([], [])).not.toThrow();
  });
});

describe("getExecutionOrder", () => {
  it("returns empty for empty graph", () => {
    expect(getExecutionOrder([], [])).toEqual([]);
  });

  it("preserves insertion order for disconnected nodes", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const order = getExecutionOrder(nodes, []);
    expect(order.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("returns topological order for linear chain", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    const order = getExecutionOrder(nodes, edges);
    expect(order.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("trigger comes first", () => {
    const nodes = [makeNode("step1"), makeNode("trigger", "trigger"), makeNode("step2")];
    const edges = [makeEdge("trigger", "step1"), makeEdge("step1", "step2")];
    const order = getExecutionOrder(nodes, edges);
    expect(order[0]!.kind).toBe("trigger");
  });

  it("every node appears exactly once", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c"), makeNode("d")];
    const edges = [makeEdge("a", "b"), makeEdge("a", "c"), makeEdge("b", "d"), makeEdge("c", "d")];
    const order = getExecutionOrder(nodes, edges);
    expect(order).toHaveLength(4);
    const ids = new Set(order.map((n) => n.id));
    expect(ids.size).toBe(4);
  });

  it("appends cycle-unreached nodes at the end", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c"), makeNode("d")];
    const edges = [makeEdge("a", "b"), makeEdge("c", "d"), makeEdge("d", "c")];
    const order = getExecutionOrder(nodes, edges);
    expect(order).toHaveLength(4);
    const ids = order.map((n) => n.id);
    expect(ids[0]).toBe("a");
    expect(ids[1]).toBe("b");
    expect(ids).toContain("c");
    expect(ids).toContain("d");
  });
});
