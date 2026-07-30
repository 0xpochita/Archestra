// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {CurveAdapter} from "../../src/adapters/CurveAdapter.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockCurvePool} from "../mocks/MockCurvePool.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockGauge} from "../mocks/MockGauge.sol";

contract CurveAdapterFuzzTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    MockCurvePool internal pool;
    MockGauge internal gauge;
    CurveAdapter internal stakeAdapter;
    MockERC20 internal usdc;
    MockERC20 internal weth;

    address internal admin = makeAddr("admin");
    address internal user = makeAddr("user");

    function setUp() public {
        vm.warp(100_000);
        address predictedRegistry = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        factory = new VaultFactory(predictedRegistry);
        registry = new WorkflowRegistry(address(factory), admin);
        executor = new Executor(address(registry), admin);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        pool = new MockCurvePool(address(usdc), address(weth), 1e12);
        gauge = new MockGauge(address(pool.lpToken()));
        stakeAdapter = new CurveAdapter(address(registry), StepType.STAKE);

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.publishExecutor(address(executor));
        registry.setAdapterAllowed(address(stakeAdapter), StepType.STAKE, true);
        vm.stopPrank();

        address userVault = factory.createVault(user);
        vm.prank(user);
        StrategyVault(userVault)
            .setSession(address(usdc), type(uint256).max, type(uint256).max, uint64(block.timestamp + 365 days));
    }

    function testFuzz_StakedPositionMatchesTheDeposit(uint256 balance, uint256 amount) public {
        balance = bound(balance, 1, type(uint96).max);
        amount = bound(amount, 1, balance);

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.STAKE, address(stakeAdapter), abi.encode(address(pool), address(gauge), amount, 1));
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        address vault = registry.get(workflowId).vault;
        usdc.mint(vault, balance);

        vm.prank(user);
        executor.run(workflowId);

        assertEq(gauge.balanceOf(vault), amount * 1e12);
        assertEq(usdc.balanceOf(vault), balance - amount);
        assertEq(usdc.balanceOf(address(stakeAdapter)), 0);
        assertEq(pool.lpToken().balanceOf(address(stakeAdapter)), 0);
        assertEq(usdc.allowance(vault, address(stakeAdapter)), 0);
    }
}
