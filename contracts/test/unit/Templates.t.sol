// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {AaveAdapter} from "../../src/adapters/AaveAdapter.sol";
import {CcipAdapter} from "../../src/adapters/CcipAdapter.sol";
import {CurveAdapter} from "../../src/adapters/CurveAdapter.sol";
import {UniswapAdapter} from "../../src/adapters/UniswapAdapter.sol";
import {Executor} from "../../src/core/Executor.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {AutomationTrigger} from "../../src/modules/AutomationTrigger.sol";
import {GuardModule} from "../../src/modules/GuardModule.sol";
import {MockAavePool} from "../mocks/MockAavePool.sol";
import {MockAggregator} from "../mocks/MockAggregator.sol";
import {MockCcipRouter} from "../mocks/MockCcipRouter.sol";
import {MockCurvePool} from "../mocks/MockCurvePool.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockGauge} from "../mocks/MockGauge.sol";
import {MockSwapRouter} from "../mocks/MockSwapRouter.sol";

/// One end to end test per seeded strategy template from the backend spec.
contract TemplatesTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    AutomationTrigger internal trigger;
    GuardModule internal guard;
    AaveAdapter internal supplyAdapter;
    AaveAdapter internal redeemAdapter;
    UniswapAdapter internal swapAdapter;
    CurveAdapter internal stakeAdapter;
    CurveAdapter internal claimAdapter;
    CcipAdapter internal bridgeAdapter;

    MockAavePool internal aavePool;
    MockSwapRouter internal swapRouter;
    MockCurvePool internal curvePool;
    MockGauge internal gauge;
    MockCcipRouter internal ccipRouter;
    MockAggregator internal feed;

    MockERC20 internal usdc;
    MockERC20 internal weth;
    MockERC20 internal aUsdc;
    MockERC20 internal lpToken;
    MockERC20 internal rewardToken;

    address internal admin = makeAddr("admin");
    address internal user = makeAddr("user");
    address internal receiver = makeAddr("receiver");

    function setUp() public {
        vm.warp(100_000);
        address predictedRegistry = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        factory = new VaultFactory(predictedRegistry);
        registry = new WorkflowRegistry(address(factory), admin);
        executor = new Executor(address(registry), admin);
        trigger = new AutomationTrigger(address(registry));
        guard = new GuardModule();

        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        aavePool = new MockAavePool();
        aUsdc = MockERC20(aavePool.registerAsset(address(usdc)));
        swapRouter = new MockSwapRouter();
        curvePool = new MockCurvePool(address(usdc), address(weth), 1e12);
        lpToken = curvePool.lpToken();
        gauge = new MockGauge(address(lpToken));
        rewardToken = MockERC20(gauge.reward_token());
        ccipRouter = new MockCcipRouter();
        feed = new MockAggregator(8, 2000e8);

        supplyAdapter = new AaveAdapter(address(registry), address(aavePool), StepType.SUPPLY);
        redeemAdapter = new AaveAdapter(address(registry), address(aavePool), StepType.REDEEM);
        swapAdapter = new UniswapAdapter(address(registry), address(swapRouter));
        stakeAdapter = new CurveAdapter(address(registry), StepType.STAKE);
        claimAdapter = new CurveAdapter(address(registry), StepType.CLAIM);
        bridgeAdapter = new CcipAdapter(address(registry), address(ccipRouter));
        vm.deal(address(bridgeAdapter), 1 ether);
        ccipRouter.setFee(0.01 ether);

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.setExecutor(address(executor));
        registry.setAdapterAllowed(address(trigger), StepType.TRIGGER, true);
        registry.setAdapterAllowed(address(executor), StepType.APPROVE, true);
        registry.setAdapterAllowed(address(executor), StepType.NOTIFY, true);
        registry.setAdapterAllowed(address(guard), StepType.GUARD, true);
        registry.setAdapterAllowed(address(supplyAdapter), StepType.SUPPLY, true);
        registry.setAdapterAllowed(address(redeemAdapter), StepType.REDEEM, true);
        registry.setAdapterAllowed(address(swapAdapter), StepType.SWAP, true);
        registry.setAdapterAllowed(address(stakeAdapter), StepType.STAKE, true);
        registry.setAdapterAllowed(address(claimAdapter), StepType.CLAIM, true);
        registry.setAdapterAllowed(address(bridgeAdapter), StepType.BRIDGE, true);
        vm.stopPrank();
    }

    function _run(Step[] memory steps, uint256 fundUsdc) internal returns (address vault) {
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        vault = registry.get(workflowId).vault;
        if (fundUsdc > 0) usdc.mint(vault, fundUsdc);
        vm.prank(user);
        executor.run(workflowId);
    }

    function _trigger() internal view returns (Step memory step) {
        return Step(StepType.TRIGGER, address(trigger), abi.encode(uint64(86400), uint64(0)));
    }

    function _approve(address token, address spender, uint256 amount) internal view returns (Step memory step) {
        return Step(StepType.APPROVE, address(executor), abi.encode(token, spender, amount));
    }

    function _supply(uint256 amount) internal view returns (Step memory step) {
        return Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), amount));
    }

    function _redeem(uint256 amount) internal view returns (Step memory step) {
        return Step(StepType.REDEEM, address(redeemAdapter), abi.encode(address(usdc), amount));
    }

    function _swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut)
        internal
        view
        returns (Step memory step)
    {
        return Step(
            StepType.SWAP,
            address(swapAdapter),
            abi.encode(tokenIn, tokenOut, amountIn, minOut, uint24(500), uint64(block.timestamp + 3600))
        );
    }

    function _stake(uint256 amount, uint256 minLpOut) internal view returns (Step memory step) {
        return
            Step(
                StepType.STAKE, address(stakeAdapter), abi.encode(address(curvePool), address(gauge), amount, minLpOut)
            );
    }

    function _claim(uint256 minValueOut) internal view returns (Step memory step) {
        return Step(StepType.CLAIM, address(claimAdapter), abi.encode(address(gauge), minValueOut));
    }

    function _bridge(uint256 amount) internal view returns (Step memory step) {
        return Step(StepType.BRIDGE, address(bridgeAdapter), abi.encode(uint64(1234), receiver, address(usdc), amount));
    }

    function _guardContinueWhenLow() internal view returns (Step memory step) {
        return Step(StepType.GUARD, address(guard), abi.encode(address(feed), int256(1500e8), uint8(1), uint64(3600)));
    }

    function _notify() internal view returns (Step memory step) {
        return Step(StepType.NOTIFY, address(executor), abi.encode(bytes32("defi-ops"), bytes32("template")));
    }

    function _positionWithAccruedRewards() internal returns (address vault) {
        Step[] memory steps = new Step[](2);
        steps[0] = _supply(500e6);
        steps[1] = _stake(300e6, 1);
        vault = _run(steps, 1000e6);
        gauge.setRewardPerSecond(1e18);
        vm.warp(block.timestamp + 60);
    }

    function test_StableAutoCompound() public {
        address vault = _positionWithAccruedRewards();

        Step[] memory steps = new Step[](4);
        steps[0] = _approve(address(usdc), address(supplyAdapter), 100e6);
        steps[1] = _supply(100e6);
        steps[2] = _stake(type(uint256).max, 1);
        steps[3] = _claim(1);
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        vm.prank(user);
        executor.run(workflowId);

        assertEq(usdc.balanceOf(vault), 0);
        assertEq(aUsdc.balanceOf(vault), 600e6);
        assertEq(gauge.balanceOf(vault), 400e18);
        assertEq(rewardToken.balanceOf(vault), 60e18);
    }

    function test_WeeklyDca() public {
        swapRouter.setRate(5e26);

        Step[] memory steps = new Step[](3);
        steps[0] = _trigger();
        steps[1] = _swap(address(usdc), address(weth), 1000e6, 0.4e18);
        steps[2] = _notify();
        address vault = _run(steps, 1000e6);

        assertEq(usdc.balanceOf(vault), 0);
        assertEq(weth.balanceOf(vault), 0.5e18);
    }

    function test_CrossChainYield() public {
        Step[] memory steps = new Step[](4);
        steps[0] = _bridge(200e6);
        steps[1] = _approve(address(usdc), address(supplyAdapter), 500e6);
        steps[2] = _supply(500e6);
        steps[3] = _stake(type(uint256).max, 1);
        address vault = _run(steps, 1000e6);

        assertEq(ccipRouter.lastAmount(), 200e6);
        assertEq(aUsdc.balanceOf(vault), 500e6);
        assertEq(gauge.balanceOf(vault), 300e18);
        assertEq(usdc.balanceOf(vault), 0);
    }

    function test_GuardedExit() public {
        address vault = _positionWithAccruedRewards();
        feed.setAnswer(1000e8);

        Step[] memory steps = new Step[](4);
        steps[0] = _guardContinueWhenLow();
        steps[1] = _claim(1);
        steps[2] = _redeem(type(uint256).max);
        steps[3] = _notify();
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        vm.prank(user);
        executor.run(workflowId);

        assertEq(aUsdc.balanceOf(vault), 0);
        assertEq(usdc.balanceOf(vault), 700e6);
        assertEq(rewardToken.balanceOf(vault), 60e18);
    }

    function test_GuardedExitStopsGracefullyOnAHealthyPool() public {
        _positionWithAccruedRewards();

        Step[] memory steps = new Step[](4);
        steps[0] = _guardContinueWhenLow();
        steps[1] = _claim(1);
        steps[2] = _redeem(type(uint256).max);
        steps[3] = _notify();
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        address vault = registry.get(workflowId).vault;
        uint256 aBefore = aUsdc.balanceOf(vault);

        vm.prank(user);
        executor.run(workflowId);

        assertEq(aUsdc.balanceOf(vault), aBefore);
        assertEq(rewardToken.balanceOf(vault), 0);
    }

    function test_IdleCashSweep() public {
        Step[] memory steps = new Step[](3);
        steps[0] = _trigger();
        steps[1] = _approve(address(usdc), address(supplyAdapter), 800e6);
        steps[2] = _supply(type(uint256).max);
        address vault = _run(steps, 800e6);

        assertEq(usdc.balanceOf(vault), 0);
        assertEq(aUsdc.balanceOf(vault), 800e6);
    }

    function test_RewardCompoundingLoop() public {
        address vault = _positionWithAccruedRewards();
        swapRouter.setRate(1e6);

        Step[] memory steps = new Step[](4);
        steps[0] = _claim(1);
        steps[1] = _swap(address(rewardToken), address(usdc), type(uint256).max, 1);
        steps[2] = _supply(30e6);
        steps[3] = _stake(type(uint256).max, 1);
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        vm.prank(user);
        executor.run(workflowId);

        assertEq(rewardToken.balanceOf(vault), 0);
        assertEq(aUsdc.balanceOf(vault), 530e6);
        assertEq(gauge.balanceOf(vault), 530e18);
        assertEq(usdc.balanceOf(vault), 0);
    }

    function test_RiskOffUnwind() public {
        Step[] memory positionSteps = new Step[](1);
        positionSteps[0] = _supply(600e6);
        address vault = _run(positionSteps, 600e6);
        feed.setAnswer(1000e8);

        Step[] memory steps = new Step[](4);
        steps[0] = _guardContinueWhenLow();
        steps[1] = _redeem(type(uint256).max);
        steps[2] = _bridge(type(uint256).max);
        steps[3] = _notify();
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        vm.prank(user);
        executor.run(workflowId);

        assertEq(aUsdc.balanceOf(vault), 0);
        assertEq(usdc.balanceOf(vault), 0);
        assertEq(ccipRouter.lastAmount(), 600e6);
    }

    function test_LpBootstrap() public {
        swapRouter.setRate(5e26);

        Step[] memory steps = new Step[](3);
        steps[0] = _approve(address(usdc), address(swapAdapter), 400e6);
        steps[1] = _swap(address(usdc), address(weth), 400e6, 0.1e18);
        steps[2] = _stake(type(uint256).max, 1);
        address vault = _run(steps, 1000e6);

        assertEq(weth.balanceOf(vault), 0.2e18);
        assertEq(gauge.balanceOf(vault), 600e18);
        assertEq(usdc.balanceOf(vault), 0);
    }
}
