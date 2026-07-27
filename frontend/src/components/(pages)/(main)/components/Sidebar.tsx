"use client";

import Link from "next/link";
import { LuWorkflow } from "react-icons/lu";
import { Icon } from "@/components/ui/Icon";
import { WORKFLOWS_PATH } from "@/constants/assets";
import type { IconName } from "@/types/icon";

interface SidebarProps {
  isBlockLibraryOpen: boolean;
  isInspectorOpen: boolean;
  isLocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToggleBlockLibrary: () => void;
  onToggleInspector: () => void;
  onToggleLock: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

interface RailButtonProps {
  icon: IconName;
  label: string;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick: () => void;
}

function RailButton({
  icon,
  label,
  isActive = false,
  isDisabled = false,
  onClick,
}: RailButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={isActive}
      disabled={isDisabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className={`grid size-10 place-items-center border transition-colors disabled:opacity-30 ${
        isActive
          ? "border-ink bg-ink text-on-brand"
          : "border-transparent text-ink-muted hover:border-line hover:bg-surface-raised hover:text-ink"
      }`}
    >
      <Icon name={icon} className="size-5" />
    </button>
  );
}

export function Sidebar({
  isBlockLibraryOpen,
  isInspectorOpen,
  isLocked,
  canUndo,
  canRedo,
  onToggleBlockLibrary,
  onToggleInspector,
  onToggleLock,
  onUndo,
  onRedo,
}: SidebarProps) {
  return (
    <nav
      aria-label="Studio tools"
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-shell py-3"
    >
      <Link
        href={WORKFLOWS_PATH}
        aria-label="Workflow templates"
        title="Workflow templates"
        className="grid size-10 place-items-center border border-transparent text-ink-muted transition-colors hover:border-line hover:bg-surface-raised hover:text-ink"
      >
        <LuWorkflow className="size-5" />
      </Link>

      <span className="my-1 h-px w-6 bg-line" />

      <RailButton
        icon="addBlocks"
        label="Block library"
        isActive={isBlockLibraryOpen}
        onClick={onToggleBlockLibrary}
      />
      <RailButton
        icon="panel"
        label="Inspector"
        isActive={isInspectorOpen}
        onClick={onToggleInspector}
      />
      <RailButton
        icon="undo"
        label="Undo"
        isDisabled={!canUndo}
        onClick={onUndo}
      />
      <RailButton
        icon="redo"
        label="Redo"
        isDisabled={!canRedo}
        onClick={onRedo}
      />

      <span className="mt-auto">
        <RailButton
          icon={isLocked ? "lock" : "unlock"}
          label={isLocked ? "Unlock canvas" : "Lock canvas"}
          isActive={isLocked}
          onClick={onToggleLock}
        />
      </span>
    </nav>
  );
}
