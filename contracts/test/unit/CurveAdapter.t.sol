// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {CurveAdapter} from "../../src/adapters/CurveAdapter.sol";
import {Executor} from "../../src/core/Executor.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {InsufficientOutput, NotExecutor, UnexpectedStepType} from "../../src/interfaces/Errors.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockCurvePool} from "../mocks/MockCurvePool.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockGauge} from "../mocks/MockGauge.sol";

contract CurveAdapterTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    MockCurvePool internal pool;
    MockGauge internal gauge;
    CurveAdapter internal stakeAdapter;
    CurveAdapter internal claimAdapter;
    MockERC20 internal usdc;
    MockERC20 internal weth;
    MockERC20 internal lpToken;
    MockERC20 internal rewardToken;

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
        lpToken = pool.lpToken();
        gauge = new MockGauge(address(lpToken));
        rewardToken = MockERC20(gauge.reward_token());
        stakeAdapter = new CurveAdapter(address(registry), StepType.STAKE);
        claimAdapter = new CurveAdapter(address(registry), StepType.CLAIM);

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.setExecutor(address(executor));
        registry.setAdapterAllowed(address(stakeAdapter), StepType.STAKE, true);
        registry.setAdapterAllowed(address(claimAdapter), StepType.CLAIM, true);
        vm.stopPrank();
    }

    function _stakeParams(uint256 amount, uint256 minLpOut) internal view returns (bytes memory params) {
        return abi.encode(address(pool), address(gauge), amount, minLpOut);
    }

    function _createAndFund(Step[] memory steps, uint256 balance) internal returns (uint256 workflowId, address vault) {
        vm.prank(user);
        workflowId = registry.create(steps);
        vault = registry.get(workflowId).vault;
        usdc.mint(vault, balance);
    }

    function test_StakeAddsLiquidityAndStakesForTheVault() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.STAKE, address(stakeAdapter), _stakeParams(400e6, 400e18));
        (uint256 workflowId, address vault) = _createAndFund(steps, 1000e6);

        vm.prank(user);
        executor.run(workflowId);

        assertEq(usdc.balanceOf(vault), 600e6);
        assertEq(gauge.balanceOf(vault), 400e18);
        assertEq(lpToken.balanceOf(address(stakeAdapter)), 0);
        assertEq(usdc.balanceOf(address(stakeAdapter)), 0);
        assertEq(usdc.allowance(vault, address(stakeAdapter)), 0);
    }

    function test_RevertWhen_MintedBelowMinLpOut() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.STAKE, address(stakeAdapter), _stakeParams(400e6, 401e18));
        (uint256 workflowId,) = _createAndFund(steps, 1000e6);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(InsufficientOutput.selector, 400e18, 401e18));
        executor.run(workflowId);
    }

    function test_RevertWhen_MinLpOutIsZero() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.STAKE, address(stakeAdapter), _stakeParams(400e6, 0));
        (uint256 workflowId,) = _createAndFund(steps, 1000e6);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(InsufficientOutput.selector, 0, 0));
        executor.run(workflowId);
    }

    function test_ClaimSendsRewardsToTheVault() public {
        Step[] memory stakeSteps = new Step[](1);
        stakeSteps[0] = Step(StepType.STAKE, address(stakeAdapter), _stakeParams(400e6, 1));
        (uint256 stakeId, address vault) = _createAndFund(stakeSteps, 1000e6);
        vm.prank(user);
        executor.run(stakeId);

        gauge.setRewardPerSecond(1e18);
        vm.warp(block.timestamp + 60);

        Step[] memory claimSteps = new Step[](1);
        claimSteps[0] = Step(StepType.CLAIM, address(claimAdapter), abi.encode(address(gauge), uint256(1)));
        vm.prank(user);
        uint256 claimId = registry.create(claimSteps);

        vm.prank(user);
        executor.run(claimId);

        assertEq(rewardToken.balanceOf(vault), 60e18);
        assertEq(rewardToken.balanceOf(address(claimAdapter)), 0);
        assertEq(gauge.claimable_reward(vault), 0);
    }

    function test_RevertWhen_NothingAccrued() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.CLAIM, address(claimAdapter), abi.encode(address(gauge), uint256(1)));
        vm.prank(user);
        uint256 workflowId = registry.create(steps);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(InsufficientOutput.selector, 0, 1));
        executor.run(workflowId);
    }

    function test_RevertWhen_MinValueOutIsZero() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.CLAIM, address(claimAdapter), abi.encode(address(gauge), uint256(0)));
        vm.prank(user);
        uint256 workflowId = registry.create(steps);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(InsufficientOutput.selector, 0, 0));
        executor.run(workflowId);
    }

    function test_RevertWhen_ExecuteCalledDirectly() public {
        vm.prank(user);
        vm.expectRevert(NotExecutor.selector);
        stakeAdapter.execute(makeAddr("vault"), _stakeParams(1, 1));
    }

    function test_RevertWhen_ConstructedWithWrongType() public {
        vm.expectRevert(abi.encodeWithSelector(UnexpectedStepType.selector, StepType.SWAP, StepType.STAKE));
        new CurveAdapter(address(registry), StepType.SWAP);
    }
}
