import type { BlockKind } from "../schemas/common.js";

export const STEP_TYPE: Record<BlockKind, number> = {
  trigger: 0,
  approve: 1,
  deposit: 2,
  swap: 3,
  yield: 4,
  harvest: 5,
  bridge: 6,
  withdraw: 7,
  condition: 8,
  alert: 9,
};

const BLOCK_KIND_BY_STEP_TYPE: Record<number, BlockKind> = {
  0: "trigger",
  1: "approve",
  2: "deposit",
  3: "swap",
  4: "yield",
  5: "harvest",
  6: "bridge",
  7: "withdraw",
  8: "condition",
  9: "alert",
};

export function stepTypeToBlockKind(stepType: number): BlockKind {
  const kind = BLOCK_KIND_BY_STEP_TYPE[stepType];
  if (!kind) throw new Error(`unknown stepType ${stepType}`);
  return kind;
}
