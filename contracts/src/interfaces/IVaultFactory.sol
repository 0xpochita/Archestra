// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Deploys and tracks one StrategyVault clone per owner.
interface IVaultFactory {
    event VaultCreated(address indexed owner, address indexed vault);

    /// @notice Returns the owner's vault, deploying it on first call. Idempotent, callable by anyone.
    /// @param owner The vault owner.
    /// @return vault The owner's canonical vault address.
    /// @dev Reverts with ZeroAddress.
    function createVault(address owner) external returns (address vault);

    /// @notice The vault already deployed for an owner, zero when none.
    /// @param owner The vault owner.
    /// @return vault The deployed vault or the zero address.
    function vaultOf(address owner) external view returns (address vault);

    /// @notice The address an owner's vault occupies, before or after deployment.
    /// @param owner The vault owner.
    /// @return vault The CREATE2 derived vault address.
    function predictVault(address owner) external view returns (address vault);

    /// @notice The StrategyVault implementation every clone delegates to.
    /// @return implementationAddress The implementation contract.
    function implementation() external view returns (address implementationAddress);

    /// @notice The registry every vault is wired to at initialisation.
    /// @return registryAddress The registry contract.
    function registry() external view returns (address registryAddress);
}
