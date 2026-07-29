// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Executor} from "../../src/core/Executor.sol";
import {WorkflowRegistry} from "../../src/core/WorkflowRegistry.sol";
import {Step, StepType} from "../../src/interfaces/Types.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

/// Fork tests against the live Arc testnet deployment. Skipped when
/// ARC_TESTNET_RPC is absent so local and CI runs stay fast.
contract ArcForkTest is Test {
    string private constant DEPLOYMENTS_PATH = "deployments/arc-testnet.json";

    WorkflowRegistry internal registry;
    Executor internal executor;
    MockERC20 internal usdc;
    MockERC20 internal weth;
    MockERC20 internal aUsdc;
    address internal supplyAdapter;
    address internal redeemAdapter;
    address internal swapAdapter;
    address internal bridgeAdapter;

    address internal forkUser = makeAddr("forkUser");

    function _forkOrSkip() internal returns (bool forked) {
        string memory rpc = vm.envOr("ARC_TESTNET_RPC", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return false;
        }
        vm.createSelectFork(rpc);

        string memory deployments = vm.readFile(DEPLOYMENTS_PATH);
        registry = WorkflowRegistry(vm.parseJsonAddress(deployments, ".core.registry"));
        executor = Executor(vm.parseJsonAddress(deployments, ".core.executor"));
        usdc = MockERC20(vm.parseJsonAddress(deployments, ".tokens.usdc"));
        weth = MockERC20(vm.parseJsonAddress(deployments, ".tokens.weth"));
        aUsdc = MockERC20(vm.parseJsonAddress(deployments, ".tokens.aUsdc"));
        supplyAdapter = vm.parseJsonAddress(deployments, ".adapters.supply");
        redeemAdapter = vm.parseJsonAddress(deployments, ".adapters.redeem");
        swapAdapter = vm.parseJsonAddress(deployments, ".adapters.swap");
        bridgeAdapter = vm.parseJsonAddress(deployments, ".adapters.bridge");
        return true;
    }

    function _createAndFund(Step[] memory steps, uint256 balance) internal returns (uint256 workflowId, address vault) {
        vm.prank(forkUser);
        workflowId = registry.create(steps);
        vault = registry.get(workflowId).vault;
        usdc.mint(vault, balance);
    }

    function test_ForkAaveSupplyMovesRealVaultBalances() public {
        if (!_forkOrSkip()) return;

        Step[] memory steps = new Step[](1);
        steps[0] = Step(StepType.SUPPLY, supplyAdapter, abi.encode(address(usdc), uint256(100e6)));
        (uint256 workflowId, address vault) = _createAndFund(steps, 100e6);

        uint256 usdcBefore = usdc.balanceOf(vault);
        uint256 aBefore = aUsdc.balanceOf(vault);
        vm.prank(forkUser);
        executor.run(workflowId);

        assertEq(usdc.balanceOf(vault), usdcBefore - 100e6);
        assertEq(aUsdc.balanceOf(vault), aBefore + 100e6);
    }

    function test_ForkAaveRoundTripRestoresTheBalance() public {
        if (!_forkOrSkip()) return;

        Step[] memory steps = new Step[](2);
        steps[0] = Step(StepType.SUPPLY, supplyAdapter, abi.encode(address(usdc), uint256(100e6)));
        steps[1] = Step(StepType.REDEEM, redeemAdapter, abi.encode(address(usdc), type(uint256).max));
        (uint256 workflowId, address vault) = _createAndFund(steps, 100e6);

        vm.prank(forkUser);
        executor.run(workflowId);

        assertEq(usdc.balanceOf(vault), 100e6);
        assertEq(aUsdc.balanceOf(vault), 0);
    }

    function test_ForkUniswapSwapDeliversOutputToTheVault() public {
        if (!_forkOrSkip()) return;

        Step[] memory steps = new Step[](1);
        steps[0] = Step(
            StepType.SWAP,
            swapAdapter,
            abi.encode(
                address(usdc), address(weth), uint256(50e6), uint256(1), uint24(500), uint64(block.timestamp + 3600)
            )
        );
        (uint256 workflowId, address vault) = _createAndFund(steps, 50e6);

        uint256 wethBefore = weth.balanceOf(vault);
        vm.prank(forkUser);
        executor.run(workflowId);

        assertEq(usdc.balanceOf(vault), 0);
        assertGt(weth.balanceOf(vault), wethBefore);
    }

    function test_ForkCcipBridgeDrainsTheVaultExactlyOnce() public {
        if (!_forkOrSkip()) return;

        Step[] memory steps = new Step[](1);
        steps[0] =
            Step(StepType.BRIDGE, bridgeAdapter, abi.encode(uint64(1234), forkUser, address(usdc), uint256(25e6)));
        (uint256 workflowId, address vault) = _createAndFund(steps, 40e6);

        vm.prank(forkUser);
        executor.run(workflowId);

        assertEq(usdc.balanceOf(vault), 15e6);
    }
}
