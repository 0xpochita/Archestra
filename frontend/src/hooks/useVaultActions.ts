"use client";

import type { Address } from "viem";
import { useWriteContract } from "wagmi";
import { demoTokenAbi, strategyVaultAbi } from "@/lib/chain/generated";
import { TOKENS, type TokenId } from "@/lib/chain/tokens";

const MISSING_VAULT = "The vault is not deployed yet.";

export function useVaultActions(
  vaultAddress: Address | undefined,
  ownerAddress: Address | undefined,
) {
  const write = useWriteContract();

  const mint = (tokenId: TokenId, amount: bigint) => {
    if (!ownerAddress) return Promise.reject(new Error("Connect a wallet."));
    return write.mutateAsync({
      abi: demoTokenAbi,
      address: TOKENS[tokenId].address,
      functionName: "mint",
      args: [ownerAddress, amount],
    });
  };

  const fundVault = (tokenId: TokenId, amount: bigint) => {
    if (!vaultAddress) return Promise.reject(new Error(MISSING_VAULT));
    return write.mutateAsync({
      abi: demoTokenAbi,
      address: TOKENS[tokenId].address,
      functionName: "transfer",
      args: [vaultAddress, amount],
    });
  };

  const acceptExecutor = (executor: Address) => {
    if (!vaultAddress) return Promise.reject(new Error(MISSING_VAULT));
    return write.mutateAsync({
      abi: strategyVaultAbi,
      address: vaultAddress,
      functionName: "acceptExecutor",
      args: [executor],
    });
  };

  const withdraw = (tokenId: TokenId, amount: bigint) => {
    if (!vaultAddress) return Promise.reject(new Error(MISSING_VAULT));
    if (!ownerAddress) return Promise.reject(new Error("Connect a wallet."));
    return write.mutateAsync({
      abi: strategyVaultAbi,
      address: vaultAddress,
      functionName: "withdraw",
      args: [TOKENS[tokenId].address, amount, ownerAddress],
    });
  };

  return {
    mint,
    fundVault,
    withdraw,
    acceptExecutor,
    isWriting: write.isPending,
    error: write.error,
    reset: write.reset,
  };
}
