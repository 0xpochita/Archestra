"use client";

import type { PointerEvent, RefObject, WheelEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  EMPTY_CANVAS_BODY,
  EMPTY_CANVAS_TITLE,
  GRID_DOT_SPACING,
  GUIDED_CTA,
  NODE_WIDTH,
  ZOOM_STEP,
} from "../constants";
import type { NodeRunState, Viewport, WorkflowGraph } from "../types";
import { getEdgeGeometry, getGraphBounds } from "../utils";
import { WorkflowNodeCard } from "./WorkflowNodeCard";

interface WorkflowCanvasProps {
  canvasRef: RefObject<HTMLDivElement | null>;
  graph: WorkflowGraph;
  viewport: Viewport;
  selectedNodeId: string | null;
  runState: Record<string, NodeRunState>;
  problemNodeIds: string[];
  isLocked: boolean;
  onPan: (deltaX: number, deltaY: number) => void;
  onZoom: (delta: number, anchorX: number, anchorY: number) => void;
  onSelect: (id: string | null) => void;
  onMoveStart: () => void;
  onMoveNode: (id: string, deltaX: number, deltaY: number) => void;
  onAddNext: (id: string) => void;
  onAddFirstBlock: () => void;
  onGuidedSetup: () => void;
}

export function WorkflowCanvas({
  canvasRef,
  graph,
  viewport,
  selectedNodeId,
  runState,
  problemNodeIds,
  isLocked,
  onPan,
  onZoom,
  onSelect,
  onMoveStart,
  onMoveNode,
  onAddNext,
  onAddFirstBlock,
  onGuidedSetup,
}: WorkflowCanvasProps) {
  const bounds = getGraphBounds(graph.nodes);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    onSelect(null);
    const origin = { x: event.clientX, y: event.clientY };

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      onPan(moveEvent.clientX - origin.x, moveEvent.clientY - origin.y);
      origin.x = moveEvent.clientX;
      origin.y = moveEvent.clientY;
    };

    const handleUp = () =>
      window.removeEventListener("pointermove", handleMove);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    onZoom(
      event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP,
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  };

  return (
    <div
      ref={canvasRef}
      role="application"
      aria-label="Workflow canvas"
      className="workflow-grid relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing"
      style={{
        backgroundSize: `${GRID_DOT_SPACING * viewport.zoom}px ${GRID_DOT_SPACING * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
      onPointerDown={handlePointerDown}
      onWheel={handleWheel}
    >
      {graph.nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="flex max-w-xs flex-col items-center gap-3 text-center">
            <span className="grid size-11 place-items-center border border-dashed border-line-strong bg-surface text-ink-subtle">
              <Icon name="addBlocks" className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-ink">
                {EMPTY_CANVAS_TITLE}
              </p>
              <p className="text-xs leading-relaxed text-ink-subtle">
                {EMPTY_CANVAS_BODY}
              </p>
            </div>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onAddFirstBlock}
              className="pointer-events-auto flex items-center gap-2 bg-brand px-3.5 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
            >
              <Icon name="plus" className="size-4" />
              Add your first block
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        <svg className="pointer-events-none absolute top-0 left-0 size-px overflow-visible">
          <title>Workflow connections</title>
          {graph.edges.map((edge) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            if (!source || !target) return null;
            const geometry = getEdgeGeometry(source, target);
            const isActive =
              selectedNodeId === edge.source || selectedNodeId === edge.target;

            return (
              <g key={edge.id}>
                <path
                  d={geometry.path}
                  fill="none"
                  strokeWidth={2}
                  className={isActive ? "stroke-brand" : "stroke-line-strong"}
                />
                <circle
                  cx={geometry.midX}
                  cy={geometry.midY}
                  r={13}
                  strokeWidth={1.5}
                  className={`fill-surface-raised ${
                    isActive ? "stroke-brand" : "stroke-line-strong"
                  }`}
                />
                <text
                  x={geometry.midX}
                  y={geometry.midY + 4}
                  textAnchor="middle"
                  className="fill-ink-muted text-[11px] font-medium"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}
        </svg>

        {graph.nodes.map((node) => (
          <WorkflowNodeCard
            key={node.id}
            node={node}
            isSelected={node.id === selectedNodeId}
            isLocked={isLocked}
            hasProblem={problemNodeIds.includes(node.id)}
            runState={runState[node.id]}
            zoom={viewport.zoom}
            onSelect={onSelect}
            onMoveStart={onMoveStart}
            onMove={onMoveNode}
            onAddNext={onAddNext}
          />
        ))}

        {graph.nodes.length > 0 ? (
          <div
            style={{
              left: bounds.x,
              top: bounds.y + bounds.height + 40,
              width: Math.max(bounds.width, NODE_WIDTH),
            }}
            className="absolute grid place-items-center"
          >
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onGuidedSetup}
              className="flex items-center gap-2 border border-ink bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-lg transition-opacity hover:opacity-90"
            >
              <Icon name="play" className="size-4" />
              {GUIDED_CTA}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
