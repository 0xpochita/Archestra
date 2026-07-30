// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Executor} from "../../src/core/Executor.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {InvalidFeedAnswer, StaleFeed} from "../../src/interfaces/Errors.sol";
import {IExecutor} from "../../src/interfaces/IExecutor.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {GuardModule} from "../../src/modules/GuardModule.sol";
import {MockAggregator} from "../mocks/MockAggregator.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockStepAdapter} from "../mocks/MockStepAdapter.sol";

contract GuardModuleTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    GuardModule internal guard;
    MockAggregator internal feed;
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
        guard = new GuardModule();
        feed = new MockAggregator(8, 2000e8);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        supplyAdapter = new MockStepAdapter(StepType.SUPPLY);

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.publishExecutor(address(executor));
        registry.setAdapterAllowed(address(guard), StepType.GUARD, true);
        registry.setAdapterAllowed(address(supplyAdapter), StepType.SUPPLY, true);
        vm.stopPrank();
    }

    function _params(int256 bound, uint8 comparator, uint64 maxStale) internal view returns (bytes memory params) {
        return abi.encode(address(feed), bound, comparator, maxStale);
    }

    function test_ContinuesWhenAnswerAboveBoundWithBelowComparator() public view {
        (bool shouldContinue, int256 answer) = guard.check(_params(1500e8, 0, 3600));
        assertTrue(shouldContinue);
        assertEq(answer, 2000e8);
    }

    function test_StopsWhenAnswerBelowBoundWithBelowComparator() public {
        feed.setAnswer(1000e8);
        (bool shouldContinue,) = guard.check(_params(1500e8, 0, 3600));
        assertFalse(shouldContinue);
    }

    function test_StopsWhenAnswerAboveBoundWithAboveComparator() public view {
        (bool shouldContinue,) = guard.check(_params(1500e8, 1, 3600));
        assertFalse(shouldContinue);
    }

    function test_ContinuesWhenAnswerBelowBoundWithAboveComparator() public {
        feed.setAnswer(1000e8);
        (bool shouldContinue,) = guard.check(_params(1500e8, 1, 3600));
        assertTrue(shouldContinue);
    }

    function test_EqualAnswerAndBoundContinuesForBothComparators() public {
        feed.setAnswer(1500e8);
        (bool continueBelow,) = guard.check(_params(1500e8, 0, 3600));
        (bool continueAbove,) = guard.check(_params(1500e8, 1, 3600));
        assertTrue(continueBelow);
        assertTrue(continueAbove);
    }

    function test_RevertWhen_FeedIsStale() public {
        uint256 staleTimestamp = block.timestamp - 7200;
        feed.setUpdatedAt(staleTimestamp);
        vm.expectRevert(abi.encodeWithSelector(StaleFeed.selector, staleTimestamp, 3600));
        guard.check(_params(1500e8, 0, 3600));
    }

    function test_RevertWhen_AnswerIsNotPositive() public {
        feed.setAnswer(0);
        vm.expectRevert(abi.encodeWithSelector(InvalidFeedAnswer.selector, int256(0)));
        guard.check(_params(1500e8, 0, 3600));

        feed.setAnswer(-5);
        vm.expectRevert(abi.encodeWithSelector(InvalidFeedAnswer.selector, int256(-5)));
        guard.check(_params(1500e8, 0, 3600));
    }

    function test_FailedBoundEndsTheRunStoppedWithoutReverting() public {
        feed.setAnswer(1000e8);
        Step[] memory steps = new Step[](3);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        steps[1] = Step(StepType.GUARD, address(guard), _params(1500e8, 0, 3600));
        steps[2] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        bytes32 expected = keccak256(abi.encode(workflowId, block.number, user, uint256(0)));

        vm.expectEmit(true, true, false, true);
        emit IExecutor.GuardStopped(expected, 1, 1000e8);
        vm.expectEmit(true, false, false, true);
        emit IExecutor.RunCompleted(expected, true, 1);

        vm.prank(user);
        executor.run(workflowId);
        assertEq(supplyAdapter.executeCount(), 1);
    }

    function test_PassingBoundLetsTheRunFinish() public {
        Step[] memory steps = new Step[](2);
        steps[0] = Step(StepType.GUARD, address(guard), _params(1500e8, 0, 3600));
        steps[1] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        bytes32 expected = keccak256(abi.encode(workflowId, block.number, user, uint256(0)));

        vm.expectEmit(true, false, false, true);
        emit IExecutor.RunCompleted(expected, false, 2);
        vm.prank(user);
        executor.run(workflowId);
        assertEq(supplyAdapter.executeCount(), 1);
    }
}
