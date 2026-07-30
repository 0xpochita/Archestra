// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Executor} from "../src/core/Executor.sol";
import {StrategyVault} from "../src/core/StrategyVault.sol";
import {WorkflowRegistry} from "../src/core/WorkflowRegistry.sol";
import {Step, StepType} from "../src/interfaces/Types.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// Creates and runs the studio's demo chain from a real wallet on Arc testnet,
/// which is the exit criterion for milestone M5.
contract SmokeRun is Script {
    string private constant DEPLOYMENTS_PATH = "deployments/arc-testnet.json";

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        string memory deployments = vm.readFile(DEPLOYMENTS_PATH);
        WorkflowRegistry registry = WorkflowRegistry(vm.parseJsonAddress(deployments, ".core.registry"));
        Executor executor = Executor(vm.parseJsonAddress(deployments, ".core.executor"));
        address trigger = vm.parseJsonAddress(deployments, ".core.automationTrigger");
        address supplyAdapter = vm.parseJsonAddress(deployments, ".adapters.supply");
        address swapAdapter = vm.parseJsonAddress(deployments, ".adapters.swap");
        address stakeAdapter = vm.parseJsonAddress(deployments, ".adapters.stake");
        address curvePool = vm.parseJsonAddress(deployments, ".adapters.curvePool");
        address gauge = vm.parseJsonAddress(deployments, ".adapters.gauge");
        MockERC20 usdc = MockERC20(vm.parseJsonAddress(deployments, ".tokens.usdc"));
        MockERC20 weth = MockERC20(vm.parseJsonAddress(deployments, ".tokens.weth"));

        Step[] memory steps = new Step[](5);
        steps[0] = Step(StepType.TRIGGER, trigger, abi.encode(uint64(86400), uint64(0)));
        steps[1] = Step(StepType.SUPPLY, supplyAdapter, abi.encode(address(usdc), uint256(200e6)));
        steps[2] = Step(
            StepType.SWAP,
            swapAdapter,
            abi.encode(
                address(usdc),
                address(weth),
                uint256(100e6),
                uint256(0.01e18),
                uint24(500),
                uint64(block.timestamp + 3600)
            )
        );
        steps[3] = Step(StepType.STAKE, stakeAdapter, abi.encode(curvePool, gauge, uint256(100e6), uint256(1)));
        steps[4] = Step(StepType.NOTIFY, address(executor), abi.encode(bytes32("defi-ops"), bytes32("smoke-run")));

        vm.startBroadcast(deployerKey);
        uint256 workflowId = registry.create(steps);
        address vault = registry.get(workflowId).vault;
        usdc.mint(vault, 1000e6);
        uint64 sessionExpiry = uint64(block.timestamp + 1 days);
        StrategyVault(vault).setSession(address(usdc), type(uint128).max, type(uint128).max, sessionExpiry);
        StrategyVault(vault).setSession(address(weth), type(uint128).max, type(uint128).max, sessionExpiry);
        bytes32 runId = executor.run(workflowId);
        vm.stopBroadcast();

        console2.log("workflowId", workflowId);
        console2.log("vault", vault);
        console2.logBytes32(runId);
    }
}
