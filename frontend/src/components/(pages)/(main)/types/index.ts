export type {
  BlockDefinition,
  BlockGroup,
  BlockKind,
  BlockParam,
  StrategyTemplate,
} from "@/types/block";

import type { StepConfig } from "@/lib/schemas/step-config";
import type { BlockKind } from "@/types/block";

export interface WorkflowNode {
  id: string;
  kind: BlockKind;
  title: string;
  subtitle: string;
  config: StepConfig;
  x: number;
  y: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface GraphBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgeGeometry {
  path: string;
  midX: number;
  midY: number;
}

export type NodeRunState = "running" | "success";

export interface WorkflowDraft {
  name: string;
  version: number;
  kinds: BlockKind[];
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

export interface GraphProblem {
  nodeId?: string;
  message: string;
}

export interface Preflight {
  order: string[];
  orderedNodes: WorkflowNode[];
  problems: GraphProblem[];
  warnings: GraphProblem[];
  canEncode: boolean;
}
