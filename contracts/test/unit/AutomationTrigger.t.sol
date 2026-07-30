// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {NoTriggerStep, NotOwner, SystemPaused, TriggerNotDue} from "../../src/interfaces/Errors.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {AutomationTrigger} from "../../src/modules/AutomationTrigger.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockStepAdapter} from "../mocks/MockStepAdapter.sol";

contract AutomationTriggerTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    AutomationTrigger internal trigger;
    MockERC20 internal usdc;
    MockStepAdapter internal supplyAdapter;

    address internal userVault;

    address internal admin = makeAddr("admin");
    address internal user = makeAddr("user");
    address internal stranger = makeAddr("stranger");

    uint64 internal startAt;
    uint256 internal workflowId;

    function setUp() public {
        vm.warp(100_000);
        startAt = uint64(block.timestamp + 100);

        address predictedRegistry = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        factory = new VaultFactory(predictedRegistry);
        registry = new WorkflowRegistry(address(factory), admin);
        executor = new Executor(address(registry), admin);
        trigger = new AutomationTrigger(address(registry));
        usdc = new MockERC20("USD Coin", "USDC", 6);
        supplyAdapter = new MockStepAdapter(StepType.SUPPLY);

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.publishExecutor(address(executor));
        registry.setAdapterAllowed(address(trigger), StepType.TRIGGER, true);
        registry.setAdapterAllowed(address(supplyAdapter), StepType.SUPPLY, true);
        vm.stopPrank();

        Step[] memory steps = new Step[](2);
        steps[0] = Step(StepType.TRIGGER, address(trigger), abi.encode(uint64(3600), startAt));
        steps[1] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        vm.prank(user);
        workflowId = registry.create(steps);

        userVault = registry.get(workflowId).vault;
        vm.prank(user);
        StrategyVault(userVault)
            .setSession(address(usdc), type(uint128).max, type(uint128).max, uint64(block.timestamp + 365 days));
    }

    function test_CheckUpkeepFollowsTheSchedule() public {
        (bool needed,) = trigger.checkUpkeep(abi.encode(workflowId));
        assertFalse(needed);

        vm.warp(startAt);
        (needed,) = trigger.checkUpkeep(abi.encode(workflowId));
        assertTrue(needed);
    }

    function test_RevertWhen_PerformBeforeStart() public {
        vm.expectRevert(abi.encodeWithSelector(TriggerNotDue.selector, uint256(startAt)));
        trigger.performUpkeep(abi.encode(workflowId));
    }

    function test_PerformRunsTheWorkflowWhenDue() public {
        vm.warp(startAt);
        trigger.performUpkeep(abi.encode(workflowId));
        assertEq(supplyAdapter.executeCount(), 1);
        assertEq(trigger.lastRunAt(workflowId), block.timestamp);
    }

    function test_RevertWhen_PerformBeforeTheIntervalElapses() public {
        vm.warp(startAt);
        trigger.performUpkeep(abi.encode(workflowId));

        vm.warp(startAt + 3599);
        vm.expectRevert(abi.encodeWithSelector(TriggerNotDue.selector, uint256(startAt) + 3600));
        trigger.performUpkeep(abi.encode(workflowId));

        vm.warp(startAt + 3600);
        trigger.performUpkeep(abi.encode(workflowId));
        assertEq(supplyAdapter.executeCount(), 2);
    }

    function test_CheckUpkeepFalseRightAfterARun() public {
        vm.warp(startAt);
        trigger.performUpkeep(abi.encode(workflowId));
        (bool needed,) = trigger.checkUpkeep(abi.encode(workflowId));
        assertFalse(needed);
    }

    function test_OwnerCanAlwaysRunDirectly() public {
        vm.prank(user);
        executor.run(workflowId);
        assertEq(supplyAdapter.executeCount(), 1);
    }

    function test_RevertWhen_StrangerRuns() public {
        vm.prank(stranger);
        vm.expectRevert(NotOwner.selector);
        executor.run(workflowId);
    }

    function test_RevertWhen_ForeignTriggerRuns() public {
        AutomationTrigger foreignTrigger = new AutomationTrigger(address(registry));
        vm.prank(admin);
        registry.setAdapterAllowed(address(foreignTrigger), StepType.TRIGGER, true);

        vm.warp(startAt);
        vm.expectRevert(NoTriggerStep.selector);
        foreignTrigger.performUpkeep(abi.encode(workflowId));

        vm.prank(address(foreignTrigger));
        vm.expectRevert(NotOwner.selector);
        executor.run(workflowId);
    }

    function test_RevertWhen_WorkflowHasNoTriggerStep() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        vm.prank(user);
        uint256 plainWorkflowId = registry.create(steps);

        vm.expectRevert(NoTriggerStep.selector);
        trigger.performUpkeep(abi.encode(plainWorkflowId));
    }

    function test_ScheduledRunStaysOnTheAcceptedExecutorAfterANewerPublish() public {
        Executor newExecutor = _publishAndPause();

        vm.warp(startAt);
        trigger.performUpkeep(abi.encode(workflowId));

        assertEq(supplyAdapter.executeCount(), 1);
        assertEq(StrategyVault(userVault).acceptedExecutor(), address(executor));
        assertEq(registry.executor(), address(newExecutor));
    }

    function test_ScheduledRunFollowsTheOwnerToTheAcceptedExecutor() public {
        Executor newExecutor = new Executor(address(registry), admin);
        bytes32 pauserRole = executor.PAUSER_ROLE();
        vm.startPrank(admin);
        registry.publishExecutor(address(newExecutor));
        executor.grantRole(pauserRole, admin);
        executor.pause();
        vm.stopPrank();

        vm.prank(user);
        StrategyVault(userVault).acceptExecutor(address(newExecutor));

        vm.warp(startAt);
        trigger.performUpkeep(abi.encode(workflowId));
        assertEq(supplyAdapter.executeCount(), 1);
        assertTrue(executor.paused());
    }

    function test_RevertWhen_PerformUpkeepRoutesToAPausedAcceptedExecutor() public {
        bytes32 pauserRole = executor.PAUSER_ROLE();
        vm.startPrank(admin);
        executor.grantRole(pauserRole, admin);
        executor.pause();
        vm.stopPrank();

        vm.warp(startAt);
        vm.expectRevert(SystemPaused.selector);
        trigger.performUpkeep(abi.encode(workflowId));
    }

    function test_CheckUpkeepIsFalseWhenTheAcceptedExecutorIsRetired() public {
        vm.warp(startAt);
        (bool needed,) = trigger.checkUpkeep(abi.encode(workflowId));
        assertTrue(needed);

        vm.prank(admin);
        registry.retireExecutor(address(executor));

        (needed,) = trigger.checkUpkeep(abi.encode(workflowId));
        assertFalse(needed);
    }

    function test_CheckUpkeepIsFalseWhenNoExecutorWasEverAccepted() public {
        vm.prank(admin);
        registry.retireExecutor(address(executor));

        Step[] memory steps = new Step[](2);
        steps[0] = Step(StepType.TRIGGER, address(trigger), abi.encode(uint64(3600), startAt));
        steps[1] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        vm.prank(stranger);
        uint256 orphanWorkflowId = registry.create(steps);

        vm.warp(startAt);
        (bool needed,) = trigger.checkUpkeep(abi.encode(orphanWorkflowId));
        assertFalse(needed);
    }

    function _publishAndPause() internal returns (Executor newExecutor) {
        newExecutor = new Executor(address(registry), admin);
        bytes32 pauserRole = newExecutor.PAUSER_ROLE();
        vm.startPrank(admin);
        registry.publishExecutor(address(newExecutor));
        newExecutor.grantRole(pauserRole, admin);
        newExecutor.pause();
        vm.stopPrank();
    }
}
