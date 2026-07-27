import type { LogoName } from "@/types/logo";

export interface FlowCard {
  id: string;
  title: string;
  subtitle: string;
  logo: LogoName;
  x: number;
  y: number;
  width: number;
}

export interface FlowConnector {
  id: string;
  path: string;
  label?: string;
  labelX?: number;
  labelY?: number;
}

export interface HeroWord {
  label: string;
  logo: LogoName;
}

export interface FooterGroup {
  title: string;
  links: string[];
}

export interface NavLink {
  label: string;
  hasMenu: boolean;
}
