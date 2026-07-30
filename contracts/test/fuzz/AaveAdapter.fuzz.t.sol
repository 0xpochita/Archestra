// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {AaveAdapter} from "../../src/adapters/AaveAdapter.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockAavePool} from "../mocks/MockAavePool.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract AaveAdapterFuzzTest is Test {
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
        StrategyVault(userVault).setSession(address(usdc), type(uint256).max, type(uint256).max, expiry);
        StrategyVault(userVault).setSession(address(aUsdc), type(uint256).max, type(uint256).max, expiry);
        vm.stopPrank();
    }

    function testFuzz_SupplyThenRedeemReturnsTheSameBalance(uint256 balance, uint256 amount) public {
        balance = bound(balance, 1, type(uint96).max);
        amount = bound(amount, 1, balance);

        Step[] memory steps = new Step[](2);
        steps[0] = Step(StepType.SUPPLY, address(supplyAdapter), abi.encode(address(usdc), amount));
        steps[1] = Step(StepType.REDEEM, address(redeemAdapter), abi.encode(address(usdc), type(uint256).max));
        vm.prank(user);
        uint256 workflowId = registry.create(steps);
        address vault = registry.get(workflowId).vault;
        usdc.mint(vault, balance);

        vm.prank(user);
        executor.run(workflowId);

        assertEq(usdc.balanceOf(vault), balance);
        assertEq(aUsdc.balanceOf(vault), 0);
        assertEq(usdc.balanceOf(address(supplyAdapter)), 0);
        assertEq(usdc.balanceOf(address(redeemAdapter)), 0);
        assertEq(aUsdc.balanceOf(address(redeemAdapter)), 0);
    }
}
