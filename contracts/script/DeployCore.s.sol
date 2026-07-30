// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Executor} from "../src/core/Executor.sol";
import {VaultFactory} from "../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../src/core/WorkflowRegistry.sol";
import {AutomationTrigger} from "../src/modules/AutomationTrigger.sol";
import {GuardModule} from "../src/modules/GuardModule.sol";

/// Deploys the core system to Arc testnet, idempotently. The registry address is
/// CREATE predicted from the deployer nonce so the immutable factory can be
/// constructed first, pointing at a registry that does not exist yet.
contract DeployCore is Script {
    error RegistryPredictionMismatch(address predicted, address actual);

    string private constant DEPLOYMENTS_PATH = "deployments/arc-testnet.json";

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        if (vm.exists(DEPLOYMENTS_PATH)) {
            string memory existing = vm.readFile(DEPLOYMENTS_PATH);
            if (vm.keyExistsJson(existing, ".core.registry")) {
                address registryAddress = vm.parseJsonAddress(existing, ".core.registry");
                if (registryAddress.code.length > 0) {
                    console2.log("core already deployed at", registryAddress);
                    return;
                }
            }
        }

        vm.startBroadcast(deployerKey);
        uint64 nonce = vm.getNonce(deployer);
        address predictedRegistry = vm.computeCreateAddress(deployer, nonce + 1);
        VaultFactory factory = new VaultFactory(predictedRegistry);
        WorkflowRegistry registry = new WorkflowRegistry(address(factory), deployer);
        if (address(registry) != predictedRegistry) {
            revert RegistryPredictionMismatch(predictedRegistry, address(registry));
        }
        Executor executor = new Executor(address(registry), deployer);
        GuardModule guard = new GuardModule();
        AutomationTrigger trigger = new AutomationTrigger(address(registry));

        registry.grantRole(registry.CURATOR_ROLE(), deployer);
        registry.publishExecutor(address(executor));
        executor.grantRole(executor.PAUSER_ROLE(), deployer);
        vm.stopBroadcast();

        string memory core = "core";
        vm.serializeAddress(core, "factory", address(factory));
        vm.serializeAddress(core, "registry", address(registry));
        vm.serializeAddress(core, "executor", address(executor));
        vm.serializeAddress(core, "guardModule", address(guard));
        vm.serializeAddress(core, "automationTrigger", address(trigger));
        vm.serializeAddress(core, "admin", deployer);
        vm.serializeString(core, "commit", vm.envOr("GIT_COMMIT", string("")));
        string memory coreJson = vm.serializeBool(core, "verified", false);

        string memory root = "root";
        vm.serializeString(root, "tokens", "{}");
        vm.serializeString(root, "adapters", "{}");
        string memory outJson = vm.serializeString(root, "core", coreJson);
        vm.writeJson(outJson, DEPLOYMENTS_PATH);
        console2.log("registry", address(registry));
        console2.log("executor", address(executor));
        console2.log("factory", address(factory));
    }
}
