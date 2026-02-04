// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC8004Identity
 * @notice Interface for ERC-8004 compliant identity registries.
 */
interface IERC8004Identity {
    /// @notice Emitted when a new agent is registered
    event Registered(
        uint256 indexed agentId,
        string tokenURI,
        address indexed owner
    );

    /// @notice Emitted when an agent's URI is updated
    event AgentURIUpdated(
        uint256 indexed agentId,
        string newURI
    );

    /// @notice Emitted when on-chain metadata is set
    event MetadataSet(
        uint256 indexed agentId,
        string indexed key,
        bytes value
    );

    /**
     * @notice Register a new agent identity
     * @param tokenURI_ The URI pointing to the ERC-8004 registration JSON
     * @return agentId The newly assigned agent ID
     */
    function register(string calldata tokenURI_) external returns (uint256);

    /**
     * @notice Update the tokenURI for an existing agent
     * @param agentId The agent's token ID
     * @param newURI The new URI
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    /**
     * @notice Set on-chain metadata for an agent
     * @param agentId The agent's token ID
     * @param key The metadata key
     * @param value The metadata value as bytes
     */
    function setMetadata(
        uint256 agentId,
        string calldata key,
        bytes calldata value
    ) external;

    /**
     * @notice Get on-chain metadata for an agent
     * @param agentId The agent's token ID
     * @param key The metadata key
     * @return The metadata value as bytes
     */
    function getMetadata(
        uint256 agentId,
        string calldata key
    ) external view returns (bytes memory);

    /**
     * @notice Get the next agent ID that will be assigned
     * @return The next agent ID
     */
    function nextAgentId() external view returns (uint256);
}
