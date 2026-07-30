// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockStepAdapter} from "../mocks/MockStepAdapter.sol";

contract ExecutorAllowanceFuzzTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    MockERC20 internal usdc;
    MockStepAdapter internal supplyAdapter;

    address internal admin = makeAddr("admin");
    address internal user = makeAddr("user");

    function setUp() public {
        vm.warp(100_000);
        address predictedRegistry = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        factory = new VaultFactory(predictedRegistry);
        registry = new WorkflowRegistry(address(factory), admin);
        executor = new Executor(address(registry), admin);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        supplyAdapter = new MockStepAdapter(StepType.SUPPLY);

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.publishExecutor(address(executor));
        registry.setAdapterAllowed(address(supplyAdapter), StepType.SUPPLY, true);
        vm.stopPrank();

        address userVault = factory.createVault(user);
        vm.prank(user);
        StrategyVault(userVault)
            .setSession(address(usdc), type(uint256).max, type(uint256).max, uint64(block.timestamp + 365 days));
    }

    function testFuzz_ExactPullIsBracketedAndReset(uint256 balance, uint256 pull) public {
        balance = bound(balance, 1, type(uint128).max);
        pull = bound(pull, 1, balance);

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), pull));
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        address vault = registry.get(workflowId).vault;
        usdc.mint(vault, balance);
        supplyAdapter.setPlan(address(usdc), pull);
        supplyAdapter.setPull(address(usdc));

        vm.prank(user);
        executor.run(workflowId);

        assertEq(supplyAdapter.lastObservedAllowance(), pull);
        assertEq(usdc.allowance(vault, address(supplyAdapter)), 0);
        assertEq(usdc.balanceOf(vault), balance);
        assertEq(usdc.balanceOf(address(executor)), 0);
    }

    function testFuzz_MaxAlwaysResolvesToTheBalance(uint256 balance) public {
        balance = bound(balance, 1, type(uint128).max);

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), type(uint256).max));
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        address vault = registry.get(workflowId).vault;
        usdc.mint(vault, balance);
        supplyAdapter.setPlan(address(usdc), type(uint256).max);
        supplyAdapter.setPull(address(usdc));

        vm.prank(user);
        executor.run(workflowId);

        assertEq(supplyAdapter.lastObservedAllowance(), balance);
        assertEq(usdc.allowance(vault, address(supplyAdapter)), 0);
    }
}
