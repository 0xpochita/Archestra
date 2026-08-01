import { type Address, getAddress } from "viem";
import { getPublicClient } from "../chain/client.js";
import { TOKENS } from "../chain/encode-steps.js";
import {
  ARC_TESTNET_DEPLOYMENT,
  STRATEGY_VAULT_ABI,
  VAULT_FACTORY_ABI,
  WORKFLOW_REGISTRY_ABI,
} from "../chain/generated/index.js";
import { config } from "../lib/config.js";
import type { TokenId } from "../schemas/step-config.js";

export interface OnchainSummary {
  vaultAddress: Address | null;
  acceptedExecutor: Address | null;
  latestExecutor: Address | null;
  requiresApproval: boolean;
  sessions: Array<{
    token: TokenId;
    maxPerRun: string;
    maxPerDay: string;
    expiresAt: number;
    spentToday: string;
  }>;
}

export class OnchainService {
  async getSummary(ownerAddress: string): Promise<OnchainSummary> {
    const owner = getAddress(ownerAddress);
    const client = getPublicClient();
    const factoryAddress = getAddress(ARC_TESTNET_DEPLOYMENT.core.factory);
    const registryAddress = getAddress(config.REGISTRY_ADDRESS);

    const [vaultRaw, latestExecutorRaw] = await Promise.all([
      client.readContract({
        address: factoryAddress,
        abi: VAULT_FACTORY_ABI,
        functionName: "vaultOf",
        args: [owner],
      }),
      client.readContract({
        address: registryAddress,
        abi: WORKFLOW_REGISTRY_ABI,
        functionName: "executor",
      }),
    ]);

    const vaultAddress = (vaultRaw as Address) ?? null;
    const latestExecutor = (latestExecutorRaw as Address) ?? null;
    const hasVault = vaultAddress && vaultAddress !== "0x0000000000000000000000000000000000000000";

    if (!hasVault) {
      return {
        vaultAddress: null,
        acceptedExecutor: null,
        latestExecutor,
        requiresApproval: false,
        sessions: [],
      };
    }

    const acceptedExecutor = (await client.readContract({
      address: vaultAddress,
      abi: STRATEGY_VAULT_ABI,
      functionName: "acceptedExecutor",
    })) as Address;

    const requiresApproval =
      latestExecutor !== null &&
      latestExecutor !== "0x0000000000000000000000000000000000000000" &&
      latestExecutor.toLowerCase() !== acceptedExecutor.toLowerCase();

    const tokenIds: TokenId[] = ["usdc", "weth"];
    const sessions = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const tokenAddress = TOKENS[tokenId].address;
        const [session, spent] = await Promise.all([
          client.readContract({
            address: vaultAddress,
            abi: STRATEGY_VAULT_ABI,
            functionName: "sessionOf",
            args: [tokenAddress],
          }) as Promise<readonly [bigint, bigint, bigint]>,
          client.readContract({
            address: vaultAddress,
            abi: STRATEGY_VAULT_ABI,
            functionName: "sessionSpentToday",
            args: [tokenAddress],
          }) as Promise<bigint>,
        ]);
        return {
          token: tokenId,
          maxPerRun: String(session[0]),
          maxPerDay: String(session[1]),
          expiresAt: Number(session[2]),
          spentToday: String(spent),
        };
      }),
    );

    return {
      vaultAddress,
      acceptedExecutor,
      latestExecutor,
      requiresApproval,
      sessions,
    };
  }
}
