"use client";

export default function WorkflowStudioError({ reset }: { reset: () => void }) {
  return (
    <main className="grid h-svh place-items-center bg-shell px-6 text-center">
      <div className="max-w-sm space-y-3">
        <h1 className="text-lg font-semibold text-ink">
          The workflow studio failed to load
        </h1>
        <p className="text-sm text-ink-muted">
          Nothing was sent on-chain. Reload the canvas to pick up where you left
          off.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-on-brand"
        >
          Reload canvas
        </button>
      </div>
    </main>
  );
}
