// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ICcipRouter} from "../../src/interfaces/external/ICcipRouter.sol";
import {ISwapRouter} from "../../src/interfaces/external/ISwapRouter.sol";
import {MockAavePool} from "../mocks/MockAavePool.sol";
import {MockAggregator} from "../mocks/MockAggregator.sol";
import {MockCcipRouter} from "../mocks/MockCcipRouter.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockGauge} from "../mocks/MockGauge.sol";
import {MockSwapRouter} from "../mocks/MockSwapRouter.sol";

contract MockSuiteTest is Test {
    MockERC20 internal usdc;
    MockERC20 internal weth;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
    }

    function test_DecimalsVariants() public view {
        assertEq(usdc.decimals(), 6);
        assertEq(weth.decimals(), 18);
    }

    function test_AavePoolSupplyMintsOneToOneAndWithdrawBurns() public {
        MockAavePool pool = new MockAavePool();
        address aUsdc = pool.registerAsset(address(usdc));
        usdc.mint(address(this), 1000e6);
        usdc.approve(address(pool), 1000e6);

        pool.supply(address(usdc), 1000e6, address(this), 0);
        assertEq(MockERC20(aUsdc).balanceOf(address(this)), 1000e6);
        assertEq(usdc.balanceOf(address(this)), 0);

        uint256 withdrawn = pool.withdraw(address(usdc), type(uint256).max, address(this));
        assertEq(withdrawn, 1000e6);
        assertEq(MockERC20(aUsdc).balanceOf(address(this)), 0);
        assertEq(usdc.balanceOf(address(this)), 1000e6);
    }

    function test_SwapRouterAppliesRateAndHonoursMinimum() public {
        MockSwapRouter router = new MockSwapRouter();
        router.setRate(0.5e18);
        usdc.mint(address(this), 100e6);
        usdc.approve(address(router), 100e6);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(usdc),
            tokenOut: address(weth),
            fee: 500,
            recipient: address(this),
            deadline: block.timestamp + 60,
            amountIn: 100e6,
            amountOutMinimum: 50e6,
            sqrtPriceLimitX96: 0
        });
        uint256 amountOut = router.exactInputSingle(params);
        assertEq(amountOut, 50e6);
        assertEq(weth.balanceOf(address(this)), 50e6);

        usdc.mint(address(this), 100e6);
        usdc.approve(address(router), 100e6);
        params.amountOutMinimum = 51e6;
        vm.expectRevert(MockSwapRouter.RouterTooLittleReceived.selector);
        router.exactInputSingle(params);

        params.deadline = block.timestamp - 1;
        vm.expectRevert(MockSwapRouter.RouterDeadlinePassed.selector);
        router.exactInputSingle(params);
    }

    function test_GaugeAccruesRewardPerSecond() public {
        MockERC20 lp = new MockERC20("Mock LP", "mLP", 18);
        MockGauge gauge = new MockGauge(address(lp));
        gauge.setRewardPerSecond(2e18);
        lp.mint(address(this), 10e18);
        lp.approve(address(gauge), 10e18);

        gauge.deposit(10e18);
        vm.warp(block.timestamp + 30);
        assertEq(gauge.claimable_reward(address(this)), 60e18);

        gauge.claim_rewards();
        MockERC20 reward = MockERC20(gauge.reward_token());
        assertEq(reward.balanceOf(address(this)), 60e18);
        assertEq(gauge.claimable_reward(address(this)), 0);

        gauge.withdraw(10e18);
        assertEq(lp.balanceOf(address(this)), 10e18);
    }

    function test_AggregatorIsSettableForStaleness() public {
        vm.warp(100_000);
        MockAggregator feed = new MockAggregator(8, 2000e8);
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        assertEq(answer, 2000e8);
        assertEq(updatedAt, block.timestamp);

        feed.setUpdatedAt(block.timestamp - 7200);
        (,,, updatedAt,) = feed.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7200);

        feed.setAnswer(-1);
        (, answer,,,) = feed.latestRoundData();
        assertEq(answer, -1);
    }

    function test_CcipRouterRecordsAndBurns() public {
        MockCcipRouter router = new MockCcipRouter();
        router.setFee(0.01 ether);
        usdc.mint(address(this), 500e6);
        usdc.approve(address(router), 500e6);

        ICcipRouter.EVMTokenAmount[] memory tokenAmounts = new ICcipRouter.EVMTokenAmount[](1);
        tokenAmounts[0] = ICcipRouter.EVMTokenAmount({token: address(usdc), amount: 500e6});
        ICcipRouter.EVM2AnyMessage memory message = ICcipRouter.EVM2AnyMessage({
            receiver: abi.encode(makeAddr("receiver")),
            data: "",
            tokenAmounts: tokenAmounts,
            feeToken: address(0),
            extraArgs: ""
        });

        assertEq(router.getFee(1234, message), 0.01 ether);
        vm.deal(address(this), 1 ether);
        bytes32 messageId = router.ccipSend{value: 0.01 ether}(1234, message);

        assertTrue(messageId != bytes32(0));
        assertEq(router.lastDestinationChainSelector(), 1234);
        assertEq(router.lastToken(), address(usdc));
        assertEq(router.lastAmount(), 500e6);
        assertEq(usdc.balanceOf(address(this)), 0);
        assertEq(usdc.totalSupply(), 0);
    }
}
