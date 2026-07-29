import { getExecutionOrder, validateGraph } from "../domain/graph.js";
import { buildNodesFromKinds } from "../domain/template.js";
import { generateId } from "../lib/ids.js";
import type { CatalogRepository } from "../repositories/catalog.js";
import type { WorkflowPatch, WorkflowRepository } from "../repositories/workflow.js";
import type {
  CreateWorkflowBody,
  ListWorkflowsQuery,
  PatchWorkflowBody,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
} from "../schemas/workflow.js";

export class WorkflowService {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly catalogRepo: CatalogRepository,
  ) {}

  async list(
    ownerId: string,
    query: ListWorkflowsQuery,
  ): Promise<{
    data: Omit<Workflow, "nodes" | "edges">[];
    nextCursor: string | null;
  }> {
    const { items, nextCursor } = await this.workflowRepo.list(ownerId, query.limit, query.cursor);
    return { data: items, nextCursor };
  }

  async create(ownerId: string, body: CreateWorkflowBody): Promise<Workflow> {
    let nodes: WorkflowNode[] = body.nodes;
    let edges: WorkflowEdge[] = body.edges;

    if (body.templateId && nodes.length === 0) {
      const template = await this.catalogRepo.getTemplate(body.templateId);
      if (template) {
        let nodeIndex = 0;
        const result = buildNodesFromKinds(template.kinds, () => {
          const id = `node-${nodeIndex}`;
          nodeIndex++;
          return id;
        });
        nodes = result.nodes;
        edges = result.edges;
      }
    }

    validateGraph(nodes, edges);

    return this.workflowRepo.create({
      id: generateId("wf"),
      ownerId,
      name: body.name,
      tokens: body.tokens,
      nodes,
      edges,
    });
  }

  async get(id: string, ownerId: string): Promise<Workflow> {
    return this.workflowRepo.getOwned(id, ownerId);
  }

  async patch(id: string, ownerId: string, body: PatchWorkflowBody): Promise<Workflow> {
    const current = await this.workflowRepo.getOwned(id, ownerId);

    const newNodes = body.nodes ?? current.nodes;
    const newEdges = body.edges ?? current.edges;

    if (body.nodes !== undefined || body.edges !== undefined) {
      validateGraph(newNodes, newEdges);
    }

    const patch: WorkflowPatch = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.tokens !== undefined) patch.tokens = body.tokens;
    if (body.nodes !== undefined) patch.nodes = body.nodes;
    if (body.edges !== undefined) patch.edges = body.edges;

    return this.workflowRepo.update(id, ownerId, patch);
  }

  async delete(id: string, ownerId: string): Promise<void> {
    return this.workflowRepo.delete(id, ownerId);
  }

  getExecutionOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    return getExecutionOrder(nodes, edges);
  }
}
