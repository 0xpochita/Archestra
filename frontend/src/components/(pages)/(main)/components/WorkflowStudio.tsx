"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useCallback, useState } from "react";
import { AppBar } from "@/components/ui/AppBar";
import { Icon } from "@/components/ui/Icon";
import { popoverVariants } from "@/components/ui/motion";
import { WalletButton } from "@/components/ui/WalletButton";
import { WORKFLOWS_PATH } from "@/constants/assets";
import type { RunOutcome } from "@/lib/chain/decode-run";
import { getStrategyTokens } from "@/lib/step-config";
import { BREADCRUMB_TRAIL } from "../constants";
import { useWorkflowStudio } from "../hooks/useWorkflowStudio";
import { AiWorkflowModal } from "./AiWorkflowModal";
import { BlockDock } from "./BlockDock";
import { BlockLibraryModal } from "./BlockLibraryModal";
import { CanvasToolbar } from "./CanvasToolbar";
import { ExecutorBanner } from "./ExecutorBanner";
import { InspectorPanel } from "./InspectorPanel";
import { OnChainStatus } from "./OnChainStatus";
import { PreflightNotice } from "./PreflightNotice";
import { RunReceiptPanel } from "./RunReceiptPanel";
import { Sidebar } from "./Sidebar";
import { SimulationModal } from "./SimulationModal";
import { StrategyTemplateModal } from "./StrategyTemplateModal";
import { VaultPanel } from "./VaultPanel";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { WorkflowTitle } from "./WorkflowTitle";

export function WorkflowStudio() {
  const studio = useWorkflowStudio();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isActivateOpen, setIsActivateOpen] = useState(false);
  const [receipt, setReceipt] = useState<RunOutcome | null>(null);
  const strategyTokens = getStrategyTokens(
    studio.preflight.orderedNodes.map((node) => node.config),
  );

  const playRun = studio.playRun;
  const handleRunOutcome = useCallback(
    (outcome: RunOutcome, nodeIds: string[]) => {
      setReceipt(outcome);
      playRun(nodeIds);
    },
    [playRun],
  );

  return (
    <MotionConfig reducedMotion="user">
      <AppBar
        trail={BREADCRUMB_TRAIL}
        brandHref={WORKFLOWS_PATH}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        actions={<WalletButton />}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          isOpen={isSidebarOpen}
          isBlockLibraryOpen={studio.isBlockLibraryOpen}
          isLocked={studio.isLocked}
          canUndo={studio.canUndo}
          canRedo={studio.canRedo}
          onToggleBlockLibrary={studio.toggleBlockLibrary}
          onToggleLock={studio.toggleLock}
          onUndo={studio.undo}
          onRedo={studio.redo}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-shell px-4">
            <WorkflowTitle
              name={studio.workflowName}
              tokens={studio.workflowTokens}
              onNameChange={studio.setWorkflowName}
              onSelectStrategy={studio.loadStrategy}
            />

            <div className="ml-auto flex items-center gap-4">
              <OnChainStatus
                orderedNodes={studio.preflight.orderedNodes}
                canEncode={studio.preflight.canEncode}
                tokenIds={strategyTokens}
                onRequestActivate={() => setIsActivateOpen(true)}
                onRunOutcome={handleRunOutcome}
                onMockRun={studio.runWorkflow}
                isMockRunning={studio.isRunning}
              />
              <button
                type="button"
                onClick={studio.openSimulation}
                className="flex items-center gap-2 border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
              >
                <Icon name="sparkle" className="size-4" />
                Simulate strategy
              </button>
            </div>
          </div>

          <ExecutorBanner />

          <AnimatePresence>
            {receipt ? (
              <RunReceiptPanel
                key="run-receipt"
                outcome={receipt}
                onClose={() => setReceipt(null)}
              />
            ) : null}
          </AnimatePresence>

          <PreflightNotice
            problems={studio.preflight.problems}
            warnings={studio.preflight.warnings}
            onSelectNode={studio.selectNode}
          />

          <div className="flex min-h-0 flex-1">
            <section className="relative min-w-0 flex-1">
              <WorkflowCanvas
                canvasRef={studio.canvasRef}
                graph={studio.graph}
                viewport={studio.viewport}
                selectedNodeId={studio.selectedNodeId}
                runState={studio.runState}
                problemNodeIds={studio.preflight.problems.flatMap((problem) =>
                  problem.nodeId ? [problem.nodeId] : [],
                )}
                isLocked={studio.isLocked}
                onPan={studio.panBy}
                onZoom={studio.zoomBy}
                onSelect={studio.selectNode}
                onMoveStart={studio.beginHistoryEntry}
                onMoveNode={studio.moveNode}
                onAddNext={studio.startBlockAfter}
              />

              <div className="absolute bottom-6 left-6">
                <CanvasToolbar
                  zoom={studio.viewport.zoom}
                  onZoomIn={() => studio.zoomBy(studio.zoomStep)}
                  onZoomOut={() => studio.zoomBy(-studio.zoomStep)}
                  onZoomTo={studio.zoomTo}
                  onFitView={studio.fitView}
                  onCenterView={studio.centerView}
                />
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-6">
                <div className="pointer-events-auto">
                  <BlockDock
                    usedKinds={studio.graph.nodes.map((node) => node.kind)}
                    isLocked={studio.isLocked}
                    isTemplateMenuOpen={studio.isTemplateMenuOpen}
                    onAdd={studio.addBlock}
                    onToggleTemplateMenu={studio.toggleTemplateMenu}
                  />
                </div>
              </div>

              <AnimatePresence>
                {studio.isAssistantOpen ? null : (
                  <motion.button
                    key="assistant-launcher"
                    type="button"
                    onClick={studio.openAssistant}
                    variants={popoverVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute right-6 bottom-6 flex items-center gap-2.5 border border-ink bg-brand px-4 py-3 text-sm font-medium text-on-brand shadow-xl transition-opacity hover:opacity-90"
                  >
                    <Icon name="sparkle" className="size-5" />
                    Ask AI
                  </motion.button>
                )}
              </AnimatePresence>
            </section>

            {studio.selectedNode ? (
              <InspectorPanel
                node={studio.selectedNode}
                onClose={() => studio.selectNode(null)}
                onUpdateText={studio.updateNodeText}
                onUpdateConfig={studio.updateConfig}
                onRemoveNode={studio.removeNode}
              />
            ) : (
              <VaultPanel
                tokenIds={strategyTokens}
                isActivateOpen={isActivateOpen}
                onActivateOpenChange={setIsActivateOpen}
              />
            )}
          </div>
        </div>

        <AnimatePresence>
          {studio.isAssistantOpen ? (
            <AiWorkflowModal
              key="assistant"
              messages={studio.messages}
              isThinking={studio.isThinking}
              draft={studio.draft}
              onSubmit={studio.sendPrompt}
              onAccept={studio.acceptDraft}
              onClear={studio.clearAssistant}
              onClose={studio.closeAssistant}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {studio.isTemplateMenuOpen ? (
            <StrategyTemplateModal
              key="strategy-templates"
              isLocked={studio.isLocked}
              onApply={studio.applyTemplate}
              onClose={studio.dismissMenus}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {studio.isBlockLibraryOpen ? (
            <BlockLibraryModal
              key="block-library"
              isLocked={studio.isLocked}
              anchorTitle={studio.selectedNode?.title}
              onAdd={studio.addBlock}
              onClose={studio.dismissMenus}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {studio.isSimulationOpen ? (
            <SimulationModal
              key="simulation"
              workflowName={studio.workflowName}
              steps={studio.simulationSteps}
              completed={studio.simulationCompleted}
              onReplay={studio.replaySimulation}
              onClose={studio.closeSimulation}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
