export type LogoName =
  | "usdc"
  | "aave"
  | "uniswap"
  | "curve"
  | "chainlink"
  | "ethereum"
  | "telegram";

export interface LogoShapeBase {
  id: string;
  fill: string;
  fillRule?: "nonzero" | "evenodd";
  fillOpacity?: number;
}

export interface LogoCircle extends LogoShapeBase {
  kind: "circle";
  cx: number;
  cy: number;
  r: number;
}

export interface LogoPath extends LogoShapeBase {
  kind: "path";
  d: string;
}

export type LogoShape = LogoCircle | LogoPath;

export interface LogoImage {
  src: string;
  alt: string;
}

export interface LogoArtwork {
  viewBox: string;
  shapes: LogoShape[];
}
