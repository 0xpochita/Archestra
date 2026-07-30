// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {CcipAdapter} from "../../src/adapters/CcipAdapter.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockCcipRouter} from "../mocks/MockCcipRouter.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract CcipAdapterFuzzTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    MockCcipRouter internal router;
    CcipAdapter internal adapter;
    MockERC20 internal usdc;

    address internal admin = makeAddr("admin");
    address internal user = makeAddr("user");

    function setUp() public {
        vm.warp(100_000);
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

        address userVault = factory.createVault(user);
        vm.prank(user);
        StrategyVault(userVault)
            .setSession(address(usdc), type(uint256).max, type(uint256).max, uint64(block.timestamp + 365 days));
    }

    function testFuzz_BridgedAmountLeavesTheVaultExactlyOnce(uint256 balance, uint256 amount) public {
        balance = bound(balance, 1, type(uint96).max);
        amount = bound(amount, 1, balance);
        router.setFee(0.01 ether);
        vm.deal(address(adapter), 1 ether);

        Step[] memory steps = new Step[](1);
        steps[0] = Step(
            StepType.BRIDGE, address(adapter), abi.encode(uint64(42), makeAddr("receiver"), address(usdc), amount)
        );
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        address vault = registry.get(workflowId).vault;
        usdc.mint(vault, balance);

        vm.prank(user);
        executor.run(workflowId);

        assertEq(router.lastAmount(), amount);
        assertEq(usdc.balanceOf(vault), balance - amount);
        assertEq(usdc.totalSupply(), balance - amount);
        assertEq(usdc.balanceOf(address(adapter)), 0);
        assertEq(usdc.allowance(vault, address(adapter)), 0);
    }
}
