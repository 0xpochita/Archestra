import { apiReference } from "@scalar/hono-api-reference";
import { Hono } from "hono";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Archestra API",
    version: "1.0.0",
    description: "DeFi workflow studio backend API",
  },
  servers: [{ url: "/v1" }],
  components: {
    securitySchemes: {
      ownerId: {
        type: "apiKey",
        in: "header",
        name: "x-owner-id",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "object" },
            },
            required: ["code", "message", "details"],
          },
        },
      },
      BlockParam: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          value: { type: "string" },
        },
        required: ["id", "label", "value"],
      },
      BlockDefinition: {
        type: "object",
        properties: {
          kind: { type: "string" },
          label: { type: "string" },
          group: { type: "string" },
          description: { type: "string" },
          subtitle: { type: "string" },
          params: { type: "array", items: { $ref: "#/components/schemas/BlockParam" } },
        },
        required: ["kind", "label", "group", "description", "subtitle", "params"],
      },
      StrategyTemplate: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          tokens: { type: "array", items: { type: "string" } },
          kinds: { type: "array", items: { type: "string" } },
        },
        required: ["id", "name", "description", "tokens", "kinds"],
      },
      WorkflowNode: {
        type: "object",
        properties: {
          id: { type: "string" },
          kind: { type: "string" },
          title: { type: "string" },
          subtitle: { type: "string" },
          params: { type: "array", items: { $ref: "#/components/schemas/BlockParam" } },
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["id", "kind", "title", "subtitle", "params", "x", "y"],
      },
      WorkflowEdge: {
        type: "object",
        properties: {
          id: { type: "string" },
          source: { type: "string" },
          target: { type: "string" },
          label: { type: "string" },
        },
        required: ["id", "source", "target", "label"],
      },
      Workflow: {
        type: "object",
        properties: {
          id: { type: "string" },
          ownerId: { type: "string" },
          name: { type: "string" },
          tokens: { type: "array", items: { type: "string" } },
          nodes: { type: "array", items: { $ref: "#/components/schemas/WorkflowNode" } },
          edges: { type: "array", items: { $ref: "#/components/schemas/WorkflowEdge" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "ownerId", "name", "tokens", "nodes", "edges", "createdAt", "updatedAt"],
      },
      RunStep: {
        type: "object",
        properties: {
          id: { type: "string" },
          runId: { type: "string" },
          nodeId: { type: "string" },
          kind: { type: "string" },
          position: { type: "integer" },
          state: { type: "string", enum: ["running", "success", "failed"] },
          txHash: { type: "string", nullable: true },
          gasUsed: { type: "string", nullable: true },
          error: { type: "string", nullable: true },
          startedAt: { type: "string", nullable: true },
          finishedAt: { type: "string", nullable: true },
        },
        required: ["id", "runId", "nodeId", "kind", "position", "state"],
      },
      Run: {
        type: "object",
        properties: {
          id: { type: "string" },
          workflowId: { type: "string" },
          status: {
            type: "string",
            enum: ["queued", "running", "succeeded", "failed", "cancelled"],
          },
          mode: { type: "string", enum: ["live", "simulation"] },
          steps: { type: "array", items: { $ref: "#/components/schemas/RunStep" } },
          estimatedGas: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          finishedAt: { type: "string", nullable: true, format: "date-time" },
        },
        required: ["id", "workflowId", "status", "mode", "steps", "createdAt"],
      },
    },
  },
  security: [{ ownerId: [] }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        security: [],
        responses: {
          "200": { description: "OK" },
          "503": { description: "Database unavailable" },
        },
      },
    },
    "/blocks": {
      get: {
        summary: "List block catalog",
        security: [],
        responses: {
          "200": {
            description: "Block catalog",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/BlockDefinition" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/templates": {
      get: {
        summary: "List strategy templates",
        security: [],
        responses: {
          "200": {
            description: "Templates",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/StrategyTemplate" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/workflows": {
      get: {
        summary: "List workflows",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Workflow list" } },
      },
      post: {
        summary: "Create workflow",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  tokens: { type: "array", items: { type: "string" } },
                  nodes: { type: "array" },
                  edges: { type: "array" },
                  templateId: { type: "string" },
                },
                required: ["name"],
              },
            },
          },
        },
        responses: { "201": { description: "Created workflow" } },
      },
    },
    "/workflows/{id}": {
      get: {
        summary: "Get workflow",
        responses: {
          "200": { description: "Workflow" },
          "404": { description: "Not found" },
          "403": { description: "Forbidden" },
        },
      },
      patch: {
        summary: "Update workflow",
        responses: { "200": { description: "Updated workflow" } },
      },
      delete: { summary: "Delete workflow", responses: { "204": { description: "Deleted" } } },
    },
    "/workflows/{id}/simulate": {
      post: {
        summary: "Simulate workflow",
        responses: {
          "200": { description: "Simulation run" },
          "422": { description: "Empty workflow" },
        },
      },
    },
    "/workflows/{id}/runs": {
      post: {
        summary: "Start run",
        responses: {
          "202": { description: "Run queued" },
          "409": { description: "Run in progress" },
        },
      },
      get: { summary: "List runs for workflow", responses: { "200": { description: "Run list" } } },
    },
    "/runs/{id}": {
      get: {
        summary: "Get run",
        responses: { "200": { description: "Run" }, "404": { description: "Not found" } },
      },
    },
    "/runs/{id}/events": {
      get: {
        summary: "SSE stream for run events",
        responses: { "200": { description: "SSE stream" } },
      },
    },
    "/assistant/sessions": {
      post: { summary: "Create session", responses: { "201": { description: "Session created" } } },
    },
    "/assistant/sessions/{id}": {
      delete: { summary: "Delete session", responses: { "204": { description: "Deleted" } } },
    },
    "/assistant/sessions/{id}/messages": {
      post: {
        summary: "Send message",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { text: { type: "string" } },
                required: ["text"],
              },
            },
          },
        },
        responses: { "200": { description: "Messages and draft" } },
      },
    },
    "/assistant/drafts/{id}/accept": {
      post: {
        summary: "Accept draft",
        responses: {
          "201": { description: "Created workflow" },
          "409": { description: "Already accepted" },
        },
      },
    },
  },
};

export function createOpenApiRoute() {
  const app = new Hono();

  app.get("/openapi.json", (c) => {
    return c.json(spec);
  });

  app.get(
    "/docs",
    apiReference({
      spec: { url: "/v1/openapi.json" },
      theme: "purple",
    }),
  );

  return app;
}
