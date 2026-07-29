// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Test} from "forge-std/Test.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {SystemPaused} from "../../src/interfaces/Errors.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockStepAdapter} from "../mocks/MockStepAdapter.sol";

contract PauseAndRolesTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    MockERC20 internal usdc;
    MockStepAdapter internal supplyAdapter;

    address internal admin = makeAddr("admin");
    address internal pauser = makeAddr("pauser");
    address internal user = makeAddr("user");
    address internal stranger = makeAddr("stranger");

    uint256 internal workflowId;
    address internal vault;

    function setUp() public {
        address predictedRegistry = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        factory = new VaultFactory(predictedRegistry);
        registry = new WorkflowRegistry(address(factory), admin);
        executor = new Executor(address(registry), admin);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        supplyAdapter = new MockStepAdapter(StepType.SUPPLY);

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.setExecutor(address(executor));
        executor.grantRole(executor.PAUSER_ROLE(), pauser);
        registry.setAdapterAllowed(address(supplyAdapter), StepType.SUPPLY, true);
        vm.stopPrank();

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(1e6)));
        vm.prank(user);
        workflowId = registry.create(steps);
        vault = registry.get(workflowId).vault;
        usdc.mint(vault, 100e6);
    }

    function test_PausedRunRevertsSystemPaused() public {
        vm.prank(pauser);
        executor.pause();

        vm.prank(user);
        vm.expectRevert(SystemPaused.selector);
        executor.run(workflowId);
    }

    function test_PausedWithdrawalStillSucceeds() public {
        vm.prank(pauser);
        executor.pause();

        vm.prank(user);
        StrategyVault(vault).withdraw(address(usdc), 100e6, user);
        assertEq(usdc.balanceOf(user), 100e6);
    }

    function test_UnpauseRestoresRuns() public {
        vm.prank(pauser);
        executor.pause();
        vm.prank(pauser);
        executor.unpause();

        vm.prank(user);
        executor.run(workflowId);
    }

    function test_PauseDoesNotBlockRegistryWrites() public {
        vm.prank(pauser);
        executor.pause();

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(2e6)));
        vm.prank(user);
        uint256 newWorkflowId = registry.create(steps);
        vm.prank(user);
        registry.update(newWorkflowId, steps);
        vm.prank(user);
        registry.setActive(newWorkflowId, false);
    }

    function test_RoleChangesEmitStandardEvents() public {
        bytes32 pauserRole = executor.PAUSER_ROLE();
        address newPauser = makeAddr("newPauser");

        vm.expectEmit(true, true, true, true);
        emit IAccessControl.RoleGranted(pauserRole, newPauser, admin);
        vm.prank(admin);
        executor.grantRole(pauserRole, newPauser);

        vm.expectEmit(true, true, true, true);
        emit IAccessControl.RoleRevoked(pauserRole, newPauser, admin);
        vm.prank(admin);
        executor.revokeRole(pauserRole, newPauser);
    }

    function test_RevokedPauserLosesThePower() public {
        bytes32 pauserRole = executor.PAUSER_ROLE();
        address newPauser = makeAddr("newPauser");

        vm.startPrank(admin);
        executor.grantRole(pauserRole, newPauser);
        executor.revokeRole(pauserRole, pauser);
        vm.stopPrank();

        vm.prank(pauser);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, pauser, pauserRole)
        );
        executor.pause();

        vm.prank(newPauser);
        executor.pause();
        assertTrue(executor.paused());
    }

    function test_RevertWhen_StrangerGrantsRoles() public {
        bytes32 pauserRole = executor.PAUSER_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, bytes32(0))
        );
        executor.grantRole(pauserRole, stranger);
    }
}
