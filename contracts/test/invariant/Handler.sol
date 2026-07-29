// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {Vm} from "forge-std/Vm.sol";
import {AaveAdapter} from "../../src/adapters/AaveAdapter.sol";
import {CurveAdapter} from "../../src/adapters/CurveAdapter.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {IExecutor} from "../../src/interfaces/IExecutor.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockCurvePool} from "../mocks/MockCurvePool.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockGauge} from "../mocks/MockGauge.sol";

contract Handler is CommonBase, StdCheats, StdUtils {
    bytes32 private constant STEP_EXECUTED_SIG =
        keccak256("StepExecuted(bytes32,uint256,uint8,address,address,uint256)");
    bytes32 private constant RUN_COMPLETED_SIG = keccak256("RunCompleted(bytes32,bool,uint256)");

    WorkflowRegistry public immutable registry;
    VaultFactory public immutable factory;
    MockERC20 public immutable usdc;
    MockCurvePool public immutable curvePool;
    MockGauge public immutable gauge;
    AaveAdapter public immutable supplyAdapter;
    AaveAdapter public immutable redeemAdapter;
    CurveAdapter public immutable stakeAdapter;
    CurveAdapter public immutable claimAdapter;

    address public immutable admin;
    address public immutable pauser;

    address[3] public actors;
    address[] public executors;
    mapping(address actor => mapping(StepType stepType => uint256 workflowId)) public workflowOf;
    mapping(address vault => uint256 amount) public ghostDeposited;
    mapping(address vault => uint256 amount) public ghostWithdrawn;

    bool public pausedRunSucceeded;
    bool public positionOrderBroken;
    bool public stepCountExceeded;

    constructor(
        WorkflowRegistry registry_,
        VaultFactory factory_,
        Executor executor_,
        MockERC20 usdc_,
        MockCurvePool curvePool_,
        MockGauge gauge_,
        AaveAdapter supplyAdapter_,
        AaveAdapter redeemAdapter_,
        CurveAdapter stakeAdapter_,
        CurveAdapter claimAdapter_,
        address admin_,
        address pauser_
    ) {
        registry = registry_;
        factory = factory_;
        usdc = usdc_;
        curvePool = curvePool_;
        gauge = gauge_;
        supplyAdapter = supplyAdapter_;
        redeemAdapter = redeemAdapter_;
        stakeAdapter = stakeAdapter_;
        claimAdapter = claimAdapter_;
        admin = admin_;
        pauser = pauser_;
        executors.push(address(executor_));
        actors[0] = makeAddr("actor0");
        actors[1] = makeAddr("actor1");
        actors[2] = makeAddr("actor2");
    }

    function executorCount() external view returns (uint256 count) {
        return executors.length;
    }

    function currentExecutor() public view returns (address executorAddress) {
        return registry.executor();
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address actor = actors[bound(actorSeed, 0, 2)];
        amount = bound(amount, 1, 1_000_000e6);
        address vault = factory.createVault(actor);
        usdc.mint(actor, amount);
        vm.startPrank(actor);
        usdc.approve(vault, amount);
        StrategyVault(vault).deposit(address(usdc), amount);
        vm.stopPrank();
        ghostDeposited[vault] += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = actors[bound(actorSeed, 0, 2)];
        address vault = factory.vaultOf(actor);
        if (vault == address(0)) return;
        uint256 balance = usdc.balanceOf(vault);
        if (balance == 0) return;
        amount = bound(amount, 1, balance);
        vm.prank(actor);
        StrategyVault(vault).withdraw(address(usdc), amount, actor);
        ghostWithdrawn[vault] += amount;
    }

    function warp(uint256 secondsForward) external {
        vm.warp(block.timestamp + bound(secondsForward, 1, 7 days));
    }

    function pause() external {
        vm.prank(pauser);
        Executor(currentExecutor()).pause();
    }

    function unpause() external {
        vm.prank(pauser);
        Executor(currentExecutor()).unpause();
    }

    function runSupplyMax(uint256 actorSeed) external {
        _runSingleStep(actorSeed, StepType.SUPPLY);
    }

    function runRedeemMax(uint256 actorSeed) external {
        _runSingleStep(actorSeed, StepType.REDEEM);
    }

    function runStakeMax(uint256 actorSeed) external {
        _runSingleStep(actorSeed, StepType.STAKE);
    }

    function runClaim(uint256 actorSeed) external {
        _runSingleStep(actorSeed, StepType.CLAIM);
    }

    function swapExecutor() external {
        Executor next = new Executor(address(registry), admin);
        vm.startPrank(admin);
        next.grantRole(next.PAUSER_ROLE(), pauser);
        registry.setExecutor(address(next));
        vm.stopPrank();
        executors.push(address(next));
    }

    function _runSingleStep(uint256 actorSeed, StepType stepType) private {
        address actor = actors[bound(actorSeed, 0, 2)];
        uint256 workflowId = _workflow(actor, stepType);
        bool wasPaused = Executor(currentExecutor()).paused();
        uint256 storedSteps = registry.get(workflowId).steps.length;

        vm.recordLogs();
        vm.prank(actor);
        try IExecutor(currentExecutor()).run(workflowId) {
            if (wasPaused) pausedRunSucceeded = true;
            _checkRunLogs(storedSteps);
        } catch {}
    }

    function _checkRunLogs(uint256 storedSteps) private {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 executedCount = 0;
        int256 lastPosition = -1;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == STEP_EXECUTED_SIG) {
                int256 position = int256(uint256(logs[i].topics[2]));
                if (position <= lastPosition) positionOrderBroken = true;
                lastPosition = position;
                executedCount++;
            }
            if (logs[i].topics[0] == RUN_COMPLETED_SIG) {
                (, uint256 stepsExecuted) = abi.decode(logs[i].data, (bool, uint256));
                if (stepsExecuted > storedSteps || executedCount > storedSteps) stepCountExceeded = true;
            }
        }
    }

    function _workflow(address actor, StepType stepType) private returns (uint256 workflowId) {
        workflowId = workflowOf[actor][stepType];
        if (workflowId != 0) return workflowId;

        Step[] memory steps = new Step[](1);
        if (stepType == StepType.SUPPLY) {
            steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), type(uint256).max));
        } else if (stepType == StepType.REDEEM) {
            steps[0] = Step(StepType.REDEEM, address(redeemAdapter), abi.encode(address(usdc), type(uint256).max));
        } else if (stepType == StepType.STAKE) {
            steps[0] = Step(
                StepType.STAKE,
                address(stakeAdapter),
                abi.encode(address(curvePool), address(gauge), type(uint256).max, 1)
            );
        } else {
            steps[0] = Step(StepType.CLAIM, address(claimAdapter), abi.encode(address(gauge), uint256(1)));
        }
        vm.prank(actor);
        workflowId = registry.create(steps);
        workflowOf[actor][stepType] = workflowId;
    }
}
