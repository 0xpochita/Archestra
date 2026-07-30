// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Holds one owner's ERC20 balances. The only place user funds live.
interface IStrategyVault {
    event ExecutorAccepted(address indexed vault, address indexed executor);
    event SessionSet(
        address indexed vault, address indexed token, uint256 maxPerRun, uint256 maxPerDay, uint64 expiresAt
    );
    event SessionRevoked(address indexed vault, address indexed token);

    /// @notice Pulls tokens from the caller into the vault.
    /// @param token The ERC20 to deposit.
    /// @param amount The amount in the token's base units.
    function deposit(address token, uint256 amount) external;

    /// @notice Sends vault tokens out. Owner only, works while paused, in every reachable state.
    /// @param token The ERC20 to withdraw.
    /// @param amount The amount in the token's base units.
    /// @param to The recipient.
    /// @dev Reverts with NotOwner.
    function withdraw(address token, uint256 amount, address to) external;

    /// @notice Approves an adapter for exactly one step's amount.
    /// @param token The ERC20 to approve.
    /// @param adapter The adapter that will pull.
    /// @param amount The exact allowance to set.
    /// @dev A non zero amount requires the caller to be both the owner accepted executor and
    ///      still registry published, and is metered against the token's active session.
    ///      Reverts with NotExecutor, ExecutorNotAccepted, NoActiveSession or SessionCapExceeded.
    ///      A zero amount is allowance cleanup and passes for any published executor, so the
    ///      reset at the end of a run can never be blocked.
    function approveAdapter(address token, address adapter, uint256 amount) external;

    /// @notice Binds this vault to an executor version its owner has reviewed.
    /// @param newExecutor The executor deployment this vault will obey.
    /// @dev Owner only, and the candidate must be published in the registry, so neither the
    ///      admin alone nor the owner alone can direct vault funds. Emits ExecutorAccepted.
    ///      Reverts with NotOwner, ZeroAddress or NotExecutor.
    function acceptExecutor(address newExecutor) external;

    /// @notice Opens or replaces the spending session for one token.
    /// @param token The ERC20 the session governs.
    /// @param maxPerRun The largest single grant the executor may be given.
    /// @param maxPerDay The total the executor may be granted inside one day bucket.
    /// @param expiresAt The unix second after which the session no longer authorises anything.
    /// @dev Owner only. Emits SessionSet. Reverts with NotOwner or ZeroAddress.
    function setSession(address token, uint256 maxPerRun, uint256 maxPerDay, uint64 expiresAt) external;

    /// @notice Closes the spending session for one token in a single transaction.
    /// @param token The ERC20 whose session ends.
    /// @dev Owner only. The day bucket accumulator is kept, so reopening a session does not
    ///      hand back an already spent daily budget. Emits SessionRevoked. Reverts with NotOwner.
    function revokeSession(address token) external;

    /// @notice The address allowed to withdraw.
    /// @return ownerAddress The vault owner.
    function owner() external view returns (address ownerAddress);

    /// @notice The executor version this vault's owner accepted.
    /// @return executorAddress The accepted executor, bootstrapped at clone initialisation.
    function acceptedExecutor() external view returns (address executorAddress);
}
