// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {AaveAdapter} from "../../src/adapters/AaveAdapter.sol";
import {CurveAdapter} from "../../src/adapters/CurveAdapter.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {StepType} from "../../src/interfaces/Types.sol";
import {MockAavePool} from "../mocks/MockAavePool.sol";
import {MockCurvePool} from "../mocks/MockCurvePool.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockGauge} from "../mocks/MockGauge.sol";
import {Handler} from "./Handler.sol";

/// The seven system invariants from agents/spec/testing.md section 4, driven by a
/// handler that deposits, withdraws, runs, pauses, warps and swaps the executor.
contract InvariantsTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    MockAavePool internal aavePool;
    MockCurvePool internal curvePool;
    MockGauge internal gauge;
    MockERC20 internal usdc;
    MockERC20 internal aUsdc;
    MockERC20 internal lpToken;
    MockERC20 internal rewardToken;
    AaveAdapter internal supplyAdapter;
    AaveAdapter internal redeemAdapter;
    CurveAdapter internal stakeAdapter;
    CurveAdapter internal claimAdapter;
    Handler internal handler;

    address internal admin = makeAddr("admin");
    address internal pauser = makeAddr("pauser");

    function setUp() public {
        vm.warp(100_000);
        address predictedRegistry = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        factory = new VaultFactory(predictedRegistry);
        registry = new WorkflowRegistry(address(factory), admin);
        executor = new Executor(address(registry), admin);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        aavePool = new MockAavePool();
        aUsdc = MockERC20(aavePool.registerAsset(address(usdc)));
        curvePool = new MockCurvePool(address(usdc), address(new MockERC20("Wrapped Ether", "WETH", 18)), 1e12);
        lpToken = curvePool.lpToken();
        gauge = new MockGauge(address(lpToken));
        rewardToken = MockERC20(gauge.reward_token());
        gauge.setRewardPerSecond(1e15);

        supplyAdapter = new AaveAdapter(address(registry), address(aavePool), StepType.SUPPLY);
        redeemAdapter = new AaveAdapter(address(registry), address(aavePool), StepType.REDEEM);
        stakeAdapter = new CurveAdapter(address(registry), StepType.STAKE);
        claimAdapter = new CurveAdapter(address(registry), StepType.CLAIM);

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.setExecutor(address(executor));
        executor.grantRole(executor.PAUSER_ROLE(), pauser);
        registry.setAdapterAllowed(address(supplyAdapter), StepType.SUPPLY, true);
        registry.setAdapterAllowed(address(redeemAdapter), StepType.REDEEM, true);
        registry.setAdapterAllowed(address(stakeAdapter), StepType.STAKE, true);
        registry.setAdapterAllowed(address(claimAdapter), StepType.CLAIM, true);
        vm.stopPrank();

        handler = new Handler(
            registry,
            factory,
            executor,
            usdc,
            curvePool,
            gauge,
            supplyAdapter,
            redeemAdapter,
            stakeAdapter,
            claimAdapter,
            admin,
            pauser
        );
        targetContract(address(handler));
    }

    function _tokens() private view returns (address[5] memory tokens) {
        return [address(usdc), address(aUsdc), address(lpToken), address(rewardToken), address(0)];
    }

    /// INV-1: the executor, past or present, holds zero balance of every tracked token.
    function invariant_ExecutorsHoldNothing() public view {
        address[5] memory tokens = _tokens();
        for (uint256 e = 0; e < handler.executorCount(); e++) {
            address executorAddress = handler.executors(e);
            for (uint256 t = 0; t < tokens.length; t++) {
                if (tokens[t] == address(0)) continue;
                assertEq(MockERC20(tokens[t]).balanceOf(executorAddress), 0);
            }
        }
    }

    /// INV-2: no vault allowance to any adapter is non zero outside a run.
    function invariant_NoAllowanceOutsideARun() public view {
        address[4] memory adapters =
            [address(supplyAdapter), address(redeemAdapter), address(stakeAdapter), address(claimAdapter)];
        address[5] memory tokens = _tokens();
        for (uint256 i = 0; i < 3; i++) {
            address vault = factory.vaultOf(handler.actors(i));
            if (vault == address(0)) continue;
            for (uint256 a = 0; a < adapters.length; a++) {
                for (uint256 t = 0; t < tokens.length; t++) {
                    if (tokens[t] == address(0)) continue;
                    assertEq(MockERC20(tokens[t]).allowance(vault, adapters[a]), 0);
                }
            }
        }
    }

    /// INV-3: vault value never drops below net user deposits from any system operation.
    function invariant_VaultValueNeverLeaks() public view {
        for (uint256 i = 0; i < 3; i++) {
            address vault = factory.vaultOf(handler.actors(i));
            if (vault == address(0)) continue;
            uint256 value = usdc.balanceOf(vault) + aUsdc.balanceOf(vault) + gauge.balanceOf(vault) / 1e12;
            uint256 net = handler.ghostDeposited(vault) - handler.ghostWithdrawn(vault);
            assertGe(value, net);
        }
    }

    /// INV-4: a paused system executes zero steps.
    function invariant_PausedSystemExecutesNothing() public view {
        assertFalse(handler.pausedRunSucceeded());
    }

    /// INV-5: StepExecuted positions are unique and strictly increasing inside one run.
    function invariant_PositionsStrictlyIncrease() public view {
        assertFalse(handler.positionOrderBroken());
    }

    /// INV-6: a run never executes more steps than the workflow stores.
    function invariant_NeverMoreStepsThanStored() public view {
        assertFalse(handler.stepCountExceeded());
    }

    /// INV-7: the owner can always withdraw the whole usdc balance, in every state.
    function invariant_OwnerCanAlwaysWithdraw() public {
        for (uint256 i = 0; i < 3; i++) {
            address actor = handler.actors(i);
            address vault = factory.vaultOf(actor);
            if (vault == address(0)) continue;
            uint256 balance = usdc.balanceOf(vault);
            uint256 snapshot = vm.snapshotState();
            vm.prank(actor);
            StrategyVault(vault).withdraw(address(usdc), balance, actor);
            vm.revertToState(snapshot);
        }
    }
}
