// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Test} from "forge-std/Test.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {
    AdapterNotAllowed,
    EmptyWorkflow,
    NotExecutor,
    NotOwner,
    RunInFlight,
    TooManySteps,
    ZeroAddress
} from "../../src/interfaces/Errors.sol";
import {IWorkflowRegistry} from "../../src/interfaces/IWorkflowRegistry.sol";
import {Step, StepType, Workflow} from "../../src/interfaces/Types.sol";

contract WorkflowRegistryTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;

    address internal admin = makeAddr("admin");
    address internal curator = makeAddr("curator");
    address internal user = makeAddr("user");
    address internal executorAddr = makeAddr("executor");
    address internal stranger = makeAddr("stranger");

    address internal triggerModule = makeAddr("triggerModule");
    address internal aaveAdapter = makeAddr("aaveAdapter");
    address internal uniswapAdapter = makeAddr("uniswapAdapter");
    address internal curveAdapter = makeAddr("curveAdapter");
    address internal alertModule = makeAddr("alertModule");

    function setUp() public {
        address predictedRegistry = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        factory = new VaultFactory(predictedRegistry);
        registry = new WorkflowRegistry(address(factory), admin);
        assertEq(address(registry), predictedRegistry);

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), curator);
        registry.publishExecutor(executorAddr);
        vm.stopPrank();

        vm.startPrank(curator);
        registry.setAdapterAllowed(triggerModule, StepType.TRIGGER, true);
        registry.setAdapterAllowed(aaveAdapter, StepType.SUPPLY, true);
        registry.setAdapterAllowed(uniswapAdapter, StepType.SWAP, true);
        registry.setAdapterAllowed(curveAdapter, StepType.STAKE, true);
        registry.setAdapterAllowed(alertModule, StepType.NOTIFY, true);
        vm.stopPrank();
    }

    function _supplySteps(uint256 count) internal returns (Step[] memory steps) {
        steps = new Step[](count);
        for (uint256 i = 0; i < count; i++) {
            steps[i] = Step({
                stepType: StepType.SUPPLY, adapter: aaveAdapter, params: abi.encode(makeAddr("usdc"), uint256(100e6))
            });
        }
    }

    function _demoSteps() internal returns (Step[] memory steps) {
        steps = new Step[](5);
        steps[0] =
            Step({stepType: StepType.TRIGGER, adapter: triggerModule, params: abi.encode(uint64(86400), uint64(0))});
        steps[1] = Step({
            stepType: StepType.SUPPLY, adapter: aaveAdapter, params: abi.encode(makeAddr("usdc"), uint256(5000e6))
        });
        steps[2] = Step({
            stepType: StepType.SWAP,
            adapter: uniswapAdapter,
            params: abi.encode(
                makeAddr("usdc"), makeAddr("weth"), uint256(1000e6), uint256(1), uint24(500), uint64(2000000000)
            )
        });
        steps[3] = Step({
            stepType: StepType.STAKE,
            adapter: curveAdapter,
            params: abi.encode(makeAddr("pool"), makeAddr("gauge"), uint256(500e6), uint256(1))
        });
        steps[4] = Step({
            stepType: StepType.NOTIFY, adapter: alertModule, params: abi.encode(bytes32("defi-ops"), bytes32("alert-1"))
        });
    }

    function test_CreateStoresTheStudioDemoChain() public {
        Step[] memory steps = _demoSteps();
        address predictedVault = factory.predictVault(user);

        vm.expectEmit(true, true, false, true);
        emit IWorkflowRegistry.WorkflowCreated(1, user, predictedVault, steps.length);
        vm.prank(user);
        uint256 workflowId = registry.create(steps);

        assertEq(workflowId, 1);
        Workflow memory stored = registry.get(workflowId);
        assertEq(stored.owner, user);
        assertEq(stored.vault, predictedVault);
        assertEq(stored.createdAt, uint64(block.timestamp));
        assertTrue(stored.active);
        assertEq(abi.encode(stored.steps), abi.encode(steps));
        assertEq(factory.vaultOf(user), predictedVault);
    }

    function test_SecondCreateReusesTheVault() public {
        vm.startPrank(user);
        uint256 first = registry.create(_supplySteps(1));
        uint256 second = registry.create(_supplySteps(2));
        vm.stopPrank();
        assertEq(first, 1);
        assertEq(second, 2);
        assertEq(registry.get(first).vault, registry.get(second).vault);
    }

    function test_RevertWhen_CreateWithZeroSteps() public {
        vm.prank(user);
        vm.expectRevert(EmptyWorkflow.selector);
        registry.create(_supplySteps(0));
    }

    function test_RevertWhen_CreateWithSeventeenSteps() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(TooManySteps.selector, 17, 16));
        registry.create(_supplySteps(17));
    }

    function test_RevertWhen_AdapterNotAllowListed() public {
        Step[] memory steps = _supplySteps(1);
        steps[0].adapter = stranger;
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AdapterNotAllowed.selector, stranger, StepType.SUPPLY));
        registry.create(steps);
    }

    function test_UpdateReplacesStepsAndEmits() public {
        vm.startPrank(user);
        uint256 workflowId = registry.create(_supplySteps(3));
        Step[] memory replacement = _supplySteps(2);

        vm.expectEmit(true, false, false, true);
        emit IWorkflowRegistry.WorkflowUpdated(workflowId, replacement.length);
        registry.update(workflowId, replacement);
        vm.stopPrank();

        assertEq(abi.encode(registry.get(workflowId).steps), abi.encode(replacement));
    }

    function test_RevertWhen_UpdateByNonOwner() public {
        vm.prank(user);
        uint256 workflowId = registry.create(_supplySteps(1));
        vm.prank(stranger);
        vm.expectRevert(NotOwner.selector);
        registry.update(workflowId, _supplySteps(1));
    }

    function test_RevertWhen_UpdateWhileRunInFlight() public {
        vm.prank(user);
        uint256 workflowId = registry.create(_supplySteps(1));

        vm.prank(executorAddr);
        registry.setRunInFlight(workflowId, true);

        vm.prank(user);
        vm.expectRevert(RunInFlight.selector);
        registry.update(workflowId, _supplySteps(2));

        vm.prank(executorAddr);
        registry.setRunInFlight(workflowId, false);

        vm.prank(user);
        registry.update(workflowId, _supplySteps(2));
        assertEq(registry.get(workflowId).steps.length, 2);
    }

    function test_RevertWhen_SetRunInFlightByNonExecutor() public {
        vm.prank(stranger);
        vm.expectRevert(NotExecutor.selector);
        registry.setRunInFlight(1, true);
    }

    function test_SetActiveTogglesTheFlag() public {
        vm.startPrank(user);
        uint256 workflowId = registry.create(_supplySteps(1));
        registry.setActive(workflowId, false);
        assertFalse(registry.get(workflowId).active);
        registry.setActive(workflowId, true);
        assertTrue(registry.get(workflowId).active);
        vm.stopPrank();
    }

    function test_RevertWhen_SetActiveByNonOwner() public {
        vm.prank(user);
        uint256 workflowId = registry.create(_supplySteps(1));
        vm.prank(stranger);
        vm.expectRevert(NotOwner.selector);
        registry.setActive(workflowId, false);
    }

    function test_PublishExecutorAddsToTheSetAndBecomesLatest() public {
        address next = makeAddr("nextExecutor");
        vm.expectEmit(true, false, false, true);
        emit IWorkflowRegistry.ExecutorPublished(next);
        vm.prank(admin);
        registry.publishExecutor(next);

        assertEq(registry.executor(), next);
        assertTrue(registry.isExecutor(next));
        assertTrue(registry.isExecutor(executorAddr));
    }

    function test_RetireExecutorLeavesTheSetAndClearsTheLatestPointer() public {
        vm.expectEmit(true, false, false, true);
        emit IWorkflowRegistry.ExecutorRetired(executorAddr);
        vm.prank(admin);
        registry.retireExecutor(executorAddr);

        assertFalse(registry.isExecutor(executorAddr));
        assertEq(registry.executor(), address(0));
    }

    function test_RetireKeepsTheLatestPointerWhenAnOlderVersionGoes() public {
        address next = makeAddr("nextExecutor");
        vm.startPrank(admin);
        registry.publishExecutor(next);
        registry.retireExecutor(executorAddr);
        vm.stopPrank();

        assertEq(registry.executor(), next);
        assertTrue(registry.isExecutor(next));
        assertFalse(registry.isExecutor(executorAddr));
    }

    function test_AnyPublishedExecutorCanSetRunInFlight() public {
        address next = makeAddr("nextExecutor");
        vm.prank(admin);
        registry.publishExecutor(next);

        vm.prank(user);
        uint256 workflowId = registry.create(_supplySteps(1));

        vm.prank(executorAddr);
        registry.setRunInFlight(workflowId, true);
        vm.prank(user);
        vm.expectRevert(RunInFlight.selector);
        registry.update(workflowId, _supplySteps(2));

        vm.prank(next);
        registry.setRunInFlight(workflowId, false);
        vm.prank(user);
        registry.update(workflowId, _supplySteps(2));
    }

    function test_RevertWhen_RetiredExecutorSetsRunInFlight() public {
        vm.prank(user);
        uint256 workflowId = registry.create(_supplySteps(1));

        vm.prank(admin);
        registry.retireExecutor(executorAddr);

        vm.prank(executorAddr);
        vm.expectRevert(NotExecutor.selector);
        registry.setRunInFlight(workflowId, true);
    }

    function test_RevertWhen_PublishExecutorByNonAdmin() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, bytes32(0))
        );
        registry.publishExecutor(stranger);
    }

    function test_RevertWhen_RetireExecutorByNonAdmin() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, bytes32(0))
        );
        registry.retireExecutor(executorAddr);
    }

    function test_RevertWhen_PublishExecutorToZero() public {
        vm.prank(admin);
        vm.expectRevert(ZeroAddress.selector);
        registry.publishExecutor(address(0));
    }

    function test_RevertWhen_RetireExecutorToZero() public {
        vm.prank(admin);
        vm.expectRevert(ZeroAddress.selector);
        registry.retireExecutor(address(0));
    }

    function test_SetAdapterAllowedByCuratorOnly() public {
        address newAdapter = makeAddr("newAdapter");
        vm.prank(curator);
        registry.setAdapterAllowed(newAdapter, StepType.CLAIM, true);
        assertTrue(registry.isAdapterAllowed(newAdapter, StepType.CLAIM));

        bytes32 curatorRole = registry.CURATOR_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, curatorRole)
        );
        registry.setAdapterAllowed(newAdapter, StepType.CLAIM, false);
    }
}
