"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { BlockGroup, BlockKind } from "../types";
import { getBlockGroups } from "../utils";

interface BlockLibraryProps {
  isLocked: boolean;
  onAdd: (kind: BlockKind) => void;
}

interface BlockGroupSectionProps {
  group: BlockGroup;
  isCollapsed: boolean;
  isLocked: boolean;
  onToggle: (name: string) => void;
  onAdd: (kind: BlockKind) => void;
}

function BlockGroupSection({
  group,
  isCollapsed,
  isLocked,
  onToggle,
  onAdd,
}: BlockGroupSectionProps) {
  return (
    <section className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-expanded={!isCollapsed}
        onClick={() => onToggle(group.name)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Icon name={group.blocks[0].icon} className="size-4 text-ink-muted" />
        <span className="text-sm font-semibold text-ink">{group.name}</span>
        <Icon
          name="chevronDown"
          className={`ml-auto size-4 text-ink-subtle transition-transform ${
            isCollapsed ? "-rotate-90" : ""
          }`}
        />
      </button>

      {isCollapsed ? null : (
        <div className="grid grid-cols-2 gap-1 px-3 pb-3">
          {group.blocks.map((definition) => (
            <button
              key={definition.kind}
              type="button"
              disabled={isLocked}
              onClick={() => onAdd(definition.kind)}
              className="flex items-center gap-3 p-1.5 text-left transition-colors hover:bg-surface-hover disabled:opacity-40"
            >
              <span className="grid size-10 shrink-0 place-items-center border border-line bg-surface-raised text-ink">
                <Icon name={definition.icon} className="size-5" />
              </span>
              <span className="truncate text-sm text-ink">
                {definition.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function BlockLibrary({ isLocked, onAdd }: BlockLibraryProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const searchId = useId();
  const groups = getBlockGroups(query);

  const toggleGroup = (name: string) =>
    setCollapsedGroups((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-4">
        <Icon name="search" className="size-4 text-ink-subtle" />
        <label className="sr-only" htmlFor={searchId}>
          Search blocks
        </label>
        <input
          id={searchId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search DeFi blocks"
          className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
        />
      </div>

      <div className="scroll-slim max-h-[52vh] overflow-y-auto">
        {groups.map((group) => (
          <BlockGroupSection
            key={group.name}
            group={group}
            isCollapsed={collapsedGroups.includes(group.name)}
            isLocked={isLocked}
            onToggle={toggleGroup}
            onAdd={onAdd}
          />
        ))}
        {groups.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-subtle">
            No block matches that search.
          </p>
        ) : null}
      </div>
    </>
  );
}
