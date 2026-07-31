import type { IconName } from "./icon";
import type { LogoImage, LogoName } from "./logo";

export type BlockKind =
  | "trigger"
  | "approve"
  | "deposit"
  | "swap"
  | "yield"
  | "harvest"
  | "bridge"
  | "withdraw"
  | "condition"
  | "alert";

export interface BlockParam {
  id: string;
  label: string;
  value: string;
}

export interface BlockDefinition {
  kind: BlockKind;
  label: string;
  group: string;
  description: string;
  icon: IconName;
  logo?: LogoName;
  logoImages?: LogoImage[];
  subtitle: string;
}

export interface BlockGroup {
  name: string;
  blocks: BlockDefinition[];
}

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  tokens: LogoName[];
  kinds: BlockKind[];
}
