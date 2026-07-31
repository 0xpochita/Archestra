import { type Address, getAddress } from "viem";
import { USDC_LOGO_SRC } from "@/constants/assets";
import { ARC_TESTNET_DEPLOYMENT } from "./generated";

export const TOKEN_IDS = [
  "usdc",
  "weth",
  "aUsdc",
  "lpToken",
  "rewardToken",
] as const;

export type TokenId = (typeof TOKEN_IDS)[number];

export interface Token {
  id: TokenId;
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoSrc?: string;
  isMintable: boolean;
}

const TOKEN_METADATA: Record<TokenId, Omit<Token, "id" | "address">> = {
  usdc: {
    symbol: "dUSDC",
    name: "Demo USDC",
    decimals: 6,
    logoSrc: USDC_LOGO_SRC,
    isMintable: true,
  },
  weth: {
    symbol: "dWETH",
    name: "Demo WETH",
    decimals: 18,
    isMintable: true,
  },
  aUsdc: {
    symbol: "aUSDC",
    name: "Aave deposit receipt",
    decimals: 6,
    isMintable: false,
  },
  lpToken: {
    symbol: "crvLP",
    name: "Curve LP position",
    decimals: 18,
    isMintable: false,
  },
  rewardToken: {
    symbol: "RWD",
    name: "Gauge reward",
    decimals: 18,
    isMintable: false,
  },
};

export const TOKENS: Record<TokenId, Token> = {
  usdc: {
    id: "usdc",
    address: getAddress(ARC_TESTNET_DEPLOYMENT.tokens.usdc),
    ...TOKEN_METADATA.usdc,
  },
  weth: {
    id: "weth",
    address: getAddress(ARC_TESTNET_DEPLOYMENT.tokens.weth),
    ...TOKEN_METADATA.weth,
  },
  aUsdc: {
    id: "aUsdc",
    address: getAddress(ARC_TESTNET_DEPLOYMENT.tokens.aUsdc),
    ...TOKEN_METADATA.aUsdc,
  },
  lpToken: {
    id: "lpToken",
    address: getAddress(ARC_TESTNET_DEPLOYMENT.tokens.lpToken),
    ...TOKEN_METADATA.lpToken,
  },
  rewardToken: {
    id: "rewardToken",
    address: getAddress(ARC_TESTNET_DEPLOYMENT.tokens.rewardToken),
    ...TOKEN_METADATA.rewardToken,
  },
};

export const TOKEN_LIST = TOKEN_IDS.map((id) => TOKENS[id]);

export const SPENDABLE_TOKEN_IDS: TokenId[] = ["usdc", "weth"];

export const findTokenByAddress = (address: string) =>
  TOKEN_LIST.find(
    (token) => token.address.toLowerCase() === address.toLowerCase(),
  );
