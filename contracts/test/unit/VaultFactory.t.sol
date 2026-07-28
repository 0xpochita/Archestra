// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {ZeroAddress} from "../../src/interfaces/Errors.sol";
import {IVaultFactory} from "../../src/interfaces/IVaultFactory.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockRegistry} from "../mocks/MockRegistry.sol";

contract VaultFactoryTest is Test {
    MockRegistry internal registry;
    VaultFactory internal factory;
    MockERC20 internal usdc;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        registry = new MockRegistry();
        registry.setExecutor(makeAddr("executor"));
        factory = new VaultFactory(address(registry));
        usdc = new MockERC20("USD Coin", "USDC", 6);
    }

    function test_CreateVaultMatchesPrediction() public {
        address predicted = factory.predictVault(alice);
        address vault = factory.createVault(alice);
        assertEq(vault, predicted);
        assertEq(factory.vaultOf(alice), vault);
        assertEq(StrategyVault(vault).owner(), alice);
        assertEq(StrategyVault(vault).registry(), address(registry));
    }

    function test_SecondCreateReusesTheVault() public {
        address first = factory.createVault(alice);
        address second = factory.createVault(alice);
        assertEq(first, second);
    }

    function test_DistinctOwnersGetDistinctVaults() public {
        assertTrue(factory.createVault(alice) != factory.createVault(bob));
    }

    function test_EmitsVaultCreatedOnce() public {
        address predicted = factory.predictVault(alice);
        vm.expectEmit(true, true, false, true);
        emit IVaultFactory.VaultCreated(alice, predicted);
        factory.createVault(alice);
    }

    function test_RevertWhen_OwnerIsZero() public {
        vm.expectRevert(ZeroAddress.selector);
        factory.createVault(address(0));
    }

    function test_RevertWhen_RegistryIsZero() public {
        vm.expectRevert(ZeroAddress.selector);
        new VaultFactory(address(0));
    }

    function test_VaultKeepsWorkingWhateverHappensToTheRegistry() public {
        address vault = factory.createVault(alice);
        usdc.mint(vault, 7e6);
        registry.setExecutor(address(0));
        vm.prank(alice);
        StrategyVault(vault).withdraw(address(usdc), 7e6, alice);
        assertEq(usdc.balanceOf(alice), 7e6);
    }
}
