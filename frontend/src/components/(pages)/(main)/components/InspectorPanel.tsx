"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { BLOCK_CATALOG } from "../constants";
import type { BlockParam, WorkflowNode } from "../types";
import { getOutputRows, toConfigLines } from "../utils";

type InspectorTab = "input" | "output";

interface InspectorPanelProps {
  node: WorkflowNode;
  onClose: () => void;
  onUpdateText: (
    id: string,
    patch: { title?: string; subtitle?: string },
  ) => void;
  onUpdateParam: (
    id: string,
    index: number,
    patch: Partial<BlockParam>,
  ) => void;
  onAddParam: (id: string) => void;
  onRemoveParam: (id: string, index: number) => void;
  onRemoveNode: (id: string) => void;
}

const SECTION_LABEL =
  "text-[10px] font-semibold tracking-[0.16em] text-ink-subtle uppercase";
const FIELD_CLASS =
  "h-9 w-full border border-line bg-surface-raised px-2.5 text-sm text-ink outline-none transition-colors focus:border-brand";

function SettingRow({
  label,
  isOn,
  onToggle,
}: {
  label: string;
  isOn: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      onClick={onToggle}
      className="flex w-full items-center justify-between border-b border-line/60 py-3 text-sm text-ink"
    >
      {label}
      <span
        className={`flex h-5 w-9 items-center p-0.5 transition-colors ${
          isOn ? "bg-brand" : "bg-line-strong"
        }`}
      >
        <span
          className={`size-4 bg-shell transition-transform ${
            isOn ? "translate-x-4" : ""
          }`}
        />
      </span>
    </button>
  );
}

export function InspectorPanel({
  node,
  onClose,
  onUpdateText,
  onUpdateParam,
  onAddParam,
  onRemoveParam,
  onRemoveNode,
}: InspectorPanelProps) {
  const [tab, setTab] = useState<InspectorTab>("input");
  const [isLoopOn, setIsLoopOn] = useState(false);
  const [isLockOn, setIsLockOn] = useState(true);
  const [isCacheOn, setIsCacheOn] = useState(false);

  const definition = BLOCK_CATALOG[node.kind];

  return (
    <aside className="scroll-slim flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface">
      <header className="flex items-center gap-2.5 px-4 pt-4">
        <span className="grid size-9 shrink-0 place-items-center border border-line bg-surface-raised text-ink">
          <Icon name={definition.icon} className="size-4" />
        </span>
        <input
          aria-label="Block name"
          value={node.title}
          onChange={(event) =>
            onUpdateText(node.id, { title: event.target.value })
          }
          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-ink outline-none"
        />
        <button
          type="button"
          aria-label="Close inspector"
          onClick={onClose}
          className="grid size-8 place-items-center text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <Icon name="close" className="size-4" />
        </button>
      </header>

      <p className="px-4 pt-2 pb-4 text-xs leading-relaxed text-ink-subtle">
        {definition.description}
      </p>

      <div className="flex gap-1 border-b border-line px-4">
        {(["input", "output"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-2 pb-2.5 text-sm capitalize transition-colors ${
              tab === value
                ? "border-brand text-ink"
                : "border-transparent text-ink-subtle hover:text-ink-muted"
            }`}
          >
            {value === "input" ? `Input (${node.params.length})` : "Output"}
          </button>
        ))}
      </div>

      {tab === "input" ? (
        <div className="space-y-2 px-4 py-4">
          {node.params.map((param, index) => (
            <div key={param.id} className="flex items-center gap-2">
              <input
                aria-label={`Field ${index + 1} name`}
                value={param.label}
                onChange={(event) =>
                  onUpdateParam(node.id, index, { label: event.target.value })
                }
                className={FIELD_CLASS}
              />
              <input
                aria-label={`Field ${index + 1} value`}
                value={param.value}
                onChange={(event) =>
                  onUpdateParam(node.id, index, { value: event.target.value })
                }
                className={`${FIELD_CLASS} font-mono text-xs`}
              />
              <button
                type="button"
                aria-label={`Remove field ${index + 1}`}
                onClick={() => onRemoveParam(node.id, index)}
                className="grid size-8 shrink-0 place-items-center text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <Icon name="trash" className="size-4" />
              </button>
            </div>
          ))}
          {node.params.length === 0 ? (
            <p className="py-2 text-xs text-ink-subtle">
              This block runs without inputs.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => onAddParam(node.id)}
            className="flex items-center gap-1.5 pt-1 text-sm text-brand transition-opacity hover:opacity-80"
          >
            <Icon name="plus" className="size-4" />
            Add Row
          </button>
        </div>
      ) : (
        <dl className="space-y-2 px-4 py-4">
          {getOutputRows(node).map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between border border-line bg-surface-raised px-2.5 py-2"
            >
              <dt className="font-mono text-xs text-ink">{row.name}</dt>
              <dd className="text-xs text-ink-subtle">{row.type}</dd>
            </div>
          ))}
        </dl>
      )}

      <section className="border-t border-line px-4 py-4">
        <p className={SECTION_LABEL}>Connections</p>
        <input
          aria-label="Protocol"
          value={node.subtitle}
          onChange={(event) =>
            onUpdateText(node.id, { subtitle: event.target.value })
          }
          className={`${FIELD_CLASS} mt-2`}
        />
      </section>

      <section className="border-t border-line px-4 py-4">
        <p className={SECTION_LABEL}>Config</p>
        <pre className="scroll-slim mt-2 overflow-x-auto border border-line bg-canvas p-3 font-mono text-[11px] leading-5 text-ink-muted">
          {toConfigLines(node).join("\n")}
        </pre>
      </section>

      <section className="border-t border-line px-4 py-2">
        <p className={`${SECTION_LABEL} py-2`}>Settings</p>
        <SettingRow
          label="Loop"
          isOn={isLoopOn}
          onToggle={() => setIsLoopOn((value) => !value)}
        />
        <SettingRow
          label="Simulate before send"
          isOn={isLockOn}
          onToggle={() => setIsLockOn((value) => !value)}
        />
        <SettingRow
          label="Cache quotes"
          isOn={isCacheOn}
          onToggle={() => setIsCacheOn((value) => !value)}
        />
        {isCacheOn ? (
          <div className="py-3">
            <label
              className="text-xs text-ink-subtle"
              htmlFor={`${node.id}-ttl`}
            >
              TTL
            </label>
            <input
              id={`${node.id}-ttl`}
              defaultValue="30 seconds"
              className={`${FIELD_CLASS} mt-1.5`}
            />
          </div>
        ) : null}
      </section>

      <div className="mt-auto border-t border-line p-4">
        <button
          type="button"
          onClick={() => onRemoveNode(node.id)}
          className="flex w-full items-center justify-center gap-2 border border-line py-2.5 text-sm text-ink transition-colors hover:bg-surface-hover"
        >
          <Icon name="trash" className="size-4" />
          Delete block
        </button>
      </div>
    </aside>
  );
}
