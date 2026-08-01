import type { Abi } from "viem";
import addressesJson from "./addresses.arc-testnet.json" with { type: "json" };
import demoTokenAbi from "./abi/DemoToken.json" with { type: "json" };
import executorAbi from "./abi/Executor.json" with { type: "json" };
import strategyVaultAbi from "./abi/StrategyVault.json" with { type: "json" };
import vaultFactoryAbi from "./abi/VaultFactory.json" with { type: "json" };
import workflowRegistryAbi from "./abi/WorkflowRegistry.json" with { type: "json" };

export const ARC_TESTNET_DEPLOYMENT = addressesJson as {
  core: {
    admin: string;
    automationTrigger: string;
    commit: string;
    executor: string;
    factory: string;
    guardModule: string;
    registry: string;
    verified: boolean;
  };
  adapters: Record<string, string>;
  tokens: Record<string, string>;
};

export const ARC_CHAIN_ID = 5042002;
export const ARC_RPC_URL = "https://rpc.testnet.arc.io";

export const EXECUTOR_ABI = executorAbi as Abi;
export const WORKFLOW_REGISTRY_ABI = workflowRegistryAbi as Abi;
export const STRATEGY_VAULT_ABI = strategyVaultAbi as Abi;
export const VAULT_FACTORY_ABI = vaultFactoryAbi as Abi;
export const DEMO_TOKEN_ABI = demoTokenAbi as Abi;
