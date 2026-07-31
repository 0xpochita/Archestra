"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { StepConfig } from "@/lib/schemas/step-config";
import type { LogoName } from "@/types/logo";
import {
  AI_RESPONSE_DELAY_MS,
  FIT_PADDING,
  HISTORY_LIMIT,
  INITIAL_EDGES,
  INITIAL_NODES,
  INITIAL_VIEWPORT,
  NEW_NODE_STAGGER,
  NODE_HEIGHT,
  NODE_WIDTH,
  RUN_STEP_DURATION_MS,
  SIMULATION_STEP_MS,
  STRATEGY_TEMPLATES,
  WORKFLOW_NAME,
  WORKFLOW_TOKENS,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from "../constants";
import type {
  BlockKind,
  ChatMessage,
  NodeRunState,
  StrategyTemplate,
  Viewport,
  WorkflowDraft,
  WorkflowGraph,
} from "../types";
import {
  buildChainEdges,
  clamp,
  createNode,
  getExecutionOrder,
  getGraphBounds,
  getPreflight,
  nameFromPlan,
  planBlocksFromPrompt,
  summarizePlan,
} from "../utils";

interface HistoryState {
  past: WorkflowGraph[];
  present: WorkflowGraph;
  future: WorkflowGraph[];
}

const INITIAL_HISTORY: HistoryState = {
  past: [],
  present: { nodes: INITIAL_NODES, edges: INITIAL_EDGES },
  future: [],
};

interface SimulationState {
  stepIds: string[];
  completed: number;
}

const CHAIN_SPACING = 380;

export function useWorkflowStudio() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sequenceRef = useRef(INITIAL_NODES.length);
  const runOrderRef = useRef<string[]>([]);
  const thinkingTimerRef = useRef<number | null>(null);
  const appliedTemplateRef = useRef(false);
  const loadStrategyRef = useRef<(template: StrategyTemplate) => void>(
    () => {},
  );

  const [history, setHistory] = useState<HistoryState>(INITIAL_HISTORY);
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runState, setRunState] = useState<Record<string, NodeRunState>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [workflowName, setWorkflowName] = useState(WORKFLOW_NAME);
  const [workflowTokens, setWorkflowTokens] =
    useState<LogoName[]>(WORKFLOW_TOKENS);

  const graph = history.present;
  const preflight = getPreflight(graph);
  const selectedNode =
    graph.nodes.find((node) => node.id === selectedNodeId) ?? null;

  const nextId = (prefix: string) => {
    sequenceRef.current += 1;
    return `${prefix}-${sequenceRef.current}`;
  };

  const beginHistoryEntry = () =>
    setHistory((state) => ({
      past: [...state.past, state.present].slice(-HISTORY_LIMIT),
      present: state.present,
      future: [],
    }));

  const updateGraph = (updater: (current: WorkflowGraph) => WorkflowGraph) =>
    setHistory((state) => ({ ...state, present: updater(state.present) }));

  const commit = (updater: (current: WorkflowGraph) => WorkflowGraph) => {
    beginHistoryEntry();
    updateGraph(updater);
  };

  const undo = () =>
    setHistory((state) => {
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    });

  const redo = () =>
    setHistory((state) => {
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
      };
    });

  const toCanvasCenter = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 960;
    const height = rect?.height ?? 640;
    return {
      x: (width / 2 - viewport.x) / viewport.zoom,
      y: (height / 2 - viewport.y) / viewport.zoom,
    };
  };

  const addBlock = (kind: BlockKind) => {
    if (isLocked) return;
    const id = nextId("node");
    const center = toCanvasCenter();
    const offset = (sequenceRef.current % 4) * NEW_NODE_STAGGER;
    const source = selectedNodeId ?? graph.nodes.at(-1)?.id;
    const node = createNode(
      kind,
      id,
      center.x - NODE_WIDTH / 2 + offset,
      center.y - NODE_HEIGHT / 2 + offset,
    );

    commit((current) => ({
      nodes: [...current.nodes, node],
      edges: source
        ? [
            ...current.edges,
            {
              id: `edge-${source}-${id}`,
              source,
              target: id,
              label: `${current.edges.length + 1}`,
            },
          ]
        : current.edges,
    }));
    setSelectedNodeId(id);
  };

  const addBlockChain = (kinds: BlockKind[]) => {
    const bounds = getGraphBounds(graph.nodes);
    const created = kinds.map((kind, index) =>
      createNode(
        kind,
        nextId("node"),
        bounds.x + index * CHAIN_SPACING,
        bounds.y + bounds.height + 96,
      ),
    );
    const chained = buildChainEdges(created);

    commit((current) => ({
      nodes: [...current.nodes, ...created],
      edges: [...current.edges, ...chained],
    }));
    setSelectedNodeId(created.at(0)?.id ?? null);
  };

  const loadStrategy = (template: StrategyTemplate) => {
    const created = template.kinds.map((kind, index) =>
      createNode(kind, nextId("node"), 60 + index * CHAIN_SPACING, 300),
    );

    commit(() => ({ nodes: created, edges: buildChainEdges(created) }));
    setWorkflowName(template.name);
    setWorkflowTokens(template.tokens);
    setSelectedNodeId(null);
  };

  const moveNode = (id: string, deltaX: number, deltaY: number) =>
    updateGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === id
          ? { ...node, x: node.x + deltaX, y: node.y + deltaY }
          : node,
      ),
    }));

  const removeNode = (id: string) => {
    commit((current) => ({
      nodes: current.nodes.filter((node) => node.id !== id),
      edges: current.edges.filter(
        (edge) => edge.source !== id && edge.target !== id,
      ),
    }));
    setSelectedNodeId(null);
  };

  const updateConfig = (id: string, config: StepConfig) =>
    commit((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === id ? { ...node, config } : node,
      ),
    }));

  const updateNodeText = (
    id: string,
    patch: { title?: string; subtitle?: string },
  ) =>
    updateGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === id ? { ...node, ...patch } : node,
      ),
    }));

  const panBy = (deltaX: number, deltaY: number) =>
    setViewport((current) => ({
      ...current,
      x: current.x + deltaX,
      y: current.y + deltaY,
    }));

  const zoomBy = (delta: number, anchorX?: number, anchorY?: number) =>
    setViewport((current) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      const originX = anchorX ?? (rect?.width ?? 0) / 2;
      const originY = anchorY ?? (rect?.height ?? 0) / 2;
      const zoom = clamp(current.zoom + delta, ZOOM_MIN, ZOOM_MAX);
      const ratio = zoom / current.zoom;
      return {
        zoom,
        x: originX - (originX - current.x) * ratio,
        y: originY - (originY - current.y) * ratio,
      };
    });

  const fitView = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const bounds = getGraphBounds(graph.nodes);
    if (!rect || bounds.width === 0 || bounds.height === 0) return;
    const zoom = clamp(
      Math.min(
        (rect.width - FIT_PADDING * 2) / bounds.width,
        (rect.height - FIT_PADDING * 2) / bounds.height,
      ),
      ZOOM_MIN,
      ZOOM_MAX,
    );
    setViewport({
      zoom,
      x: (rect.width - bounds.width * zoom) / 2 - bounds.x * zoom,
      y: (rect.height - bounds.height * zoom) / 2 - bounds.y * zoom,
    });
  };

  const centerView = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const bounds = getGraphBounds(graph.nodes);
    if (!rect || bounds.width === 0 || bounds.height === 0) return;
    setViewport((current) => ({
      ...current,
      x:
        (rect.width - bounds.width * current.zoom) / 2 -
        bounds.x * current.zoom,
      y:
        (rect.height - bounds.height * current.zoom) / 2 -
        bounds.y * current.zoom,
    }));
  };

  const zoomTo = (zoom: number) =>
    zoomBy(clamp(zoom, ZOOM_MIN, ZOOM_MAX) - viewport.zoom);

  const playRun = (nodeIds: string[]) => {
    if (nodeIds.length === 0) return;
    runOrderRef.current = nodeIds;
    setRunState({});
    setIsRunning(true);
  };

  const runWorkflow = () => {
    if (isRunning || graph.nodes.length === 0) return;
    playRun(getExecutionOrder(graph));
  };

  const sendPrompt = (prompt: string) => {
    const question = prompt.trim();
    if (question.length === 0 || isThinking) return;
    setMessages((current) => [
      ...current,
      { id: nextId("message"), role: "user", text: question },
    ]);
    setIsThinking(true);
    thinkingTimerRef.current = window.setTimeout(() => {
      const kinds = planBlocksFromPrompt(question);
      setDraft((current) => ({
        name: nameFromPlan(kinds),
        version: (current?.version ?? 0) + 1,
        kinds,
      }));
      setMessages((current) => [
        ...current,
        {
          id: nextId("message"),
          role: "assistant",
          text: summarizePlan(kinds),
        },
      ]);
      setIsThinking(false);
    }, AI_RESPONSE_DELAY_MS);
  };

  const acceptDraft = () => {
    if (!draft) return;
    const created = draft.kinds.map((kind, index) =>
      createNode(kind, nextId("node"), 60 + index * CHAIN_SPACING, 300),
    );

    commit(() => ({ nodes: created, edges: buildChainEdges(created) }));
    setWorkflowName(draft.name);
    setSelectedNodeId(null);
    setIsAssistantOpen(false);
  };

  useEffect(() => {
    if (!isRunning) return;
    const order = runOrderRef.current;
    let step = 0;
    const timer = window.setInterval(() => {
      setRunState((state) => {
        const next = { ...state };
        const previousId = order[step - 1];
        const currentId = order[step];
        if (previousId) next[previousId] = "success";
        if (currentId) next[currentId] = "running";
        return next;
      });
      step += 1;
      if (step > order.length) {
        window.clearInterval(timer);
        setIsRunning(false);
      }
    }, RUN_STEP_DURATION_MS);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  const requestedTemplateId = useSearchParams().get("template");
  loadStrategyRef.current = loadStrategy;

  useEffect(() => {
    if (!requestedTemplateId || appliedTemplateRef.current) return;
    const template = STRATEGY_TEMPLATES.find(
      (item) => item.id === requestedTemplateId,
    );
    if (!template) return;
    appliedTemplateRef.current = true;
    loadStrategyRef.current(template);
  }, [requestedTemplateId]);

  const openSimulation = () => {
    if (graph.nodes.length === 0) return;
    setSimulation({ stepIds: getExecutionOrder(graph), completed: 0 });
  };

  const closeSimulation = () => setSimulation(null);

  const replaySimulation = () =>
    setSimulation((current) => (current ? { ...current, completed: 0 } : null));

  useEffect(() => {
    if (!simulation || simulation.completed >= simulation.stepIds.length)
      return;
    const timer = window.setTimeout(() => {
      setSimulation((current) =>
        current ? { ...current, completed: current.completed + 1 } : current,
      );
    }, SIMULATION_STEP_MS);

    return () => window.clearTimeout(timer);
  }, [simulation]);

  const simulationSteps = (simulation?.stepIds ?? []).flatMap((id) => {
    const node = graph.nodes.find((item) => item.id === id);
    return node ? [node] : [];
  });

  useEffect(
    () => () => {
      if (thinkingTimerRef.current !== null) {
        window.clearTimeout(thinkingTimerRef.current);
      }
    },
    [],
  );

  return {
    canvasRef,
    graph,
    preflight,
    viewport,
    selectedNode,
    selectedNodeId,
    isBlockLibraryOpen,
    isTemplateMenuOpen,
    isAssistantOpen,
    isSimulationOpen: simulation !== null,
    simulationCompleted: simulation?.completed ?? 0,
    simulationSteps,
    draft,
    isLocked,
    isRunning,
    isThinking,
    messages,
    runState,
    workflowName,
    workflowTokens,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    zoomStep: ZOOM_STEP,
    addBlock,
    beginHistoryEntry,
    centerView,
    fitView,
    loadStrategy,
    zoomTo,
    moveNode,
    panBy,
    redo,
    removeNode,
    playRun,
    runWorkflow,
    selectNode: setSelectedNodeId,
    sendPrompt,
    setWorkflowName,
    startBlockAfter: (id: string) => {
      setSelectedNodeId(id);
      setIsTemplateMenuOpen(false);
      setIsBlockLibraryOpen(true);
    },
    acceptDraft,
    clearAssistant: () => {
      setMessages([]);
      setDraft(null);
    },
    closeAssistant: () => setIsAssistantOpen(false),
    openAssistant: () => setIsAssistantOpen(true),
    closeSimulation,
    openSimulation,
    replaySimulation,
    applyTemplate: (kinds: BlockKind[]) => {
      addBlockChain(kinds);
      setIsTemplateMenuOpen(false);
    },
    dismissMenus: () => {
      setIsBlockLibraryOpen(false);
      setIsTemplateMenuOpen(false);
    },
    toggleBlockLibrary: () => {
      setIsTemplateMenuOpen(false);
      setIsBlockLibraryOpen((open) => !open);
    },
    toggleTemplateMenu: () => {
      setIsBlockLibraryOpen(false);
      setIsTemplateMenuOpen((open) => !open);
    },
    toggleLock: () => setIsLocked((locked) => !locked),
    undo,
    updateConfig,
    updateNodeText,
    zoomBy,
  };
}
