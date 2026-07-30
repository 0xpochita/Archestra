// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Test} from "forge-std/Test.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {
    AdapterNotAllowed,
    ExecutorNotAccepted,
    NoActiveSession,
    NotExecutor,
    NotOwner,
    SessionCapExceeded,
    SystemPaused,
    UnexpectedStepType,
    WorkflowInactive
} from "../../src/interfaces/Errors.sol";
import {IExecutor} from "../../src/interfaces/IExecutor.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockGuardModule} from "../mocks/MockGuardModule.sol";
import {MockStepAdapter} from "../mocks/MockStepAdapter.sol";
import {RevertingAdapter} from "../mocks/RevertingAdapter.sol";

contract ExecutorTest is Test {
    uint256 internal constant CAP = type(uint128).max;

    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    MockERC20 internal usdc;
    MockStepAdapter internal supplyAdapter;
    MockGuardModule internal guard;

    address internal userVault;
    uint64 internal expiry;

    address internal admin = makeAddr("admin");
    address internal pauser = makeAddr("pauser");
    address internal user = makeAddr("user");
    address internal stranger = makeAddr("stranger");
    address internal triggerModule = makeAddr("triggerModule");
    address internal spender = makeAddr("spender");

    function setUp() public {
        vm.warp(100_000);
        expiry = uint64(block.timestamp + 365 days);
        address predictedRegistry = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        factory = new VaultFactory(predictedRegistry);
        registry = new WorkflowRegistry(address(factory), admin);
        executor = new Executor(address(registry), admin);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        supplyAdapter = new MockStepAdapter(StepType.SUPPLY);
        guard = new MockGuardModule();

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.publishExecutor(address(executor));
        executor.grantRole(executor.PAUSER_ROLE(), pauser);
        registry.setAdapterAllowed(triggerModule, StepType.TRIGGER, true);
        registry.setAdapterAllowed(address(supplyAdapter), StepType.SUPPLY, true);
        registry.setAdapterAllowed(address(guard), StepType.GUARD, true);
        registry.setAdapterAllowed(address(executor), StepType.NOTIFY, true);
        registry.setAdapterAllowed(address(executor), StepType.APPROVE, true);
        vm.stopPrank();

        userVault = factory.createVault(user);
        vm.prank(user);
        StrategyVault(userVault).setSession(address(usdc), CAP, CAP, expiry);
    }

    function _create(Step[] memory steps) internal returns (uint256 workflowId) {
        vm.prank(user);
        return registry.create(steps);
    }

    function _expectedRunId(uint256 workflowId, uint256 nonce) internal view returns (bytes32 runId) {
        return keccak256(abi.encode(workflowId, block.number, user, nonce));
    }

    function test_RunEmitsTheFullEventSequence() public {
        Step[] memory steps = new Step[](3);
        steps[0] = Step(StepType.TRIGGER, triggerModule, abi.encode(uint64(86400), uint64(0)));
        steps[1] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(100e6)));
        steps[2] = Step(StepType.NOTIFY, address(executor), abi.encode(bytes32("defi-ops"), bytes32("msg-1")));
        uint256 workflowId = _create(steps);
        supplyAdapter.setResult(address(usdc), 100e6);
        bytes32 expected = _expectedRunId(workflowId, 0);

        vm.expectEmit(true, true, true, true);
        emit IExecutor.RunStarted(expected, workflowId, user);
        vm.expectEmit(true, true, false, true);
        emit IExecutor.StepExecuted(expected, 0, StepType.TRIGGER, triggerModule, address(0), 0);
        vm.expectEmit(true, true, false, true);
        emit IExecutor.StepExecuted(expected, 1, StepType.SUPPLY, address(supplyAdapter), address(usdc), 100e6);
        vm.expectEmit(true, true, false, true);
        emit IExecutor.AlertRaised(expected, bytes32("defi-ops"), bytes32("msg-1"));
        vm.expectEmit(true, true, false, true);
        emit IExecutor.StepExecuted(expected, 2, StepType.NOTIFY, address(executor), address(0), 0);
        vm.expectEmit(true, false, false, true);
        emit IExecutor.RunCompleted(expected, false, 3);

        vm.prank(user);
        bytes32 runId = executor.run(workflowId);
        assertEq(runId, expected);
    }

    function test_RunIdsAreUniqueInsideOneBlock() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        uint256 workflowId = _create(steps);

        vm.prank(user);
        bytes32 first = executor.run(workflowId);
        vm.prank(user);
        bytes32 second = executor.run(workflowId);
        assertTrue(first != second);
    }

    function test_RevertWhen_RunByNonOwner() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        uint256 workflowId = _create(steps);

        vm.prank(stranger);
        vm.expectRevert(NotOwner.selector);
        executor.run(workflowId);
    }

    function test_RevertWhen_RunWhilePaused() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        uint256 workflowId = _create(steps);

        vm.prank(pauser);
        executor.pause();
        vm.prank(user);
        vm.expectRevert(SystemPaused.selector);
        executor.run(workflowId);

        vm.prank(pauser);
        executor.unpause();
        vm.prank(user);
        executor.run(workflowId);
    }

    function test_RevertWhen_PauseByNonPauser() public {
        bytes32 pauserRole = executor.PAUSER_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, pauserRole)
        );
        executor.pause();
    }

    function test_RevertWhen_WorkflowInactive() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        uint256 workflowId = _create(steps);

        vm.prank(user);
        registry.setActive(workflowId, false);
        vm.prank(user);
        vm.expectRevert(WorkflowInactive.selector);
        executor.run(workflowId);
    }

    function test_GuardStopEndsTheRunSuccessfully() public {
        Step[] memory steps = new Step[](3);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        steps[1] = Step(StepType.GUARD, address(guard), abi.encode(address(0), int256(0), uint8(0), uint64(3600)));
        steps[2] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(2e6)));
        uint256 workflowId = _create(steps);
        guard.set(false, 42);
        bytes32 expected = _expectedRunId(workflowId, 0);

        vm.expectEmit(true, true, false, true);
        emit IExecutor.GuardStopped(expected, 1, 42);
        vm.expectEmit(true, false, false, true);
        emit IExecutor.RunCompleted(expected, true, 1);

        vm.prank(user);
        executor.run(workflowId);
        assertEq(supplyAdapter.executeCount(), 1);
    }

    function test_GuardPassContinuesTheRun() public {
        Step[] memory steps = new Step[](2);
        steps[0] = Step(StepType.GUARD, address(guard), abi.encode(address(0), int256(0), uint8(0), uint64(3600)));
        steps[1] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        uint256 workflowId = _create(steps);
        guard.set(true, 7);
        bytes32 expected = _expectedRunId(workflowId, 0);

        vm.expectEmit(true, false, false, true);
        emit IExecutor.RunCompleted(expected, false, 2);
        vm.prank(user);
        executor.run(workflowId);
        assertEq(supplyAdapter.executeCount(), 1);
    }

    function test_RevertingStepRevertsTheWholeRunAndReleasesTheLock() public {
        RevertingAdapter reverting = new RevertingAdapter(StepType.SUPPLY);
        vm.prank(admin);
        registry.setAdapterAllowed(address(reverting), StepType.SUPPLY, true);

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(reverting), abi.encode(address(usdc), uint256(1e6)));
        uint256 workflowId = _create(steps);

        vm.prank(user);
        vm.expectRevert(RevertingAdapter.AlwaysReverts.selector);
        executor.run(workflowId);

        Step[] memory replacement = new Step[](1);
        replacement[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        vm.prank(user);
        registry.update(workflowId, replacement);
    }

    function test_RevertWhen_AdapterDelistedAfterCreate() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        uint256 workflowId = _create(steps);

        vm.prank(admin);
        registry.setAdapterAllowed(address(supplyAdapter), StepType.SUPPLY, false);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AdapterNotAllowed.selector, address(supplyAdapter), StepType.SUPPLY));
        executor.run(workflowId);
    }

    function test_RevertWhen_AdapterTypeMismatch() public {
        MockStepAdapter mismatched = new MockStepAdapter(StepType.SWAP);
        vm.prank(admin);
        registry.setAdapterAllowed(address(mismatched), StepType.SUPPLY, true);

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(mismatched), abi.encode(address(usdc), uint256(1e6)));
        uint256 workflowId = _create(steps);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(UnexpectedStepType.selector, StepType.SUPPLY, StepType.SWAP));
        executor.run(workflowId);
    }

    function test_ApproveStepAllowanceLivesOnlyInsideTheRun() public {
        Step[] memory steps = new Step[](2);
        steps[0] = Step(
            StepType.APPROVE, address(executor), abi.encode(address(usdc), address(supplyAdapter), uint256(500e6))
        );
        steps[1] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(500e6)));
        uint256 workflowId = _create(steps);
        usdc.mint(userVault, 500e6);
        supplyAdapter.setPull(address(usdc));

        vm.prank(user);
        executor.run(workflowId);

        assertEq(supplyAdapter.lastObservedAllowance(), 500e6);
        assertEq(usdc.allowance(userVault, address(supplyAdapter)), 0);
    }

    function test_RevertWhen_TheVaultNeverAcceptedThisExecutor() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        uint256 workflowId = _create(steps);

        Executor newExecutor = new Executor(address(registry), admin);
        vm.prank(admin);
        registry.publishExecutor(address(newExecutor));

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ExecutorNotAccepted.selector, address(newExecutor), address(executor)));
        newExecutor.run(workflowId);
    }

    function test_AcceptedExecutorKeepsRunningAfterANewerPublish() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        uint256 workflowId = _create(steps);

        Executor newExecutor = new Executor(address(registry), admin);
        vm.prank(admin);
        registry.publishExecutor(address(newExecutor));

        vm.prank(user);
        executor.run(workflowId);
        assertEq(supplyAdapter.executeCount(), 1);
    }

    function test_AcceptingANewerExecutorRetiresTheOldOneForThisVault() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        uint256 workflowId = _create(steps);

        Executor newExecutor = new Executor(address(registry), admin);
        vm.prank(admin);
        registry.publishExecutor(address(newExecutor));
        vm.prank(user);
        StrategyVault(userVault).acceptExecutor(address(newExecutor));

        vm.prank(user);
        newExecutor.run(workflowId);
        assertEq(supplyAdapter.executeCount(), 1);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ExecutorNotAccepted.selector, address(executor), address(newExecutor)));
        executor.run(workflowId);
    }

    function test_RetiredExecutorStopsRunsButNeverTheWithdrawal() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        uint256 workflowId = _create(steps);
        usdc.mint(userVault, 100e6);

        vm.prank(admin);
        registry.retireExecutor(address(executor));

        vm.prank(user);
        vm.expectRevert(NotExecutor.selector);
        executor.run(workflowId);

        vm.prank(user);
        StrategyVault(userVault).withdraw(address(usdc), 100e6, user);
        assertEq(usdc.balanceOf(user), 100e6);
    }

    function test_RevertWhen_RunWithoutAnActiveSession() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(500e6)));
        uint256 workflowId = _create(steps);
        usdc.mint(userVault, 500e6);
        supplyAdapter.setPlan(address(usdc), 500e6);
        supplyAdapter.setPull(address(usdc));

        vm.prank(user);
        StrategyVault(userVault).revokeSession(address(usdc));

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(NoActiveSession.selector, address(usdc)));
        executor.run(workflowId);
    }

    function test_RevertWhen_RunBreachesThePerRunCapAndTheWholeRunRollsBack() public {
        Step[] memory steps = new Step[](2);
        steps[0] = Step(StepType.APPROVE, address(executor), abi.encode(address(usdc), spender, uint256(50e6)));
        steps[1] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(400e6)));
        uint256 workflowId = _create(steps);
        usdc.mint(userVault, 400e6);
        supplyAdapter.setPlan(address(usdc), 400e6);
        supplyAdapter.setPull(address(usdc));

        vm.prank(user);
        StrategyVault(userVault).setSession(address(usdc), 200e6, CAP, expiry);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(SessionCapExceeded.selector, address(usdc), 400e6, 200e6));
        executor.run(workflowId);

        assertEq(usdc.allowance(userVault, spender), 0);
        assertEq(usdc.balanceOf(userVault), 400e6);
        assertEq(supplyAdapter.executeCount(), 0);
        assertEq(StrategyVault(userVault).sessionSpentToday(address(usdc)), 0);
    }

    function test_RevertWhen_RunBreachesThePerDayCap() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(200e6)));
        uint256 workflowId = _create(steps);
        usdc.mint(userVault, 200e6);
        supplyAdapter.setPlan(address(usdc), 200e6);
        supplyAdapter.setPull(address(usdc));

        vm.prank(user);
        StrategyVault(userVault).setSession(address(usdc), CAP, 300e6, expiry);

        vm.prank(user);
        executor.run(workflowId);
        assertEq(StrategyVault(userVault).sessionSpentToday(address(usdc)), 200e6);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(SessionCapExceeded.selector, address(usdc), 200e6, 100e6));
        executor.run(workflowId);
    }

    function test_EstimateSumsTheGasTable() public {
        address swapAdapter = makeAddr("swapAdapter");
        address stakeAdapter = makeAddr("stakeAdapter");
        address claimAdapter = makeAddr("claimAdapter");
        vm.startPrank(admin);
        registry.setAdapterAllowed(swapAdapter, StepType.SWAP, true);
        registry.setAdapterAllowed(stakeAdapter, StepType.STAKE, true);
        registry.setAdapterAllowed(claimAdapter, StepType.CLAIM, true);
        vm.stopPrank();

        Step[] memory steps = new Step[](6);
        steps[0] = Step(StepType.TRIGGER, triggerModule, abi.encode(uint64(1), uint64(0)));
        steps[1] = Step(StepType.APPROVE, address(executor), abi.encode(address(usdc), spender, uint256(1)));
        steps[2] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1)));
        steps[3] = Step(
            StepType.SWAP,
            swapAdapter,
            abi.encode(address(usdc), address(usdc), uint256(1), uint256(1), uint24(500), uint64(1))
        );
        steps[4] = Step(StepType.STAKE, stakeAdapter, abi.encode(address(0), address(0), uint256(1), uint256(1)));
        steps[5] = Step(StepType.CLAIM, claimAdapter, abi.encode(address(0), uint256(1)));
        uint256 workflowId = _create(steps);

        assertEq(executor.estimate(workflowId), 771100);
    }
}
