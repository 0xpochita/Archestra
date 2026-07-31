import { describe, expect, it } from "vitest";
import { createDefaultStepConfig } from "@/lib/step-config";
import type { BlockKind } from "@/types/block";
import type { WorkflowGraph, WorkflowNode } from "../types";
import { getPreflight } from "./index";

const node = (id: string, kind: BlockKind): WorkflowNode => ({
  id,
  kind,
  title: id,
  subtitle: kind,
  config: createDefaultStepConfig(kind),
  x: 0,
  y: 0,
});

const chain = (kinds: BlockKind[]): WorkflowGraph => {
  const nodes = kinds.map((kind, index) => node(`node-${index + 1}`, kind));
  return {
    nodes,
    edges: nodes.slice(1).map((target, index) => ({
      id: `edge-${index}`,
      source: nodes[index].id,
      target: target.id,
      label: `${index + 1}`,
    })),
  };
};

describe("getPreflight", () => {
  it("accepts a valid chain", () => {
    const preflight = getPreflight(chain(["trigger", "deposit", "yield"]));

    expect(preflight.problems).toHaveLength(0);
    expect(preflight.canEncode).toBe(true);
    expect(preflight.order).toEqual(["node-1", "node-2", "node-3"]);
  });

  it("rejects an empty graph", () => {
    const preflight = getPreflight({ nodes: [], edges: [] });

    expect(preflight.canEncode).toBe(false);
    expect(preflight.problems[0].message).toContain("at least one block");
  });

  it("rejects more than sixteen steps", () => {
    const kinds: BlockKind[] = Array.from({ length: 17 }, () => "deposit");
    const preflight = getPreflight(chain(kinds));

    expect(preflight.canEncode).toBe(false);
    expect(preflight.problems[0].message).toContain("at most 16 steps");
  });

  it("rejects a cycle", () => {
    const graph = chain(["deposit", "swap"]);
    graph.edges.push({
      id: "edge-loop",
      source: "node-2",
      target: "node-1",
      label: "loop",
    });

    const preflight = getPreflight(graph);

    expect(preflight.canEncode).toBe(false);
    expect(preflight.problems[0].message).toContain("loop");
  });

  it("reports a block that cannot be encoded and points at its node", () => {
    const preflight = getPreflight(chain(["condition"]));

    expect(preflight.canEncode).toBe(false);
    expect(preflight.problems[0].nodeId).toBe("node-1");
    expect(preflight.problems[0].message).toContain("price feed");
  });

  it("warns that a branch runs as one flat list", () => {
    const graph = chain(["trigger", "deposit"]);
    graph.nodes.push(node("node-3", "alert"));
    graph.edges.push({
      id: "edge-branch",
      source: "node-1",
      target: "node-3",
      label: "2",
    });

    const preflight = getPreflight(graph);

    expect(preflight.problems).toHaveLength(0);
    expect(preflight.warnings[0].message).toContain("one flat list");
  });
});
