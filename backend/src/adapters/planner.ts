import { planFromPrompt } from "../domain/planner.js";
import type { BlockKind } from "../schemas/common.js";

export interface PlanResult {
  kinds: BlockKind[];
  name: string;
  reply: string;
}

export interface PlannerAdapter {
  plan(prompt: string, previousVersion: number): Promise<PlanResult>;
}

export class RulesPlanner implements PlannerAdapter {
  async plan(prompt: string, previousVersion: number): Promise<PlanResult> {
    return planFromPrompt(prompt, previousVersion);
  }
}
