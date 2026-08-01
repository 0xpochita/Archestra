import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  type PersistedStrategyState,
  type RunRecord,
  type SavedGraph,
  type SavedStrategy,
  strategyStateSchema,
} from "@/lib/schemas/strategy";

const STORAGE_KEY = "archestra.studio.strategies";
const STORAGE_VERSION = 1;
const MAX_RUNS = 50;

interface StrategyActions {
  createStrategy: (name: string) => string;
  openStrategy: (id: string) => void;
  saveActiveStrategy: (patch: {
    name: string;
    tokens: string[];
    graph: SavedGraph;
  }) => void;
  setOnchainId: (id: string, onchainId: string) => void;
  removeStrategy: (id: string) => void;
  recordRun: (run: RunRecord) => void;
}

export type StrategyStore = PersistedStrategyState & StrategyActions;

const EMPTY_STATE: PersistedStrategyState = {
  strategies: [],
  runs: [],
  activeStrategyId: null,
};

const nextId = () =>
  `strategy-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

const replaceStrategy = (
  strategies: SavedStrategy[],
  id: string,
  patch: (strategy: SavedStrategy) => SavedStrategy,
) =>
  strategies.map((strategy) =>
    strategy.id === id ? patch(strategy) : strategy,
  );

export const useStrategyStore = create<StrategyStore>()(
  persist(
    (set, get) => ({
      ...EMPTY_STATE,

      createStrategy: (name) => {
        const now = Date.now();
        const strategy: SavedStrategy = {
          id: nextId(),
          name,
          tokens: [],
          graph: { nodes: [], edges: [] },
          onchainId: null,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          strategies: [strategy, ...state.strategies],
          activeStrategyId: strategy.id,
        }));

        return strategy.id;
      },

      openStrategy: (id) => set({ activeStrategyId: id }),

      saveActiveStrategy: ({ name, tokens, graph }) => {
        const { activeStrategyId, strategies } = get();
        if (!activeStrategyId) return;

        set({
          strategies: replaceStrategy(strategies, activeStrategyId, (item) => ({
            ...item,
            name,
            tokens,
            graph,
            updatedAt: Date.now(),
          })),
        });
      },

      setOnchainId: (id, onchainId) =>
        set((state) => ({
          strategies: replaceStrategy(state.strategies, id, (item) => ({
            ...item,
            onchainId,
            updatedAt: Date.now(),
          })),
        })),

      removeStrategy: (id) =>
        set((state) => ({
          strategies: state.strategies.filter((item) => item.id !== id),
          runs: state.runs.filter((run) => run.strategyId !== id),
          activeStrategyId:
            state.activeStrategyId === id ? null : state.activeStrategyId,
        })),

      recordRun: (run) =>
        set((state) => ({
          runs: [
            run,
            ...state.runs.filter((item) => item.runId !== run.runId),
          ].slice(0, MAX_RUNS),
        })),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ strategies, runs, activeStrategyId }) => ({
        strategies,
        runs,
        activeStrategyId,
      }),
      merge: (persisted, current) => {
        const parsed = strategyStateSchema.safeParse(persisted);
        return { ...current, ...(parsed.success ? parsed.data : EMPTY_STATE) };
      },
    },
  ),
);

export const selectActiveStrategy = (state: StrategyStore) =>
  state.strategies.find((item) => item.id === state.activeStrategyId) ?? null;

export const selectRunsFor =
  (strategyId: string | null) => (state: StrategyStore) =>
    state.runs.filter((run) => run.strategyId === strategyId);
