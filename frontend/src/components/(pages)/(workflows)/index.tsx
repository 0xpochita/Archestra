"use client";

import { useState } from "react";
import { AppBar } from "@/components/ui/AppBar";
import { TemplateGallery } from "./components/TemplateGallery";
import { WorkflowsSidebar } from "./components/WorkflowsSidebar";
import { BREADCRUMB_TRAIL } from "./constants";

export function WorkflowsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-shell text-ink">
      <AppBar
        trail={BREADCRUMB_TRAIL}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
      />
      <div className="flex min-h-0 flex-1">
        <WorkflowsSidebar isOpen={isSidebarOpen} />
        <TemplateGallery />
      </div>
    </div>
  );
}
