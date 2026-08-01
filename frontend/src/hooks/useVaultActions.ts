"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Address } from "viem";
import { useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { demoTokenAbi, strategyVaultAbi } from "@/lib/chain/generated";
import { TOKENS, type TokenId } from "@/lib/chain/tokens";

const MISSING_VAULT = "The vault is not deployed yet.";

export function useVaultActions(
  vaultAddress: Address | undefined,
  ownerAddress: Address | undefined,
) {
  const write = useWriteContract();
  const config = useConfig();
  const queryClient = useQueryClient();
  const [isSettling, setIsSettling] = useState(false);

  const settle = async (hash: `0x${string}`) => {
    setIsSettling(true);
    try {
      await waitForTransactionReceipt(config, { hash });
      await queryClient.invalidateQueries();
    } finally {
      setIsSettling(false);
    }
    return hash;
  };

  const mint = (tokenId: TokenId, amount: bigint) => {
    if (!ownerAddress) return Promise.reject(new Error("Connect a wallet."));
    return write
      .writeContractAsync({
        abi: demoTokenAbi,
        address: TOKENS[tokenId].address,
        functionName: "mint",
        args: [ownerAddress, amount],
      })
      .then(settle);
  };

  const fundVault = (tokenId: TokenId, amount: bigint) => {
    if (!vaultAddress) return Promise.reject(new Error(MISSING_VAULT));
    return write
      .writeContractAsync({
        abi: demoTokenAbi,
        address: TOKENS[tokenId].address,
        functionName: "transfer",
        args: [vaultAddress, amount],
      })
      .then(settle);
  };

  const acceptExecutor = (executor: Address) => {
    if (!vaultAddress) return Promise.reject(new Error(MISSING_VAULT));
    return write
      .writeContractAsync({
        abi: strategyVaultAbi,
        address: vaultAddress,
        functionName: "acceptExecutor",
        args: [executor],
      })
      .then(settle);
  };

  const withdraw = (tokenId: TokenId, amount: bigint) => {
    if (!vaultAddress) return Promise.reject(new Error(MISSING_VAULT));
    if (!ownerAddress) return Promise.reject(new Error("Connect a wallet."));
    return write
      .writeContractAsync({
        abi: strategyVaultAbi,
        address: vaultAddress,
        functionName: "withdraw",
        args: [TOKENS[tokenId].address, amount, ownerAddress],
      })
      .then(settle);
  };

  return {
    mint,
    fundVault,
    withdraw,
    acceptExecutor,
    isWriting: write.isPending || isSettling,
    error: write.error,
    reset: write.reset,
  };
}
