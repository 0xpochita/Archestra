import type { LogoImage, LogoName } from "@/types/logo";

export type BlockKind =
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

export type IconName =
  | "bolt"
  | "deposit"
  | "swap"
  | "yield"
  | "harvest"
  | "bridge"
  | "withdraw"
  | "approve"
  | "condition"
  | "alert"
  | "play"
  | "dots"
  | "plus"
  | "minus"
  | "fit"
  | "target"
  | "lock"
  | "unlock"
  | "undo"
  | "redo"
  | "panel"
  | "chevronDown"
  | "pencil"
  | "clock"
  | "sparkle"
  | "arrowUp"
  | "trash"
  | "close"
  | "grid"
  | "addBlocks"
  | "check"
  | "loader"
  | "search";

export interface BlockParam {
  id: string;
  label: string;
  value: string;
}

export interface BlockDefinition {
  kind: BlockKind;
  label: string;
  group: string;
  description: string;
  icon: IconName;
  logo?: LogoName;
  logoImages?: LogoImage[];
  subtitle: string;
  params: BlockParam[];
}

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  tokens: LogoName[];
  kinds: BlockKind[];
}

export interface BlockGroup {
  name: string;
  blocks: BlockDefinition[];
}

export interface WorkflowNode {
  id: string;
  kind: BlockKind;
  title: string;
  subtitle: string;
  params: BlockParam[];
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
