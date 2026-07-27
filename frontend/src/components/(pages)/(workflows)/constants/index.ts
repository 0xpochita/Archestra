import type { ComponentType } from "react";
import { LuPencilRuler, LuWorkflow } from "react-icons/lu";

export const SIDEBAR_LABEL = "Menu";

export const BREADCRUMB_TRAIL = ["Workflows"];

export const PAGE_TITLE = "Workflow templates";
export const PAGE_SUBTITLE =
  "Pick a ready-made DeFi strategy, then tune the blocks in the studio.";
export const SEARCH_PLACEHOLDER = "Search templates...";
export const EMPTY_RESULT = "No template matches that search.";

export const BLANK_TEMPLATE_TITLE = "Start from scratch";
export const BLANK_TEMPLATE_BODY =
  "Open an empty canvas and wire the blocks yourself.";

export const RAIL_LINKS: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { href: "/workflows", label: "Templates", icon: LuWorkflow },
  { href: "/studio", label: "Studio", icon: LuPencilRuler },
];
