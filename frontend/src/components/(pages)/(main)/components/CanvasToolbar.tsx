"use client";

import { useId } from "react";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../constants";
import type { IconName } from "../types";
import { Icon } from "./Icon";

interface CanvasToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomTo: (zoom: number) => void;
  onFitView: () => void;
  onCenterView: () => void;
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
  onZoomTo,
  onFitView,
  onCenterView,
}: CanvasToolbarProps) {
  const sliderId = useId();

  return (
    <div className="border border-line bg-surface/90 shadow-lg backdrop-blur-xl">
      <div className="flex items-center gap-1 p-1.5">
        <ToolbarButton icon="minus" label="Zoom out" onClick={onZoomOut} />
        <output className="min-w-14 text-center font-mono text-xs text-ink-muted">
          {Math.round(zoom * 100)}%
        </output>
        <ToolbarButton icon="plus" label="Zoom in" onClick={onZoomIn} />
        <span className="mx-1 h-5 w-px bg-line" />
        <ToolbarButton icon="fit" label="Fit to view" onClick={onFitView} />
        <ToolbarButton
          icon="target"
          label="Center on workflow"
          onClick={onCenterView}
        />
      </div>

      <div className="border-t border-line px-3 py-2">
        <label className="sr-only" htmlFor={sliderId}>
          Zoom level
        </label>
        <input
          id={sliderId}
          type="range"
          min={Math.round(ZOOM_MIN * 100)}
          max={Math.round(ZOOM_MAX * 100)}
          step={Math.round(ZOOM_STEP * 100)}
          value={Math.round(zoom * 100)}
          onChange={(event) => onZoomTo(Number(event.target.value) / 100)}
          className="h-1 w-full cursor-pointer accent-ink"
        />
      </div>
    </div>
  );
}
