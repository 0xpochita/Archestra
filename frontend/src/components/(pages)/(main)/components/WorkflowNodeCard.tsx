"use client";

import Image from "next/image";
import type { PointerEvent } from "react";
import {
  BLOCK_CATALOG,
  NODE_HEIGHT,
  NODE_ICON_SIZE,
  NODE_WIDTH,
} from "../constants";
import type { NodeRunState, WorkflowNode } from "../types";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  isSelected: boolean;
  isLocked: boolean;
  runState?: NodeRunState;
  zoom: number;
  onSelect: (id: string) => void;
  onMoveStart: () => void;
  onMove: (id: string, deltaX: number, deltaY: number) => void;
  onAddNext: (id: string) => void;
}

function NodeStatus({ runState }: { runState?: NodeRunState }) {
  if (runState === "running") {
    return (
      <Icon name="loader" className="size-4 animate-spin text-ink-muted" />
    );
  }
  if (runState === "success") {
    return <Icon name="check" className="size-4 text-ink" />;
  }
  return null;
}

export function WorkflowNodeCard({
  node,
  isSelected,
  isLocked,
  runState,
  zoom,
  onSelect,
  onMoveStart,
  onMove,
  onAddNext,
}: WorkflowNodeCardProps) {
  const definition = BLOCK_CATALOG[node.kind];
  const [primaryLogo, badgeLogo] = definition.logoImages ?? [];

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelect(node.id);
    if (isLocked) return;

    const origin = { x: event.clientX, y: event.clientY };
    let hasMoved = false;

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      if (!hasMoved) {
        hasMoved = true;
        onMoveStart();
      }
      onMove(
        node.id,
        (moveEvent.clientX - origin.x) / zoom,
        (moveEvent.clientY - origin.y) / zoom,
      );
      origin.x = moveEvent.clientX;
      origin.y = moveEvent.clientY;
    };

    const handleUp = () =>
      window.removeEventListener("pointermove", handleMove);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  };

  const shellClassName = [
    "absolute flex select-none border bg-surface shadow-sm transition-shadow",
    isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing",
    isSelected
      ? "border-ink ring-2 ring-ink/20"
      : "border-line hover:shadow-md",
    runState === "running" ? "ring-2 ring-ink/30" : "",
  ].join(" ");

  return (
    <div
      style={{
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      }}
      className={shellClassName}
      onPointerDown={handlePointerDown}
    >
      {node.kind === "trigger" ? null : (
        <span className="absolute top-1/2 -left-1 size-2 -translate-y-1/2 bg-line-strong" />
      )}
      <button
        type="button"
        aria-label={`Add a block after ${node.title}`}
        title="Add next block"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onAddNext(node.id)}
        className="absolute top-1/2 -right-2.5 grid size-5 -translate-y-1/2 place-items-center border border-line bg-surface text-ink-subtle transition-colors hover:bg-ink hover:text-on-brand"
      >
        <Icon name="plus" className="size-3" strokeWidth={2.4} />
      </button>

      <span
        style={{ width: NODE_ICON_SIZE }}
        className={`grid shrink-0 place-items-center border-r border-line ${
          definition.logo || primaryLogo
            ? "bg-surface text-ink"
            : "bg-ink text-on-brand"
        }`}
      >
        {primaryLogo ? (
          <span className="relative">
            <Image
              src={primaryLogo.src}
              alt={primaryLogo.alt}
              width={36}
              height={36}
              className="size-9 rounded-full object-cover"
            />
            {badgeLogo ? (
              <Image
                src={badgeLogo.src}
                alt={badgeLogo.alt}
                width={20}
                height={20}
                className="absolute -right-1 -bottom-1 size-5 rounded-full border-2 border-surface object-cover"
              />
            ) : null}
          </span>
        ) : null}
        {definition.logo ? (
          <Logo name={definition.logo} className="size-8" />
        ) : null}
        {definition.logo || primaryLogo ? null : (
          <Icon name={definition.icon} className="size-7" />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4">
        <span className="truncate text-xs text-ink-subtle">
          {node.subtitle}
        </span>
        <span className="truncate text-sm font-semibold text-ink">
          {node.title}
        </span>
      </span>

      {runState ? (
        <span className="grid w-10 shrink-0 place-items-center">
          <NodeStatus runState={runState} />
        </span>
      ) : null}
    </div>
  );
}
