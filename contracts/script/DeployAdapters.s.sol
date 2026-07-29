// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AaveAdapter} from "../src/adapters/AaveAdapter.sol";
import {CcipAdapter} from "../src/adapters/CcipAdapter.sol";
import {CurveAdapter} from "../src/adapters/CurveAdapter.sol";
import {UniswapAdapter} from "../src/adapters/UniswapAdapter.sol";
import {WorkflowRegistry} from "../src/core/WorkflowRegistry.sol";
import {StepType} from "../src/interfaces/Types.sol";
import {MockAavePool} from "../test/mocks/MockAavePool.sol";
import {MockCcipRouter} from "../test/mocks/MockCcipRouter.sol";
import {MockCurvePool} from "../test/mocks/MockCurvePool.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {MockGauge} from "../test/mocks/MockGauge.sol";
import {MockSwapRouter} from "../test/mocks/MockSwapRouter.sol";

/// Deploys the adapters and modules against real protocol addresses from the
/// environment, or against freshly deployed mock protocols when the environment
/// leaves them empty, which is the Arc testnet reality for now. Idempotent.
contract DeployAdapters is Script {
    string private constant DEPLOYMENTS_PATH = "deployments/arc-testnet.json";

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        string memory existing = vm.readFile(DEPLOYMENTS_PATH);
        WorkflowRegistry registry = WorkflowRegistry(vm.parseJsonAddress(existing, ".core.registry"));
        address trigger = vm.parseJsonAddress(existing, ".core.automationTrigger");
        address guard = vm.parseJsonAddress(existing, ".core.guardModule");
        address executor = vm.parseJsonAddress(existing, ".core.executor");

        if (vm.keyExistsJson(existing, ".adapters.supply")) {
            address supplyAddress = vm.parseJsonAddress(existing, ".adapters.supply");
            if (supplyAddress.code.length > 0) {
                console2.log("adapters already deployed at", supplyAddress);
                return;
            }
        }

        vm.startBroadcast(deployerKey);
        (address aavePool, address swapRouter, address curvePool, address gauge, address ccipRouter) =
            _protocols(existing);

        AaveAdapter supplyAdapter = new AaveAdapter(address(registry), aavePool, StepType.SUPPLY);
        AaveAdapter redeemAdapter = new AaveAdapter(address(registry), aavePool, StepType.REDEEM);
        UniswapAdapter swapAdapter = new UniswapAdapter(address(registry), swapRouter);
        CurveAdapter stakeAdapter = new CurveAdapter(address(registry), StepType.STAKE);
        CurveAdapter claimAdapter = new CurveAdapter(address(registry), StepType.CLAIM);
        CcipAdapter bridgeAdapter = new CcipAdapter(address(registry), ccipRouter);

        registry.setAdapterAllowed(trigger, StepType.TRIGGER, true);
        registry.setAdapterAllowed(executor, StepType.APPROVE, true);
        registry.setAdapterAllowed(executor, StepType.NOTIFY, true);
        registry.setAdapterAllowed(guard, StepType.GUARD, true);
        registry.setAdapterAllowed(address(supplyAdapter), StepType.SUPPLY, true);
        registry.setAdapterAllowed(address(redeemAdapter), StepType.REDEEM, true);
        registry.setAdapterAllowed(address(swapAdapter), StepType.SWAP, true);
        registry.setAdapterAllowed(address(stakeAdapter), StepType.STAKE, true);
        registry.setAdapterAllowed(address(claimAdapter), StepType.CLAIM, true);
        registry.setAdapterAllowed(address(bridgeAdapter), StepType.BRIDGE, true);
        vm.stopBroadcast();

        string memory adapters = "adapters";
        vm.serializeAddress(adapters, "supply", address(supplyAdapter));
        vm.serializeAddress(adapters, "redeem", address(redeemAdapter));
        vm.serializeAddress(adapters, "swap", address(swapAdapter));
        vm.serializeAddress(adapters, "stake", address(stakeAdapter));
        vm.serializeAddress(adapters, "claim", address(claimAdapter));
        vm.serializeAddress(adapters, "bridge", address(bridgeAdapter));
        vm.serializeAddress(adapters, "aavePool", aavePool);
        vm.serializeAddress(adapters, "swapRouter", swapRouter);
        vm.serializeAddress(adapters, "curvePool", curvePool);
        vm.serializeAddress(adapters, "gauge", gauge);
        string memory adaptersJson = vm.serializeAddress(adapters, "ccipRouter", ccipRouter);
        vm.writeJson(adaptersJson, DEPLOYMENTS_PATH, ".adapters");
        console2.log("supply adapter", address(supplyAdapter));
        console2.log("swap adapter", address(swapAdapter));
    }

    function _protocols(string memory existing)
        private
        returns (address aavePool, address swapRouter, address curvePool, address gauge, address ccipRouter)
    {
        aavePool = vm.envOr("AAVE_POOL", address(0));
        swapRouter = vm.envOr("SWAP_ROUTER", address(0));
        curvePool = vm.envOr("CURVE_POOL", address(0));
        gauge = vm.envOr("CURVE_GAUGE", address(0));
        ccipRouter = vm.envOr("CCIP_ROUTER", address(0));

        if (aavePool != address(0) && swapRouter != address(0) && ccipRouter != address(0)) {
            return (aavePool, swapRouter, curvePool, gauge, ccipRouter);
        }

        MockERC20 usdc = MockERC20(_tokenFrom(existing, ".tokens.usdc"));
        MockERC20 weth = MockERC20(_tokenFrom(existing, ".tokens.weth"));

        MockAavePool mockAave = new MockAavePool();
        address aUsdc = mockAave.registerAsset(address(usdc));
        MockSwapRouter mockRouter = new MockSwapRouter();
        mockRouter.setRate(5e26);
        MockCurvePool mockPool = new MockCurvePool(address(usdc), address(weth), 1e12);
        MockGauge mockGauge = new MockGauge(address(mockPool.lpToken()));
        mockGauge.setRewardPerSecond(1e15);
        MockCcipRouter mockCcip = new MockCcipRouter();

        string memory tokens = "tokens";
        vm.serializeAddress(tokens, "usdc", address(usdc));
        vm.serializeAddress(tokens, "weth", address(weth));
        vm.serializeAddress(tokens, "aUsdc", aUsdc);
        vm.serializeAddress(tokens, "lpToken", address(mockPool.lpToken()));
        string memory tokensJson = vm.serializeAddress(tokens, "rewardToken", mockGauge.reward_token());
        vm.writeJson(tokensJson, DEPLOYMENTS_PATH, ".tokens");

        return (address(mockAave), address(mockRouter), address(mockPool), address(mockGauge), address(mockCcip));
    }

    function _tokenFrom(string memory existing, string memory key) private returns (address token) {
        if (vm.keyExistsJson(existing, key)) {
            token = vm.parseJsonAddress(existing, key);
            if (token.code.length > 0) return token;
        }
        bool isUsdc = keccak256(bytes(key)) == keccak256(bytes(".tokens.usdc"));
        return isUsdc
            ? address(new MockERC20("Demo USD Coin", "dUSDC", 6))
            : address(new MockERC20("Demo Wrapped Ether", "dWETH", 18));
    }
}
