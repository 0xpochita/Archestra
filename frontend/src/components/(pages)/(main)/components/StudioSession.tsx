"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LOGO_ARTWORK } from "@/components/ui/logo-artwork";
import { STRATEGY_TEMPLATES } from "@/constants/blocks";
import { useStrategyStore } from "@/stores/strategy-store";
import type { StrategyTemplate } from "@/types/block";
import type { LogoName } from "@/types/logo";
import { BLANK_WORKFLOW_NAME } from "../constants";
import type { WorkflowGraph } from "../types";

interface StudioSessionProps {
  graph: WorkflowGraph;
  workflowName: string;
  workflowTokens: LogoName[];
  onApplyTemplate: (template: StrategyTemplate) => void;
  onStartBlank: () => void;
  onRestore: (graph: WorkflowGraph, name: string, tokens: LogoName[]) => void;
}

const isLogoName = (value: string): value is LogoName => value in LOGO_ARTWORK;

export function StudioSession({
  graph,
  workflowName,
  workflowTokens,
  onApplyTemplate,
  onStartBlank,
  onRestore,
}: StudioSessionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isReady, setIsReady] = useState(false);
  const hasStartedRef = useRef(false);

  const callbacksRef = useRef({ onApplyTemplate, onStartBlank, onRestore });
  callbacksRef.current = { onApplyTemplate, onStartBlank, onRestore };

  const requestedStrategyId = searchParams.get("strategy");
  const requestedTemplateId = searchParams.get("template");
  const isBlankRequested = searchParams.get("new") !== null;
  const hasWorkflowParam = searchParams.get("workflow") !== null;

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const store = useStrategyStore;
    const start = async () => {
      await store.persist.rehydrate();
      const state = store.getState();

      if (isBlankRequested) {
        state.createStrategy(BLANK_WORKFLOW_NAME);
        callbacksRef.current.onStartBlank();
        setIsReady(true);
        return;
      }

      const requested = requestedStrategyId
        ? state.strategies.find((item) => item.id === requestedStrategyId)
        : undefined;

      if (requested) {
        state.openStrategy(requested.id);
        callbacksRef.current.onRestore(
          requested.graph,
          requested.name,
          requested.tokens.filter(isLogoName),
        );
        setIsReady(true);
        return;
      }

      const template = requestedTemplateId
        ? STRATEGY_TEMPLATES.find((item) => item.id === requestedTemplateId)
        : undefined;

      if (template) {
        state.createStrategy(template.name);
        callbacksRef.current.onApplyTemplate(template);
        setIsReady(true);
        return;
      }

      const active = state.strategies.find(
        (item) => item.id === state.activeStrategyId,
      );

      if (active && active.graph.nodes.length > 0) {
        callbacksRef.current.onRestore(
          active.graph,
          active.name,
          active.tokens.filter(isLogoName),
        );

        if (!hasWorkflowParam && active.onchainId) {
          const next = new URLSearchParams(searchParams.toString());
          next.set("workflow", active.onchainId);
          router.replace(`${pathname}?${next.toString()}`, { scroll: false });
        }
      }

      if (!active) state.createStrategy(BLANK_WORKFLOW_NAME);
      setIsReady(true);
    };

    void start();
  }, [
    isBlankRequested,
    requestedStrategyId,
    requestedTemplateId,
    hasWorkflowParam,
    router,
    pathname,
    searchParams,
  ]);

  useEffect(() => {
    if (!isReady) return;

    useStrategyStore.getState().saveActiveStrategy({
      name: workflowName,
      tokens: workflowTokens,
      graph,
    });
  }, [isReady, graph, workflowName, workflowTokens]);

  return null;
}
