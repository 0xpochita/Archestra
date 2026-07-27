"use client";

import type { IconName } from "../types";
import { Icon } from "./Icon";

interface CanvasToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
}

interface ToolbarButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
}

function ToolbarButton({ icon, label, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 place-items-center text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
    >
      <Icon name={icon} className="size-4" />
    </button>
  );
}

export function CanvasToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-1 border border-line bg-surface/90 p-1.5 shadow-lg backdrop-blur-xl">
      <ToolbarButton icon="minus" label="Zoom out" onClick={onZoomOut} />
      <output className="min-w-14 text-center font-mono text-xs text-ink-muted">
        {Math.round(zoom * 100)}%
      </output>
      <ToolbarButton icon="plus" label="Zoom in" onClick={onZoomIn} />
      <span className="mx-1 h-5 w-px bg-line" />
      <ToolbarButton icon="fit" label="Fit to view" onClick={onFitView} />
    </div>
  );
}
