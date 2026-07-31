export type RunStage =
  | "connect"
  | "switch_network"
  | "fix_graph"
  | "create"
  | "open_session"
  | "fund"
  | "run";

export interface RunStageInput {
  isConnected: boolean;
  isWrongNetwork: boolean;
  canEncode: boolean;
  isCreated: boolean;
  hasMissingSession: boolean;
  isUnfunded: boolean;
}

const STAGE_LABELS: Record<RunStage, string> = {
  connect: "Preview run",
  switch_network: "Switch network",
  fix_graph: "Fix the blocks first",
  create: "Create on chain",
  open_session: "Open a session",
  fund: "Fund the vault",
  run: "Run strategy",
};

export function getRunStage(input: RunStageInput): RunStage {
  if (!input.isConnected) return "connect";
  if (input.isWrongNetwork) return "switch_network";
  if (!input.isCreated) return input.canEncode ? "create" : "fix_graph";
  if (input.hasMissingSession) return "open_session";
  if (input.isUnfunded) return "fund";
  return "run";
}

export const getRunStageLabel = (stage: RunStage) => STAGE_LABELS[stage];
