"use client";

import Link from "next/link";
import { LuPencilRuler, LuWorkflow } from "react-icons/lu";
import { Icon } from "@/components/ui/Icon";
import {
  SIDEBAR_ACTIVE_CLASS,
  SIDEBAR_IDLE_CLASS,
  SIDEBAR_ROW_CLASS,
  SidebarSection,
  SidebarShell,
  SidebarText,
} from "@/components/ui/SidebarShell";
import { WORKFLOWS_PATH } from "@/constants/assets";
import type { IconName } from "@/types/icon";

interface SidebarProps {
  isOpen: boolean;
  isBlockLibraryOpen: boolean;
  isLocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToggleBlockLibrary: () => void;
  onToggleLock: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

interface SidebarButtonProps {
  icon: IconName;
  label: string;
  isOpen: boolean;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick: () => void;
}

function SidebarButton({
  icon,
  label,
  isOpen,
  isActive = false,
  isDisabled = false,
  onClick,
}: SidebarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-pressed={isActive}
      disabled={isDisabled}
      onClick={onClick}
      className={`${SIDEBAR_ROW_CLASS} disabled:cursor-not-allowed disabled:opacity-35 ${
        isActive ? SIDEBAR_ACTIVE_CLASS : SIDEBAR_IDLE_CLASS
      }`}
    >
      <Icon name={icon} className="size-5 shrink-0" />
      <SidebarText isOpen={isOpen}>{label}</SidebarText>
    </button>
  );
}

export function Sidebar({
  isOpen,
  isBlockLibraryOpen,
  isLocked,
  canUndo,
  canRedo,
  onToggleBlockLibrary,
  onToggleLock,
  onUndo,
  onRedo,
}: SidebarProps) {
  return (
    <SidebarShell label="Menu" isOpen={isOpen}>
      <SidebarSection isOpen={isOpen}>Menu</SidebarSection>

      <Link
        href={WORKFLOWS_PATH}
        title="Templates"
        className={`${SIDEBAR_ROW_CLASS} ${SIDEBAR_IDLE_CLASS}`}
      >
        <LuWorkflow className="size-5 shrink-0" />
        <SidebarText isOpen={isOpen}>Templates</SidebarText>
      </Link>

      <span
        aria-current="page"
        title="Studio"
        className={`${SIDEBAR_ROW_CLASS} ${SIDEBAR_ACTIVE_CLASS}`}
      >
        <LuPencilRuler className="size-5 shrink-0" />
        <SidebarText isOpen={isOpen}>Studio</SidebarText>
      </span>

      <SidebarSection isOpen={isOpen}>Tools</SidebarSection>

      <SidebarButton
        icon="addBlocks"
        label="Add a block"
        isOpen={isOpen}
        isActive={isBlockLibraryOpen}
        onClick={onToggleBlockLibrary}
      />
      <SidebarButton
        icon="undo"
        label="Undo"
        isOpen={isOpen}
        isDisabled={!canUndo}
        onClick={onUndo}
      />
      <SidebarButton
        icon="redo"
        label="Redo"
        isOpen={isOpen}
        isDisabled={!canRedo}
        onClick={onRedo}
      />

      <div className="mt-auto">
        <SidebarButton
          icon={isLocked ? "lock" : "unlock"}
          label={isLocked ? "Unlock canvas" : "Lock canvas"}
          isOpen={isOpen}
          isActive={isLocked}
          onClick={onToggleLock}
        />
      </div>
    </SidebarShell>
  );
}
