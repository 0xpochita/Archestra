// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {CcipAdapter} from "../../src/adapters/CcipAdapter.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {NoActiveSession, NotExecutor, SessionCapExceeded} from "../../src/interfaces/Errors.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockCcipRouter} from "../mocks/MockCcipRouter.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract CcipAdapterTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    MockCcipRouter internal router;
    CcipAdapter internal adapter;
    MockERC20 internal usdc;

    address internal userVault;
    uint64 internal expiry;

    address internal admin = makeAddr("admin");
    address internal user = makeAddr("user");
    address internal receiver = makeAddr("receiver");

    function setUp() public {
        vm.warp(100_000);
        expiry = uint64(block.timestamp + 365 days);
        address predictedRegistry = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        factory = new VaultFactory(predictedRegistry);
        registry = new WorkflowRegistry(address(factory), admin);
        executor = new Executor(address(registry), admin);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        router = new MockCcipRouter();
        adapter = new CcipAdapter(address(registry), address(router));

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.publishExecutor(address(executor));
        registry.setAdapterAllowed(address(adapter), StepType.BRIDGE, true);
        vm.stopPrank();

        userVault = factory.createVault(user);
        vm.prank(user);
        StrategyVault(userVault).setSession(address(usdc), type(uint128).max, type(uint128).max, expiry);
    }

    function _bridgeParams(uint256 amount) internal view returns (bytes memory params) {
        return abi.encode(uint64(1234), receiver, address(usdc), amount);
    }

    function test_BridgeSendsTheMessageAndTheTokenLeavesOnce() public {
        router.setFee(0.01 ether);
        vm.deal(address(adapter), 1 ether);

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.BRIDGE, address(adapter), _bridgeParams(500e6));
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        address vault = registry.get(workflowId).vault;
        usdc.mint(vault, 500e6);

        vm.prank(user);
        executor.run(workflowId);

        assertEq(router.lastDestinationChainSelector(), 1234);
        assertEq(router.lastReceiver(), abi.encode(receiver));
        assertEq(router.lastToken(), address(usdc));
        assertEq(router.lastAmount(), 500e6);
        assertEq(router.sendCount(), 1);
        assertEq(usdc.balanceOf(vault), 0);
        assertEq(usdc.balanceOf(address(adapter)), 0);
        assertEq(usdc.totalSupply(), 0);
        assertEq(usdc.allowance(vault, address(adapter)), 0);
        assertEq(usdc.allowance(address(adapter), address(router)), 0);
        assertEq(address(adapter).balance, 0.99 ether);
    }

    function test_RevertWhen_FeeCannotBeCovered() public {
        router.setFee(0.01 ether);

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.BRIDGE, address(adapter), _bridgeParams(500e6));
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        usdc.mint(registry.get(workflowId).vault, 500e6);

        vm.prank(user);
        vm.expectRevert();
        executor.run(workflowId);
    }

    function test_RevertWhen_ExecuteCalledDirectly() public {
        vm.prank(user);
        vm.expectRevert(NotExecutor.selector);
        adapter.execute(makeAddr("vault"), _bridgeParams(1));
    }

    function test_RevertWhen_BridgeRunsWithoutASession() public {
        router.setFee(0.01 ether);
        vm.deal(address(adapter), 1 ether);

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.BRIDGE, address(adapter), _bridgeParams(500e6));
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        usdc.mint(userVault, 500e6);

        vm.prank(user);
        StrategyVault(userVault).revokeSession(address(usdc));

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(NoActiveSession.selector, address(usdc)));
        executor.run(workflowId);
        assertEq(router.sendCount(), 0);
    }

    function test_RevertWhen_BridgeBreachesTheSessionCap() public {
        router.setFee(0.01 ether);
        vm.deal(address(adapter), 1 ether);

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.BRIDGE, address(adapter), _bridgeParams(500e6));
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        usdc.mint(userVault, 500e6);

        vm.prank(user);
        StrategyVault(userVault).setSession(address(usdc), 100e6, 100e6, expiry);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(SessionCapExceeded.selector, address(usdc), 500e6, 100e6));
        executor.run(workflowId);

        assertEq(router.sendCount(), 0);
        assertEq(usdc.balanceOf(userVault), 500e6);
    }
}
