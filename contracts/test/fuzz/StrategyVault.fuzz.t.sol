// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
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
        registry = new MockRegistry();
        registry.setExecutor(executor);
        factory = new VaultFactory(address(registry));
        vault = StrategyVault(factory.createVault(owner));
        usdc = new MockERC20("USD Coin", "USDC", 6);
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
    }
}
