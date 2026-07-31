"use client";

import type { Address } from "viem";
import { useReadContracts, useWriteContract } from "wagmi";
import { strategyVaultAbi } from "@/lib/chain/generated";
import { TOKENS, type Token, type TokenId } from "@/lib/chain/tokens";

export interface TokenSession {
  token: Token;
  maxPerRun: bigint;
  maxPerDay: bigint;
  expiresAt: number;
  spentToday: bigint;
  isActive: boolean;
  remainingToday: bigint;
}

const MISSING_VAULT = "The vault is not deployed yet.";

const readBigInt = (value: unknown) => (typeof value === "bigint" ? value : 0n);

function toSession(
  token: Token,
  raw: unknown,
  spent: unknown,
  nowSeconds: number,
): TokenSession {
  const [maxPerRun, maxPerDay, expiresAt] = Array.isArray(raw)
    ? raw
    : [0n, 0n, 0n];

  const spentToday = readBigInt(spent);
  const perDay = readBigInt(maxPerDay);
  const expiry = Number(readBigInt(expiresAt));

  return {
    token,
    maxPerRun: readBigInt(maxPerRun),
    maxPerDay: perDay,
    expiresAt: expiry,
    spentToday,
    isActive: expiry > nowSeconds && perDay > 0n,
    remainingToday: perDay > spentToday ? perDay - spentToday : 0n,
  };
}

export function useSessions(
  vaultAddress: Address | undefined,
  tokenIds: TokenId[],
  isVaultDeployed: boolean,
) {
  const isEnabled = Boolean(vaultAddress) && isVaultDeployed;

  const reads = useReadContracts({
    contracts: tokenIds.flatMap((id) => [
      {
        abi: strategyVaultAbi,
        address: vaultAddress,
        functionName: "sessionOf",
        args: [TOKENS[id].address],
      },
      {
        abi: strategyVaultAbi,
        address: vaultAddress,
        functionName: "sessionSpentToday",
        args: [TOKENS[id].address],
      },
    ]),
    query: { enabled: isEnabled && tokenIds.length > 0 },
  });

  const nowSeconds = Math.floor(Date.now() / 1000);

  const sessions = tokenIds.map((id, index) =>
    toSession(
      TOKENS[id],
      reads.data?.[index * 2]?.result,
      reads.data?.[index * 2 + 1]?.result,
      nowSeconds,
    ),
  );

  const write = useWriteContract();

  const setSession = (
    tokenId: TokenId,
    maxPerRun: bigint,
    maxPerDay: bigint,
    expiresAt: number,
  ) => {
    if (!vaultAddress) return Promise.reject(new Error(MISSING_VAULT));
    return write.writeContractAsync({
      abi: strategyVaultAbi,
      address: vaultAddress,
      functionName: "setSession",
      args: [TOKENS[tokenId].address, maxPerRun, maxPerDay, BigInt(expiresAt)],
    });
  };

  const revokeSession = (tokenId: TokenId) => {
    if (!vaultAddress) return Promise.reject(new Error(MISSING_VAULT));
    return write.writeContractAsync({
      abi: strategyVaultAbi,
      address: vaultAddress,
      functionName: "revokeSession",
      args: [TOKENS[tokenId].address],
    });
  };

  return {
    sessions,
    isLoading: reads.isLoading,
    error: reads.error,
    isWriting: write.isPending,
    setSession,
    revokeSession,
    refetch: () => {
      void reads.refetch();
    },
  };
}
