// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {SessionCapExceeded} from "../../src/interfaces/Errors.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockRegistry} from "../mocks/MockRegistry.sol";

contract StrategyVaultFuzzTest is Test {
    MockRegistry internal registry;
    VaultFactory internal factory;
    StrategyVault internal vault;
    MockERC20 internal usdc;

    address internal owner = makeAddr("owner");
    address internal executor = makeAddr("executor");
    address internal adapter = makeAddr("adapter");

    function setUp() public {
        vm.warp(100_000);
        registry = new MockRegistry();
        registry.setExecutor(executor);
        factory = new VaultFactory(address(registry));
        vault = StrategyVault(factory.createVault(owner));
        usdc = new MockERC20("USD Coin", "USDC", 6);

        vm.prank(owner);
        vault.setSession(address(usdc), type(uint256).max, type(uint256).max, uint64(block.timestamp + 365 days));
    }

    function testFuzz_DepositThenWithdrawRoundTrips(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        usdc.mint(owner, amount);
        vm.startPrank(owner);
        usdc.approve(address(vault), amount);
        vault.deposit(address(usdc), amount);
        vault.withdraw(address(usdc), amount, owner);
        vm.stopPrank();
        assertEq(usdc.balanceOf(owner), amount);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    function testFuzz_ApproveAdapterSetsExactAllowance(uint256 amount) public {
        vm.prank(executor);
        vault.approveAdapter(address(usdc), adapter, amount);
        assertEq(usdc.allowance(address(vault), adapter), amount);
        assertEq(vault.sessionSpentToday(address(usdc)), amount);
    }

    function testFuzz_SessionCapIsNeverExceeded(uint256 maxPerRun, uint256 maxPerDay, uint256 amount) public {
        maxPerRun = bound(maxPerRun, 1, type(uint128).max);
        maxPerDay = bound(maxPerDay, 1, type(uint128).max);
        amount = bound(amount, 1, type(uint128).max);

        vm.prank(owner);
        vault.setSession(address(usdc), maxPerRun, maxPerDay, uint64(block.timestamp + 1 days));

        uint256 allowed = maxPerDay < maxPerRun ? maxPerDay : maxPerRun;
        vm.prank(executor);
        if (amount > allowed) {
            vm.expectRevert(abi.encodeWithSelector(SessionCapExceeded.selector, address(usdc), amount, allowed));
            vault.approveAdapter(address(usdc), adapter, amount);
            assertEq(vault.sessionSpentToday(address(usdc)), 0);
        } else {
            vault.approveAdapter(address(usdc), adapter, amount);
            assertLe(vault.sessionSpentToday(address(usdc)), maxPerDay);
        }
    }
}
