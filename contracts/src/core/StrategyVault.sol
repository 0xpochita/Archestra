// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    ExecutorNotAccepted,
    NoActiveSession,
    NotExecutor,
    NotOwner,
    SessionCapExceeded,
    ZeroAddress
} from "../interfaces/Errors.sol";
import {IStrategyVault} from "../interfaces/IStrategyVault.sol";
import {IWorkflowRegistry} from "../interfaces/IWorkflowRegistry.sol";

/// @notice Holds one owner's ERC20 balances. Deployed as an EIP-1167 clone by the VaultFactory.
/// @dev Two independent consents gate every grant: the admin publishes an executor version in
///      the registry and this vault's owner accepts it, so neither party alone can direct funds.
///      On top of that, the owner's per token session caps how much a run may be granted.
///      Withdrawal answers to the owner alone and works in every reachable state.
contract StrategyVault is IStrategyVault, Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Session {
        uint256 maxPerRun;
        uint256 maxPerDay;
        uint64 expiresAt;
    }

    address private _owner;
    IWorkflowRegistry private _registry;
    address private _acceptedExecutor;
    mapping(address token => Session session) private _sessions;
    mapping(address token => mapping(uint256 dayIndex => uint256 spent)) private _spentPerDay;

    event Deposited(address indexed token, address indexed from, uint256 amount);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != _owner) revert NotOwner();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /// @notice Wires the clone to its owner and registry and bootstraps the accepted executor.
    /// @param owner_ The only address allowed to withdraw.
    /// @param registry_ The registry this vault checks executor publication against.
    /// @dev Called by the factory in the same transaction as the clone deployment, which is the
    ///      owner's own create transaction, so adopting the registry's latest published executor
    ///      here is that owner's consent for version one. Every later version needs acceptExecutor.
    ///      Reverts with ZeroAddress, and with InvalidInitialization on a second call.
    function initialize(address owner_, address registry_) external initializer {
        if (owner_ == address(0) || registry_ == address(0)) revert ZeroAddress();
        _owner = owner_;
        _registry = IWorkflowRegistry(registry_);
        address bootstrapExecutor = IWorkflowRegistry(registry_).executor();
        if (bootstrapExecutor != address(0)) {
            _acceptedExecutor = bootstrapExecutor;
            emit ExecutorAccepted(address(this), bootstrapExecutor);
        }
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
    function approveAdapter(address token, address adapter, uint256 amount) external {
        if (!_registry.isExecutor(msg.sender)) revert NotExecutor();
        if (amount > 0) {
            address accepted = _acceptedExecutor;
            if (msg.sender != accepted) revert ExecutorNotAccepted(msg.sender, accepted);
            _meterSession(token, amount);
        }
        IERC20(token).forceApprove(adapter, amount);
    }

    /// @inheritdoc IStrategyVault
    function acceptExecutor(address newExecutor) external onlyOwner {
        if (newExecutor == address(0)) revert ZeroAddress();
        if (!_registry.isExecutor(newExecutor)) revert NotExecutor();
        _acceptedExecutor = newExecutor;
        emit ExecutorAccepted(address(this), newExecutor);
    }

    /// @inheritdoc IStrategyVault
    function setSession(address token, uint256 maxPerRun, uint256 maxPerDay, uint64 expiresAt) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        _sessions[token] = Session({maxPerRun: maxPerRun, maxPerDay: maxPerDay, expiresAt: expiresAt});
        emit SessionSet(address(this), token, maxPerRun, maxPerDay, expiresAt);
    }

    /// @inheritdoc IStrategyVault
    function revokeSession(address token) external onlyOwner {
        delete _sessions[token];
        emit SessionRevoked(address(this), token);
    }

    /// @inheritdoc IStrategyVault
    function owner() external view returns (address ownerAddress) {
        return _owner;
    }

    /// @inheritdoc IStrategyVault
    function acceptedExecutor() external view returns (address executorAddress) {
        return _acceptedExecutor;
    }

    /// @notice The registry this vault checks executor publication against.
    /// @return registryAddress The wired registry.
    function registry() external view returns (address registryAddress) {
        return address(_registry);
    }

    /// @notice The session terms currently stored for one token.
    /// @param token The ERC20 to read.
    /// @return maxPerRun The largest single grant allowed.
    /// @return maxPerDay The total allowed inside one day bucket.
    /// @return expiresAt The unix second the session stops authorising at, zero when there is none.
    function sessionOf(address token) external view returns (uint256 maxPerRun, uint256 maxPerDay, uint64 expiresAt) {
        Session memory session = _sessions[token];
        return (session.maxPerRun, session.maxPerDay, session.expiresAt);
    }

    /// @notice How much of a token the executor has already been granted in the current day bucket.
    /// @param token The ERC20 to read.
    /// @return spent The accumulated grant amount for today.
    function sessionSpentToday(address token) external view returns (uint256 spent) {
        return _spentPerDay[token][block.timestamp / 1 days];
    }

    function _meterSession(address token, uint256 amount) private {
        Session memory session = _sessions[token];
        if (session.expiresAt == 0 || block.timestamp > session.expiresAt) revert NoActiveSession(token);

        uint256 dayIndex = block.timestamp / 1 days;
        uint256 spent = _spentPerDay[token][dayIndex];
        uint256 remaining = spent >= session.maxPerDay ? 0 : session.maxPerDay - spent;
        if (remaining > session.maxPerRun) remaining = session.maxPerRun;
        if (amount > remaining) revert SessionCapExceeded(token, amount, remaining);

        _spentPerDay[token][dayIndex] = spent + amount;
    }
}
