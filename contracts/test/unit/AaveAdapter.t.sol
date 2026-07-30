// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {AaveAdapter} from "../../src/adapters/AaveAdapter.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {NotExecutor, UnexpectedStepType} from "../../src/interfaces/Errors.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockAavePool} from "../mocks/MockAavePool.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract AaveAdapterTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    MockAavePool internal pool;
    AaveAdapter internal supplyAdapter;
    AaveAdapter internal redeemAdapter;
    MockERC20 internal usdc;
    MockERC20 internal aUsdc;

    address internal admin = makeAddr("admin");
    address internal user = makeAddr("user");

    function setUp() public {
        vm.warp(100_000);
        address predictedRegistry = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        factory = new VaultFactory(predictedRegistry);
        registry = new WorkflowRegistry(address(factory), admin);
        executor = new Executor(address(registry), admin);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        pool = new MockAavePool();
        aUsdc = MockERC20(pool.registerAsset(address(usdc)));
        supplyAdapter = new AaveAdapter(address(registry), address(pool), StepType.SUPPLY);
        redeemAdapter = new AaveAdapter(address(registry), address(pool), StepType.REDEEM);

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.publishExecutor(address(executor));
        registry.setAdapterAllowed(address(supplyAdapter), StepType.SUPPLY, true);
        registry.setAdapterAllowed(address(redeemAdapter), StepType.REDEEM, true);
        vm.stopPrank();

        address userVault = factory.createVault(user);
        uint64 expiry = uint64(block.timestamp + 365 days);
        vm.startPrank(user);
        StrategyVault(userVault).setSession(address(usdc), type(uint128).max, type(uint128).max, expiry);
        StrategyVault(userVault).setSession(address(aUsdc), type(uint128).max, type(uint128).max, expiry);
        vm.stopPrank();
    }

    function _createAndFund(Step[] memory steps, uint256 balance) internal returns (uint256 workflowId, address vault) {
        vm.prank(user);
        workflowId = registry.create(steps);
        vault = registry.get(workflowId).vault;
        usdc.mint(vault, balance);
    }

    function test_SupplyMintsATokensToTheVault() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(400e6)));
        (uint256 workflowId, address vault) = _createAndFund(steps, 1000e6);

        vm.prank(user);
        executor.run(workflowId);

        assertEq(usdc.balanceOf(vault), 600e6);
        assertEq(aUsdc.balanceOf(vault), 400e6);
        assertEq(usdc.balanceOf(address(supplyAdapter)), 0);
        assertEq(aUsdc.balanceOf(address(supplyAdapter)), 0);
        assertEq(usdc.allowance(vault, address(supplyAdapter)), 0);
    }

    function test_SupplyThenRedeemRoundTripsWithNoResidual() public {
        Step[] memory steps = new Step[](2);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), uint256(400e6)));
        steps[1] = Step(StepType.REDEEM, address(redeemAdapter), abi.encode(address(usdc), type(uint256).max));
        (uint256 workflowId, address vault) = _createAndFund(steps, 1000e6);

        vm.prank(user);
        executor.run(workflowId);

        assertEq(usdc.balanceOf(vault), 1000e6);
        assertEq(aUsdc.balanceOf(vault), 0);
        assertEq(usdc.balanceOf(address(supplyAdapter)), 0);
        assertEq(usdc.balanceOf(address(redeemAdapter)), 0);
        assertEq(aUsdc.balanceOf(address(supplyAdapter)), 0);
        assertEq(aUsdc.balanceOf(address(redeemAdapter)), 0);
        assertEq(usdc.allowance(vault, address(supplyAdapter)), 0);
        assertEq(aUsdc.allowance(vault, address(redeemAdapter)), 0);
    }

    function test_MaxSupplyUsesTheWholeVaultBalance() public {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), type(uint256).max));
        (uint256 workflowId, address vault) = _createAndFund(steps, 750e6);

        vm.prank(user);
        executor.run(workflowId);

        assertEq(usdc.balanceOf(vault), 0);
        assertEq(aUsdc.balanceOf(vault), 750e6);
    }

    function test_RevertWhen_ExecuteCalledDirectly() public {
        vm.prank(user);
        vm.expectRevert(NotExecutor.selector);
        supplyAdapter.execute(makeAddr("vault"), abi.encode(address(usdc), uint256(1)));
    }

    function test_RevertWhen_ConstructedWithWrongType() public {
        vm.expectRevert(abi.encodeWithSelector(UnexpectedStepType.selector, StepType.SWAP, StepType.SUPPLY));
        new AaveAdapter(address(registry), address(pool), StepType.SWAP);
    }

    function test_PullPlanReportsAssetForSupplyAndATokenForRedeem() public view {
        bytes memory params = abi.encode(address(usdc), uint256(5e6));
        (address supplyToken, uint256 supplyAmount) = supplyAdapter.pullPlan(params);
        assertEq(supplyToken, address(usdc));
        assertEq(supplyAmount, 5e6);

        (address redeemToken, uint256 redeemAmount) = redeemAdapter.pullPlan(params);
        assertEq(redeemToken, address(aUsdc));
        assertEq(redeemAmount, 5e6);
    }
}
