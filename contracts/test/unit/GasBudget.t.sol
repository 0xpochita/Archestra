// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {AaveAdapter} from "../../src/adapters/AaveAdapter.sol";
import {CurveAdapter} from "../../src/adapters/CurveAdapter.sol";
import {UniswapAdapter} from "../../src/adapters/UniswapAdapter.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {AutomationTrigger} from "../../src/modules/AutomationTrigger.sol";
import {MockAavePool} from "../mocks/MockAavePool.sol";
import {MockCurvePool} from "../mocks/MockCurvePool.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockGauge} from "../mocks/MockGauge.sol";
import {MockSwapRouter} from "../mocks/MockSwapRouter.sol";

/// The studio's demo strategy must run inside the 900k gas budget from the spec.
contract GasBudgetTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    AutomationTrigger internal trigger;
    AaveAdapter internal supplyAdapter;
    UniswapAdapter internal swapAdapter;
    CurveAdapter internal stakeAdapter;
    CurveAdapter internal claimAdapter;

    MockAavePool internal aavePool;
    MockSwapRouter internal swapRouter;
    MockCurvePool internal curvePool;
    MockGauge internal gauge;
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
        trigger = new AutomationTrigger(address(registry));

        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        aavePool = new MockAavePool();
        aavePool.registerAsset(address(usdc));
        swapRouter = new MockSwapRouter();
        swapRouter.setRate(5e26);
        curvePool = new MockCurvePool(address(usdc), address(weth), 1e12);
        gauge = new MockGauge(address(curvePool.lpToken()));

        supplyAdapter = new AaveAdapter(address(registry), address(aavePool), StepType.SUPPLY);
        swapAdapter = new UniswapAdapter(address(registry), address(swapRouter));
        stakeAdapter = new CurveAdapter(address(registry), StepType.STAKE);
        claimAdapter = new CurveAdapter(address(registry), StepType.CLAIM);

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.publishExecutor(address(executor));
        registry.setAdapterAllowed(address(trigger), StepType.TRIGGER, true);
        registry.setAdapterAllowed(address(executor), StepType.APPROVE, true);
        registry.setAdapterAllowed(address(supplyAdapter), StepType.SUPPLY, true);
        registry.setAdapterAllowed(address(swapAdapter), StepType.SWAP, true);
        registry.setAdapterAllowed(address(stakeAdapter), StepType.STAKE, true);
        registry.setAdapterAllowed(address(claimAdapter), StepType.CLAIM, true);
        vm.stopPrank();

        address userVault = factory.createVault(user);
        uint64 expiry = uint64(block.timestamp + 365 days);
        vm.startPrank(user);
        StrategyVault(userVault).setSession(address(usdc), type(uint128).max, type(uint128).max, expiry);
        StrategyVault(userVault).setSession(address(weth), type(uint128).max, type(uint128).max, expiry);
        vm.stopPrank();
    }

    function test_DemoStrategyRunsUnder900kGas() public {
        Step[] memory steps = new Step[](6);
        steps[0] = Step(StepType.TRIGGER, address(trigger), abi.encode(uint64(86400), uint64(0)));
        steps[1] = Step(
            StepType.APPROVE, address(executor), abi.encode(address(usdc), address(supplyAdapter), uint256(500e6))
        );
        steps[2] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(500e6)));
        steps[3] = Step(
            StepType.SWAP,
            address(swapAdapter),
            abi.encode(
                address(usdc),
                address(weth),
                uint256(200e6),
                uint256(0.05e18),
                uint24(500),
                uint64(block.timestamp + 3600)
            )
        );
        steps[4] = Step(
            StepType.STAKE,
            address(stakeAdapter),
            abi.encode(address(curvePool), address(gauge), uint256(250e6), uint256(1))
        );
        steps[5] = Step(StepType.CLAIM, address(claimAdapter), abi.encode(address(gauge), uint256(1)));

        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        address vault = registry.get(workflowId).vault;
        usdc.mint(vault, 1000e6);

        Step[] memory positionSteps = new Step[](1);
        positionSteps[0] = Step(
            StepType.STAKE,
            address(stakeAdapter),
            abi.encode(address(curvePool), address(gauge), uint256(1e6), uint256(1))
        );
        vm.prank(user);
        uint256 positionId = registry.create(positionSteps);
        vm.prank(user);
        executor.run(positionId);
        gauge.setRewardPerSecond(1e15);
        vm.warp(block.timestamp + 3600);

        vm.prank(user);
        uint256 gasBefore = gasleft();
        executor.run(workflowId);
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("demo strategy gas", gasUsed);
        assertLt(gasUsed, 900_000);
    }
}
