"use client";

import { useEffect, useState } from "react";
import { useStrategyStore } from "@/stores/strategy-store";

export function useStoredStrategies() {
  const [isHydrated, setIsHydrated] = useState(false);
  const strategies = useStrategyStore((state) => state.strategies);
  const runs = useStrategyStore((state) => state.runs);
  const activeStrategyId = useStrategyStore((state) => state.activeStrategyId);

  useEffect(() => {
    let isMounted = true;

    void useStrategyStore.persist.rehydrate()?.then(() => {
      if (isMounted) setIsHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    isHydrated,
    strategies: isHydrated ? strategies : [],
    runs: isHydrated ? runs : [],
    activeStrategyId: isHydrated ? activeStrategyId : null,
    removeStrategy: useStrategyStore.getState().removeStrategy,
  };
}
