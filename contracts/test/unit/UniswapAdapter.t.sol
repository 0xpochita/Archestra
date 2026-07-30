// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {UniswapAdapter} from "../../src/adapters/UniswapAdapter.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {DeadlinePassed, InsufficientOutput, NotExecutor} from "../../src/interfaces/Errors.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockSwapRouter} from "../mocks/MockSwapRouter.sol";

contract UniswapAdapterTest is Test {
    VaultFactory internal factory;
    WorkflowRegistry internal registry;
    Executor internal executor;
    MockSwapRouter internal router;
    UniswapAdapter internal adapter;
    MockERC20 internal usdc;
    MockERC20 internal weth;

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
        router = new MockSwapRouter();
        adapter = new UniswapAdapter(address(registry), address(router));

        vm.startPrank(admin);
        registry.grantRole(registry.CURATOR_ROLE(), admin);
        registry.publishExecutor(address(executor));
        registry.setAdapterAllowed(address(adapter), StepType.SWAP, true);
        vm.stopPrank();

        address userVault = factory.createVault(user);
        uint64 expiry = uint64(block.timestamp + 365 days);
        vm.startPrank(user);
        StrategyVault(userVault).setSession(address(usdc), type(uint128).max, type(uint128).max, expiry);
        StrategyVault(userVault).setSession(address(weth), type(uint128).max, type(uint128).max, expiry);
        vm.stopPrank();
    }

    function _swapParams(uint256 amountIn, uint256 minAmountOut, uint64 deadline)
        internal
        view
        returns (bytes memory params)
    {
        return abi.encode(address(usdc), address(weth), amountIn, minAmountOut, uint24(500), deadline);
    }

    function _createAndFund(bytes memory params, uint256 balance) internal returns (uint256 workflowId, address vault) {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SWAP, address(adapter), params);
        vm.prank(user);
        workflowId = registry.create(steps);
        vault = registry.get(workflowId).vault;
        usdc.mint(vault, balance);
    }

    function test_SwapSendsOutputToTheVault() public {
        router.setRate(5e26);
        (uint256 workflowId, address vault) =
            _createAndFund(_swapParams(1000e6, 0.4e18, uint64(block.timestamp + 60)), 1000e6);

        vm.prank(user);
        executor.run(workflowId);

        assertEq(usdc.balanceOf(vault), 0);
        assertEq(weth.balanceOf(vault), 0.5e18);
        assertEq(usdc.balanceOf(address(adapter)), 0);
        assertEq(weth.balanceOf(address(adapter)), 0);
        assertEq(usdc.allowance(vault, address(adapter)), 0);
        assertEq(usdc.allowance(address(adapter), address(router)), 0);
    }

    function test_RevertWhen_OutputBelowMinimum() public {
        router.setRate(5e26);
        (uint256 workflowId,) = _createAndFund(_swapParams(1000e6, 0.6e18, uint64(block.timestamp + 60)), 1000e6);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(InsufficientOutput.selector, 0.5e18, 0.6e18));
        executor.run(workflowId);
    }

    function test_RevertWhen_DeadlinePassed() public {
        uint64 deadline = uint64(block.timestamp - 1);
        (uint256 workflowId,) = _createAndFund(_swapParams(1000e6, 1, deadline), 1000e6);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(DeadlinePassed.selector, deadline));
        executor.run(workflowId);
    }

    function test_RevertWhen_MinAmountOutIsZero() public {
        (uint256 workflowId,) = _createAndFund(_swapParams(1000e6, 0, uint64(block.timestamp + 60)), 1000e6);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(InsufficientOutput.selector, 0, 0));
        executor.run(workflowId);
    }

    function test_RevertWhen_ExecuteCalledDirectly() public {
        vm.prank(user);
        vm.expectRevert(NotExecutor.selector);
        adapter.execute(makeAddr("vault"), _swapParams(1, 1, uint64(block.timestamp + 60)));
    }
}
