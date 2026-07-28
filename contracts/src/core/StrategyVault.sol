// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {NotExecutor, NotOwner, ZeroAddress} from "../interfaces/Errors.sol";
import {IStrategyVault} from "../interfaces/IStrategyVault.sol";
import {IWorkflowRegistry} from "../interfaces/IWorkflowRegistry.sol";

/// @notice Holds one owner's ERC20 balances. Deployed as an EIP-1167 clone by the VaultFactory.
/// @dev The executor is resolved through the registry at call time and never stored here,
///      so replacing the executor never touches deployed vaults.
contract StrategyVault is IStrategyVault, Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address private _owner;
    IWorkflowRegistry private _registry;

    event Deposited(address indexed token, address indexed from, uint256 amount);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != _owner) revert NotOwner();
        _;
    }

    modifier onlyExecutor() {
        if (msg.sender != _registry.executor()) revert NotExecutor();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /// @notice Wires the clone to its owner and registry.
    /// @param owner_ The only address allowed to withdraw.
    /// @param registry_ The registry this vault resolves its executor from.
    /// @dev Called by the factory in the same transaction as the clone deployment.
    ///      Reverts with ZeroAddress, and with InvalidInitialization on a second call.
    function initialize(address owner_, address registry_) external initializer {
        if (owner_ == address(0) || registry_ == address(0)) revert ZeroAddress();
        _owner = owner_;
        _registry = IWorkflowRegistry(registry_);
    }

    /// @inheritdoc IStrategyVault
    /// @dev Callable by anyone, a deposit only ever benefits the owner.
    ///      Reverts with NotOwner before initialisation.
    function deposit(address token, uint256 amount) external nonReentrant {
        if (_owner == address(0)) revert NotOwner();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(token, msg.sender, amount);
    }

    /// @inheritdoc IStrategyVault
    function withdraw(address token, uint256 amount, address to) external onlyOwner nonReentrant {
        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, to, amount);
    }

    /// @inheritdoc IStrategyVault
    function approveAdapter(address token, address adapter, uint256 amount) external onlyExecutor {
        IERC20(token).forceApprove(adapter, amount);
    }

    /// @inheritdoc IStrategyVault
    function owner() external view returns (address ownerAddress) {
        return _owner;
    }

    /// @notice The registry this vault resolves its executor from.
    /// @return registryAddress The wired registry.
    function registry() external view returns (address registryAddress) {
        return address(_registry);
    }
}
