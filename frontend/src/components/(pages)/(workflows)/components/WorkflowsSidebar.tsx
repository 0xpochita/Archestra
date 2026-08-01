"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SIDEBAR_ACTIVE_CLASS,
  SIDEBAR_IDLE_CLASS,
  SIDEBAR_ROW_CLASS,
  SidebarSection,
  SidebarShell,
  SidebarText,
} from "@/components/ui/SidebarShell";
import { RAIL_LINKS, SIDEBAR_LABEL } from "../constants";

interface WorkflowsSidebarProps {
  isOpen: boolean;
}

export function WorkflowsSidebar({ isOpen }: WorkflowsSidebarProps) {
  const pathname = usePathname();

  return (
    <SidebarShell label={SIDEBAR_LABEL} isOpen={isOpen}>
      <SidebarSection isOpen={isOpen}>{SIDEBAR_LABEL}</SidebarSection>

      {RAIL_LINKS.map((link) => {
        const SidebarIcon = link.icon;
        const isActive = link.href === pathname;

        return (
          <Link
            key={link.href}
            href={link.href}
            title={link.label}
            aria-current={isActive ? "page" : undefined}
            className={`${SIDEBAR_ROW_CLASS} ${
              isActive ? SIDEBAR_ACTIVE_CLASS : SIDEBAR_IDLE_CLASS
            }`}
          >
            <SidebarIcon className="size-5 shrink-0" />
            <SidebarText isOpen={isOpen}>{link.label}</SidebarText>
          </Link>
        );
      })}
    </SidebarShell>
  );
}
