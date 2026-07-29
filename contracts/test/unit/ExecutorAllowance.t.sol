// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Executor} from "../../src/core/Executor.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {IExecutor} from "../../src/interfaces/IExecutor.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockGuardModule} from "../mocks/MockGuardModule.sol";
import {MockStepAdapter} from "../mocks/MockStepAdapter.sol";
import {RevertingAdapter} from "../mocks/RevertingAdapter.sol";

contract ExecutorAllowanceTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    MockERC20 internal usdc;
    MockStepAdapter internal supplyAdapter;
    MockGuardModule internal guard;

    address internal admin = makeAddr("admin");
    address internal user = makeAddr("user");
    address internal spender = makeAddr("spender");

    function setUp() public {
        address predictedRegistry = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        factory = new VaultFactory(predictedRegistry);
        registry = new WorkflowRegistry(address(factory), admin);
        executor = new Executor(address(registry), admin);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        supplyAdapter = new MockStepAdapter(StepType.SUPPLY);
        guard = new MockGuardModule();

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.setExecutor(address(executor));
        registry.setAdapterAllowed(address(supplyAdapter), StepType.SUPPLY, true);
        registry.setAdapterAllowed(address(guard), StepType.GUARD, true);
        registry.setAdapterAllowed(address(executor), StepType.APPROVE, true);
        vm.stopPrank();
    }

    function _createAndFund(Step[] memory steps, uint256 balance) internal returns (uint256 workflowId, address vault) {
        vm.prank(user);
        workflowId = registry.create(steps);
        vault = registry.get(workflowId).vault;
        usdc.mint(vault, balance);
    }

    function test_AllowanceBracketsTheAdapterCall() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(400e6)));
        (uint256 workflowId, address vault) = _createAndFund(steps, 1000e6);
        supplyAdapter.setPlan(address(usdc), 400e6);
        supplyAdapter.setPull(address(usdc));

        vm.prank(user);
        executor.run(workflowId);

        assertEq(supplyAdapter.lastObservedAllowance(), 400e6);
        assertEq(usdc.allowance(vault, address(supplyAdapter)), 0);
        assertEq(usdc.balanceOf(vault), 1000e6);
        assertEq(usdc.balanceOf(address(supplyAdapter)), 0);
    }

    function test_MaxAmountResolvesToTheWholeVaultBalance() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), type(uint256).max));
        (uint256 workflowId, address vault) = _createAndFund(steps, 750e6);
        supplyAdapter.setPlan(address(usdc), type(uint256).max);
        supplyAdapter.setPull(address(usdc));

        vm.prank(user);
        executor.run(workflowId);

        assertEq(supplyAdapter.lastObservedAllowance(), 750e6);
        assertEq(usdc.allowance(vault, address(supplyAdapter)), 0);
    }

    function test_RevertingAdapterLeavesNoAllowanceBehind() public {
        RevertingAdapter reverting = new RevertingAdapter(StepType.SUPPLY);
        reverting.setPlan(address(usdc), 500e6);
        vm.prank(admin);
        registry.setAdapterAllowed(address(reverting), StepType.SUPPLY, true);

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(reverting), abi.encode(address(usdc), uint256(500e6)));
        (uint256 workflowId, address vault) = _createAndFund(steps, 500e6);

        vm.prank(user);
        vm.expectRevert(RevertingAdapter.AlwaysReverts.selector);
        executor.run(workflowId);

        assertEq(usdc.allowance(vault, address(reverting)), 0);
    }

    function test_GuardStopClearsApproveStepAllowances() public {
        Step[] memory steps = new Step[](2);
        steps[0] = Step(StepType.APPROVE, address(executor), abi.encode(address(usdc), spender, uint256(500e6)));
        steps[1] = Step(StepType.GUARD, address(guard), abi.encode(address(0), int256(0), uint8(0), uint64(3600)));
        (uint256 workflowId, address vault) = _createAndFund(steps, 500e6);
        guard.set(false, 1);

        vm.prank(user);
        executor.run(workflowId);

        assertEq(usdc.allowance(vault, spender), 0);
    }

    function test_ZeroPlanSkipsTheApprovalBracket() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        (uint256 workflowId, address vault) = _createAndFund(steps, 1e6);
        supplyAdapter.setResult(address(usdc), 1e6);

        vm.prank(user);
        executor.run(workflowId);

        assertEq(usdc.allowance(vault, address(supplyAdapter)), 0);
        assertEq(supplyAdapter.executeCount(), 1);
    }
}
