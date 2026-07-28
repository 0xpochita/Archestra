// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Test} from "forge-std/Test.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {NotExecutor, NotOwner} from "../../src/interfaces/Errors.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockRegistry} from "../mocks/MockRegistry.sol";

contract StrategyVaultTest is Test {
    MockRegistry internal registry;
    VaultFactory internal factory;
    StrategyVault internal vault;
    MockERC20 internal usdc;

    address internal owner = makeAddr("owner");
    address internal executor = makeAddr("executor");
    address internal adapter = makeAddr("adapter");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        registry = new MockRegistry();
        registry.setExecutor(executor);
        factory = new VaultFactory(address(registry));
        vault = StrategyVault(factory.createVault(owner));
        usdc = new MockERC20("USD Coin", "USDC", 6);
    }

    function test_DepositPullsTokensFromCaller() public {
        usdc.mint(owner, 1000e6);
        vm.startPrank(owner);
        usdc.approve(address(vault), 400e6);
        vault.deposit(address(usdc), 400e6);
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(vault)), 400e6);
        assertEq(usdc.balanceOf(owner), 600e6);
    }

    function test_WithdrawSendsTokensToRecipient() public {
        usdc.mint(address(vault), 250e6);
        vm.prank(owner);
        vault.withdraw(address(usdc), 100e6, stranger);
        assertEq(usdc.balanceOf(stranger), 100e6);
        assertEq(usdc.balanceOf(address(vault)), 150e6);
    }

    function test_RevertWhen_WithdrawByNonOwner() public {
        usdc.mint(address(vault), 1e6);
        vm.prank(stranger);
        vm.expectRevert(NotOwner.selector);
        vault.withdraw(address(usdc), 1e6, stranger);
    }

    function test_ApproveAdapterSetsExactAllowance() public {
        vm.prank(executor);
        vault.approveAdapter(address(usdc), adapter, 123e6);
        assertEq(usdc.allowance(address(vault), adapter), 123e6);
    }

    function test_RevertWhen_ApproveAdapterByNonExecutor() public {
        vm.prank(stranger);
        vm.expectRevert(NotExecutor.selector);
        vault.approveAdapter(address(usdc), adapter, 1);
    }

    function test_ExecutorSwapRevokesTheOldExecutor() public {
        address newExecutor = makeAddr("newExecutor");
        registry.setExecutor(newExecutor);

        vm.prank(executor);
        vm.expectRevert(NotExecutor.selector);
        vault.approveAdapter(address(usdc), adapter, 1);

        vm.prank(newExecutor);
        vault.approveAdapter(address(usdc), adapter, 5e6);
        assertEq(usdc.allowance(address(vault), adapter), 5e6);
    }

    function test_WithdrawStillWorksAfterExecutorSwap() public {
        usdc.mint(address(vault), 9e6);
        registry.setExecutor(makeAddr("newExecutor"));
        vm.prank(owner);
        vault.withdraw(address(usdc), 9e6, owner);
        assertEq(usdc.balanceOf(owner), 9e6);
    }

    function test_RevertWhen_InitializeCalledTwice() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        vault.initialize(stranger, address(registry));
    }

    function test_RevertWhen_DepositOnUninitialisedImplementation() public {
        StrategyVault implementation = StrategyVault(factory.implementation());
        vm.expectRevert(NotOwner.selector);
        implementation.deposit(address(usdc), 1);
    }
}
