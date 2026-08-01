"use client";

import { useState } from "react";
import { AppBar } from "@/components/ui/AppBar";
import { WalletButton } from "@/components/ui/WalletButton";
import { LANDING_PATH } from "@/constants/assets";
import { SavedWorkflowList } from "./components/SavedWorkflowList";
import { TemplateGallery } from "./components/TemplateGallery";
import { WorkflowsSidebar } from "./components/WorkflowsSidebar";
import { BREADCRUMB_TRAIL } from "./constants";

function WorkflowsShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-shell text-ink">
      <AppBar
        trail={BREADCRUMB_TRAIL}
        brandHref={LANDING_PATH}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        actions={<WalletButton />}
      />
      <div className="flex min-h-0 flex-1">
        <WorkflowsSidebar isOpen={isSidebarOpen} />
        {children}
      </div>
    </div>
  );
}

export function WorkflowsPage() {
  return (
    <WorkflowsShell>
      <TemplateGallery />
    </WorkflowsShell>
  );
}

export function MyWorkflowsPage() {
  return (
    <WorkflowsShell>
      <SavedWorkflowList />
    </WorkflowsShell>
  );
}
