// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Holds one owner's ERC20 balances. The only place user funds live.
interface IStrategyVault {
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
    /// @dev Executor only, resolved through registry.executor() at call time. Reverts with NotExecutor.
    function approveAdapter(address token, address adapter, uint256 amount) external;

    /// @notice The address allowed to withdraw.
    /// @return ownerAddress The vault owner.
    function owner() external view returns (address ownerAddress);
}

