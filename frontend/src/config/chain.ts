import { getAddress } from "viem";
import { arcTestnet } from "viem/chains";
import { z } from "zod";
import { ARC_TESTNET_DEPLOYMENT } from "@/lib/chain/generated";
import { PUBLIC_ARC_RPC_URLS } from "./rpc-endpoints";

const chainEnvSchema = z.object({
  NEXT_PUBLIC_ARC_RPC_URL: z.url().optional(),
  NEXT_PUBLIC_REGISTRY_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 20 byte hex address")
    .optional(),
});

const parsedEnv = chainEnvSchema.safeParse({
  NEXT_PUBLIC_ARC_RPC_URL: process.env.NEXT_PUBLIC_ARC_RPC_URL,
  NEXT_PUBLIC_REGISTRY_ADDRESS: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS,
});

if (!parsedEnv.success) {
  const problems = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(", ");
  throw new Error(`Invalid chain environment (${problems})`);
}

export const arcChain = arcTestnet;
export const ARC_CHAIN_ID = arcTestnet.id;
export const ARC_CHAIN_NAME = arcTestnet.name;

export const ARC_RPC_URLS = parsedEnv.data.NEXT_PUBLIC_ARC_RPC_URL
  ? [parsedEnv.data.NEXT_PUBLIC_ARC_RPC_URL, ...PUBLIC_ARC_RPC_URLS]
  : PUBLIC_ARC_RPC_URLS;

export const REGISTRY_ADDRESS = getAddress(
  parsedEnv.data.NEXT_PUBLIC_REGISTRY_ADDRESS ??
    ARC_TESTNET_DEPLOYMENT.core.registry,
);

export const VAULT_FACTORY_ADDRESS = getAddress(
  ARC_TESTNET_DEPLOYMENT.core.factory,
);

const explorerBaseUrl = arcTestnet.blockExplorers.default.url;

export const explorerAddressUrl = (address: string) =>
  `${explorerBaseUrl}/address/${address}`;

export const explorerTxUrl = (transactionHash: string) =>
  `${explorerBaseUrl}/tx/${transactionHash}`;

export const explorerTokenUrl = (address: string) =>
  `${explorerBaseUrl}/token/${address}`;
