import type { PlannerAdapter } from "../adapters/planner.js";
import { buildNodesFromKinds } from "../domain/template.js";
import { generateId } from "../lib/ids.js";
import type { AssistantRepository } from "../repositories/assistant.js";
import type { WorkflowRepository } from "../repositories/workflow.js";
import type { ChatMessage, WorkflowDraft } from "../schemas/assistant.js";
import type { Workflow } from "../schemas/workflow.js";

export class AssistantService {
  constructor(
    private readonly assistantRepo: AssistantRepository,
    private readonly workflowRepo: WorkflowRepository,
    private readonly planner: PlannerAdapter,
  ) {}

  async createSession(ownerId: string): Promise<{ id: string }> {
    return this.assistantRepo.createSession({ id: generateId("sess"), ownerId });
  }

  async deleteSession(sessionId: string, ownerId: string): Promise<void> {
    await this.assistantRepo.deleteSession(sessionId, ownerId);
  }

  async sendMessage(
    sessionId: string,
    ownerId: string,
    text: string,
  ): Promise<{ messages: ChatMessage[]; draft: WorkflowDraft }> {
    const session = await this.assistantRepo.getSession(sessionId, ownerId);
    if (!session) throw new Error("Session not found");

    const userMsg = await this.assistantRepo.addMessage({
      id: generateId("msg"),
      sessionId,
      role: "user",
      text,
    });

    const previousVersion = await this.assistantRepo.getLatestVersion(sessionId);
    const plan = await this.planner.plan(text, previousVersion);

    const assistantMsg = await this.assistantRepo.addMessage({
      id: generateId("msg"),
      sessionId,
      role: "assistant",
      text: plan.reply,
    });

    const draft = await this.assistantRepo.createDraft({
      id: generateId("draft"),
      sessionId,
      name: plan.name,
      version: previousVersion + 1,
      kinds: plan.kinds,
    });

    return { messages: [userMsg, assistantMsg], draft };
  }

  async acceptDraft(draftId: string): Promise<Workflow> {
    const draft = await this.assistantRepo.acceptDraft(draftId);

    let nodeIndex = 0;
    const { nodes, edges } = buildNodesFromKinds(draft.kinds, () => {
      const id = `node-${nodeIndex}`;
      nodeIndex++;
      return id;
    });

    const session = await this.assistantRepo.getSession(draft.sessionId, "");

    return this.workflowRepo.create({
      id: generateId("wf"),
      ownerId: session?.ownerId ?? "unknown",
      name: draft.name,
      tokens: [],
      nodes,
      edges,
    });
  }
}
