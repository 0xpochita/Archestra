"use client";

import { type Address, zeroAddress } from "viem";
import { useConnection, useReadContract, useReadContracts } from "wagmi";
import {
  ARC_CHAIN_ID,
  REGISTRY_ADDRESS,
  VAULT_FACTORY_ADDRESS,
} from "@/config/chain";
import {
  demoTokenAbi,
  strategyVaultAbi,
  vaultFactoryAbi,
  workflowRegistryAbi,
} from "@/lib/chain/generated";
import { TOKEN_LIST, type Token } from "@/lib/chain/tokens";

export interface TokenBalance {
  token: Token;
  ownerAmount: bigint;
  vaultAmount: bigint;
}

function useVaultAddress(owner: Address | undefined, isEnabled: boolean) {
  const deployed = useReadContract({
    abi: vaultFactoryAbi,
    address: VAULT_FACTORY_ADDRESS,
    functionName: "vaultOf",
    args: owner ? [owner] : undefined,
    query: { enabled: isEnabled },
  });

  const predicted = useReadContract({
    abi: vaultFactoryAbi,
    address: VAULT_FACTORY_ADDRESS,
    functionName: "predictVault",
    args: owner ? [owner] : undefined,
    query: { enabled: isEnabled },
  });

  const isDeployed = Boolean(deployed.data && deployed.data !== zeroAddress);

  return {
    vaultAddress: isDeployed ? deployed.data : predicted.data,
    isDeployed,
    isLoading: deployed.isLoading || predicted.isLoading,
    error: deployed.error ?? predicted.error,
    refetch: () => {
      void deployed.refetch();
      void predicted.refetch();
    },
  };
}

function useExecutorConsent(vault: Address | undefined, isDeployed: boolean) {
  const published = useReadContract({
    abi: workflowRegistryAbi,
    address: REGISTRY_ADDRESS,
    functionName: "executor",
  });

  const accepted = useReadContract({
    abi: strategyVaultAbi,
    address: vault,
    functionName: "acceptedExecutor",
    query: { enabled: isDeployed && Boolean(vault) },
  });

  const publishedExecutor = published.data;
  const acceptedExecutor = accepted.data;

  return {
    publishedExecutor,
    acceptedExecutor,
    needsApproval:
      Boolean(publishedExecutor) &&
      publishedExecutor !== zeroAddress &&
      Boolean(acceptedExecutor) &&
      acceptedExecutor !== publishedExecutor,
    isLoading: published.isLoading || accepted.isLoading,
    error: published.error ?? accepted.error,
    refetch: () => {
      void published.refetch();
      void accepted.refetch();
    },
  };
}

function useTokenBalances(
  owner: Address | undefined,
  vault: Address | undefined,
  isEnabled: boolean,
) {
  const holders = [owner, vault];

  const balances = useReadContracts({
    contracts: TOKEN_LIST.flatMap((token) =>
      holders.map((holder) => ({
        abi: demoTokenAbi,
        address: token.address,
        functionName: "balanceOf",
        args: holder ? [holder] : undefined,
      })),
    ),
    query: { enabled: isEnabled && Boolean(owner) && Boolean(vault) },
  });

  const rows: TokenBalance[] = TOKEN_LIST.map((token, index) => ({
    token,
    ownerAmount: readAmount(balances.data?.[index * 2]?.result),
    vaultAmount: readAmount(balances.data?.[index * 2 + 1]?.result),
  }));

  return {
    balances: rows,
    isLoading: balances.isLoading,
    error: balances.error,
    refetch: () => {
      void balances.refetch();
    },
  };
}

function readAmount(result: unknown) {
  return typeof result === "bigint" ? result : 0n;
}

export function useVault() {
  const { address, chainId, isConnected, isConnecting } = useConnection();
  const isWrongNetwork = isConnected && chainId !== ARC_CHAIN_ID;
  const isEnabled = isConnected && !isWrongNetwork && Boolean(address);

  const vault = useVaultAddress(address, isEnabled);
  const executor = useExecutorConsent(vault.vaultAddress, vault.isDeployed);
  const balances = useTokenBalances(address, vault.vaultAddress, isEnabled);

  return {
    ownerAddress: address,
    isConnected,
    isConnecting,
    isWrongNetwork,
    vaultAddress: vault.vaultAddress,
    isVaultDeployed: vault.isDeployed,
    acceptedExecutor: executor.acceptedExecutor,
    publishedExecutor: executor.publishedExecutor,
    needsExecutorApproval: executor.needsApproval,
    balances: balances.balances,
    isLoading: vault.isLoading || executor.isLoading || balances.isLoading,
    error: vault.error ?? executor.error ?? balances.error,
    refetch: () => {
      vault.refetch();
      executor.refetch();
      balances.refetch();
    },
  };
}
