"use client";

import { ALL_BLOCK_ORDER, BLOCK_CATALOG, DOCK_BLOCK_ORDER } from "../constants";
import type { BlockKind } from "../types";
import { Icon } from "./Icon";

interface BlockDockProps {
  usedKinds: BlockKind[];
  isLocked: boolean;
  isTemplateMenuOpen: boolean;
  onAdd: (kind: BlockKind) => void;
  onToggleTemplateMenu: () => void;
}

interface DockTileProps {
  kind: BlockKind;
  isUsed: boolean;
  isLocked: boolean;
  onAdd: (kind: BlockKind) => void;
}

function DockTile({ kind, isUsed, isLocked, onAdd }: DockTileProps) {
  const definition = BLOCK_CATALOG[kind];

  return (
    <div className="group relative flex flex-col items-center">
      <span className="pointer-events-none absolute -top-9 border border-line bg-surface px-2 py-1 text-xs whitespace-nowrap text-ink opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {definition.label}
      </span>
      <button
        type="button"
        disabled={isLocked}
        onClick={() => onAdd(kind)}
        aria-label={`Add ${definition.label} block`}
        className="grid size-14 place-items-center border border-line/70 bg-surface-raised text-ink transition-transform duration-200 ease-out hover:-translate-y-1 hover:bg-surface-hover disabled:opacity-40"
      >
        <Icon name={definition.icon} className="size-6" />
      </button>
      <span
        className={`mt-1.5 size-1 ${isUsed ? "bg-ink" : "bg-transparent"}`}
      />
    </div>
  );
}

export function BlockDock({
  usedKinds,
  isLocked,
  isTemplateMenuOpen,
  onAdd,
  onToggleTemplateMenu,
}: BlockDockProps) {
  return (
    <div className="relative">
      <div className="flex items-end gap-2 border border-line bg-surface/85 p-3 shadow-xl backdrop-blur-xl">
        {DOCK_BLOCK_ORDER.map((kind) => (
          <DockTile
            key={kind}
            kind={kind}
            isUsed={usedKinds.includes(kind)}
            isLocked={isLocked}
            onAdd={onAdd}
          />
        ))}

        <span className="mx-1 h-14 w-px self-start bg-line" />

        <div className="group relative flex flex-col items-center">
          <span className="pointer-events-none absolute -top-9 border border-line bg-surface px-2 py-1 text-xs whitespace-nowrap text-ink opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            Strategy templates
          </span>
          <button
            type="button"
            aria-expanded={isTemplateMenuOpen}
            aria-label="Strategy templates"
            onClick={onToggleTemplateMenu}
            className={`grid size-14 grid-cols-3 place-content-center gap-1 border border-line/70 bg-surface-raised p-2.5 transition-transform duration-200 ease-out hover:-translate-y-1 hover:bg-surface-hover ${
              isTemplateMenuOpen ? "ring-2 ring-ink/30" : ""
            }`}
          >
            {ALL_BLOCK_ORDER.slice(0, 9).map((kind) => (
              <span key={kind} className="size-2 bg-ink-subtle" />
            ))}
          </button>
          <span className="mt-1.5 size-1 bg-transparent" />
        </div>
      </div>
    </div>
  );
}
