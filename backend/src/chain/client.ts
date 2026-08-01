import { http, type PublicClient, createPublicClient, defineChain } from "viem";
import { config } from "../lib/config.js";
import { ARC_CHAIN_ID, ARC_RPC_URL } from "./generated/index.js";

export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: [ARC_RPC_URL] },
  },
});

let publicClient: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(config.RPC_URL, { batch: true }),
    });
  }
  return publicClient;
}
