// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {UniswapAdapter} from "../../src/adapters/UniswapAdapter.sol";
import {Executor} from "../../src/core/Executor.sol";
import {StrategyVault} from "../../src/core/StrategyVault.sol";
import {VaultFactory} from "../../src/core/VaultFactory.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {InsufficientOutput} from "../../src/interfaces/Errors.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockSwapRouter} from "../mocks/MockSwapRouter.sol";

contract UniswapAdapterFuzzTest is Test {
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
        StrategyVault(userVault).setSession(address(usdc), type(uint256).max, type(uint256).max, expiry);
        StrategyVault(userVault).setSession(address(weth), type(uint256).max, type(uint256).max, expiry);
        vm.stopPrank();
    }

    function _swapWorkflow(uint256 amountIn, uint256 minAmountOut)
        internal
        returns (uint256 workflowId, address vault)
    {
        Step[] memory steps = new Step[](1);
        steps[0] = Step(
            StepType.SWAP,
            address(adapter),
            abi.encode(address(usdc), address(weth), amountIn, minAmountOut, uint24(500), uint64(block.timestamp + 60))
        );
        vm.prank(user);
        workflowId = registry.create(steps);
        vault = registry.get(workflowId).vault;
        usdc.mint(vault, amountIn);
    }

    function testFuzz_OutputIsAtLeastTheMinimum(uint256 amountIn, uint256 minAmountOut) public {
        amountIn = bound(amountIn, 1e12, type(uint96).max);
        uint256 expectedOut = (amountIn * router.rate()) / 1e18;
        minAmountOut = bound(minAmountOut, 1, expectedOut);

        (uint256 workflowId, address vault) = _swapWorkflow(amountIn, minAmountOut);
        vm.prank(user);
        executor.run(workflowId);

        assertGe(weth.balanceOf(vault), minAmountOut);
        assertEq(weth.balanceOf(vault), expectedOut);
        assertEq(usdc.allowance(vault, address(adapter)), 0);
    }

    function testFuzz_RevertWhen_OutputBelowTheMinimum(uint256 amountIn, uint256 shortfall) public {
        amountIn = bound(amountIn, 1, type(uint96).max);
        uint256 expectedOut = (amountIn * router.rate()) / 1e18;
        shortfall = bound(shortfall, 1, type(uint96).max);
        uint256 minAmountOut = expectedOut + shortfall;

        (uint256 workflowId, address vault) = _swapWorkflow(amountIn, minAmountOut);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(InsufficientOutput.selector, expectedOut, minAmountOut));
        executor.run(workflowId);

        assertEq(weth.balanceOf(vault), 0);
        assertEq(usdc.allowance(vault, address(adapter)), 0);
    }
}
