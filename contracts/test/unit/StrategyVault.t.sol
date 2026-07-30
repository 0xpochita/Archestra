// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Test} from "forge-std/Test.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {
    ExecutorNotAccepted,
    NoActiveSession,
    NotExecutor,
    NotOwner,
    SessionCapExceeded,
    ZeroAddress
} from "../../src/interfaces/Errors.sol";
import {IStrategyVault} from "../../src/interfaces/IStrategyVault.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockRegistry} from "../mocks/MockRegistry.sol";

contract StrategyVaultTest is Test {
    uint256 internal constant CAP = type(uint128).max;

    MockRegistry internal registry;
    VaultFactory internal factory;
    StrategyVault internal vault;
    MockERC20 internal usdc;

    uint64 internal expiry;

    address internal owner = makeAddr("owner");
    address internal executor = makeAddr("executor");
    address internal adapter = makeAddr("adapter");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        vm.warp(100_000);
        expiry = uint64(block.timestamp + 365 days);
        registry = new MockRegistry();
        registry.setExecutor(executor);
        factory = new VaultFactory(address(registry));
        vault = StrategyVault(factory.createVault(owner));
        usdc = new MockERC20("USD Coin", "USDC", 6);

        vm.prank(owner);
        vault.setSession(address(usdc), CAP, CAP, expiry);
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
        assertEq(vault.sessionSpentToday(address(usdc)), 123e6);
    }

    function test_RevertWhen_ApproveAdapterByNonExecutor() public {
        vm.prank(stranger);
        vm.expectRevert(NotExecutor.selector);
        vault.approveAdapter(address(usdc), adapter, 1);
    }

    function test_InitializerBootstrapsTheAcceptedExecutor() public view {
        assertEq(vault.acceptedExecutor(), executor);
    }

    function test_RevertWhen_PublishedExecutorWasNeverAccepted() public {
        address newExecutor = makeAddr("newExecutor");
        registry.setExecutor(newExecutor);

        vm.prank(newExecutor);
        vm.expectRevert(abi.encodeWithSelector(ExecutorNotAccepted.selector, newExecutor, executor));
        vault.approveAdapter(address(usdc), adapter, 1);
    }

    function test_RevertWhen_RetiredExecutorApproves() public {
        registry.setExecutor(makeAddr("newExecutor"));

        vm.prank(executor);
        vm.expectRevert(NotExecutor.selector);
        vault.approveAdapter(address(usdc), adapter, 1);
    }

    function test_AcceptExecutorRebindsTheVault() public {
        address newExecutor = makeAddr("newExecutor");
        registry.setExecutor(newExecutor);

        vm.expectEmit(true, true, false, true);
        emit IStrategyVault.ExecutorAccepted(address(vault), newExecutor);
        vm.prank(owner);
        vault.acceptExecutor(newExecutor);

        assertEq(vault.acceptedExecutor(), newExecutor);
        vm.prank(newExecutor);
        vault.approveAdapter(address(usdc), adapter, 5e6);
        assertEq(usdc.allowance(address(vault), adapter), 5e6);
    }

    function test_RevertWhen_AcceptExecutorByNonOwner() public {
        address newExecutor = makeAddr("newExecutor");
        registry.setExecutor(newExecutor);
        vm.prank(stranger);
        vm.expectRevert(NotOwner.selector);
        vault.acceptExecutor(newExecutor);
    }

    function test_RevertWhen_AcceptExecutorIsNotPublished() public {
        vm.prank(owner);
        vm.expectRevert(NotExecutor.selector);
        vault.acceptExecutor(makeAddr("attackerExecutor"));
    }

    function test_RevertWhen_AcceptExecutorIsZero() public {
        vm.prank(owner);
        vm.expectRevert(ZeroAddress.selector);
        vault.acceptExecutor(address(0));
    }

    function test_SetSessionEmitsTheTerms() public {
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        vm.expectEmit(true, true, false, true);
        emit IStrategyVault.SessionSet(address(vault), address(weth), 1e18, 3e18, expiry);
        vm.prank(owner);
        vault.setSession(address(weth), 1e18, 3e18, expiry);

        (uint256 maxPerRun, uint256 maxPerDay, uint64 expiresAt) = vault.sessionOf(address(weth));
        assertEq(maxPerRun, 1e18);
        assertEq(maxPerDay, 3e18);
        assertEq(expiresAt, expiry);
    }

    function test_RevertWhen_SetSessionByNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(NotOwner.selector);
        vault.setSession(address(usdc), 1, 1, expiry);
    }

    function test_RevertWhen_SetSessionForTheZeroToken() public {
        vm.prank(owner);
        vm.expectRevert(ZeroAddress.selector);
        vault.setSession(address(0), 1, 1, expiry);
    }

    function test_RevertWhen_NoSessionForTheToken() public {
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(NoActiveSession.selector, address(weth)));
        vault.approveAdapter(address(weth), adapter, 1);
    }

    function test_RevertWhen_SessionExpired() public {
        vm.warp(uint256(expiry) + 1);
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(NoActiveSession.selector, address(usdc)));
        vault.approveAdapter(address(usdc), adapter, 1);
    }

    function test_RevokeSessionStopsFurtherGrants() public {
        vm.expectEmit(true, true, false, true);
        emit IStrategyVault.SessionRevoked(address(vault), address(usdc));
        vm.prank(owner);
        vault.revokeSession(address(usdc));

        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(NoActiveSession.selector, address(usdc)));
        vault.approveAdapter(address(usdc), adapter, 1);
    }

    function test_RevertWhen_RevokeSessionByNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(NotOwner.selector);
        vault.revokeSession(address(usdc));
    }

    function test_RevertWhen_GrantExceedsMaxPerRun() public {
        vm.prank(owner);
        vault.setSession(address(usdc), 100e6, 1000e6, expiry);

        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(SessionCapExceeded.selector, address(usdc), 101e6, 100e6));
        vault.approveAdapter(address(usdc), adapter, 101e6);
    }

    function test_RevertWhen_GrantExceedsMaxPerDay() public {
        vm.prank(owner);
        vault.setSession(address(usdc), 100e6, 150e6, expiry);

        vm.prank(executor);
        vault.approveAdapter(address(usdc), adapter, 100e6);

        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(SessionCapExceeded.selector, address(usdc), 60e6, 50e6));
        vault.approveAdapter(address(usdc), adapter, 60e6);
    }

    function test_DayBucketResetsOnTheNextDay() public {
        vm.prank(owner);
        vault.setSession(address(usdc), 100e6, 100e6, expiry);

        vm.prank(executor);
        vault.approveAdapter(address(usdc), adapter, 100e6);
        assertEq(vault.sessionSpentToday(address(usdc)), 100e6);

        vm.warp(block.timestamp + 1 days);
        assertEq(vault.sessionSpentToday(address(usdc)), 0);
        vm.prank(executor);
        vault.approveAdapter(address(usdc), adapter, 100e6);
        assertEq(vault.sessionSpentToday(address(usdc)), 100e6);
    }

    function test_ZeroingPassesWithoutASessionForAnyPublishedExecutor() public {
        vm.prank(executor);
        vault.approveAdapter(address(usdc), adapter, 20e6);

        vm.prank(owner);
        vault.revokeSession(address(usdc));

        address newExecutor = makeAddr("newExecutor");
        registry.setExecutor(newExecutor);
        vm.prank(newExecutor);
        vault.approveAdapter(address(usdc), adapter, 0);
        assertEq(usdc.allowance(address(vault), adapter), 0);
    }

    function test_WithdrawStillWorksWithNoSessionAndNoLiveExecutor() public {
        usdc.mint(address(vault), 9e6);
        vm.prank(owner);
        vault.revokeSession(address(usdc));
        registry.setExecutor(address(0));

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
