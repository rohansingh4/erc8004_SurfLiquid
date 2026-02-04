// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC8004Identity.sol";

/**
 * @title Agent ERC-8004 Identity Registry
 * @notice Minimal ERC-8004 compliant identity registry for DeFAI yield agents.
 *         Each agent gets an ERC-721 token whose tokenURI points to an
 *         ERC-8004 registration JSON file.
 *
 * @dev Follows the ERC-8004 spec:
 *      - register(tokenURI) → mints NFT, emits Registered
 *      - setAgentURI(agentId, newURI) → updates tokenURI, only owner/approved
 *      - setMetadata(agentId, key, value) → optional on-chain kv store
 *      - getMetadata(agentId, key) → read on-chain metadata
 */
contract AgentIdentityRegistry is
    ERC721URIStorage,
    Ownable,
    ReentrancyGuard,
    IERC8004Identity
{
    uint256 private _nextAgentId = 1;

    // Optional on-chain key-value metadata per agent
    // agentId => key => value
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    // ── Constructor ──────────────────────────────────────────────
    constructor()
        ERC721("DeFAI Agents", "DEFAI-AGENT")
        Ownable(msg.sender)
    {}

    // ── Registration ─────────────────────────────────────────────

    /**
     * @notice Register a new agent. Mints an ERC-721 to the caller.
     * @param tokenURI_ The URI pointing to the ERC-8004 registration JSON.
     *        Can be https://, ipfs://, or data: URI.
     * @return agentId The newly assigned agent ID.
     */
    function register(string calldata tokenURI_)
        external
        override
        nonReentrant
        returns (uint256)
    {
        require(bytes(tokenURI_).length > 0, "TokenURI cannot be empty");

        uint256 agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, tokenURI_);

        emit Registered(agentId, tokenURI_, msg.sender);
        return agentId;
    }

    /**
     * @notice Update the tokenURI for an existing agent.
     *         Only callable by the token owner or approved operator.
     * @param agentId The agent's token ID.
     * @param newURI The new URI.
     */
    function setAgentURI(uint256 agentId, string calldata newURI)
        external
        override
    {
        require(
            ownerOf(agentId) == msg.sender ||
            isApprovedForAll(ownerOf(agentId), msg.sender) ||
            getApproved(agentId) == msg.sender,
            "Not owner or approved"
        );
        require(bytes(newURI).length > 0, "URI cannot be empty");

        _setTokenURI(agentId, newURI);
        emit AgentURIUpdated(agentId, newURI);
    }

    // ── Optional On-Chain Metadata ───────────────────────────────

    /**
     * @notice Set arbitrary on-chain metadata for an agent.
     * @param agentId The agent's token ID.
     * @param key The metadata key (e.g., "agentWallet", "version").
     * @param value The metadata value as bytes.
     */
    function setMetadata(
        uint256 agentId,
        string calldata key,
        bytes calldata value
    ) external override {
        require(
            ownerOf(agentId) == msg.sender ||
            isApprovedForAll(ownerOf(agentId), msg.sender),
            "Not owner or approved"
        );

        _metadata[agentId][key] = value;
        emit MetadataSet(agentId, key, value);
    }

    /**
     * @notice Read on-chain metadata for an agent.
     */
    function getMetadata(uint256 agentId, string calldata key)
        external
        view
        override
        returns (bytes memory)
    {
        return _metadata[agentId][key];
    }

    /**
     * @notice Get the next agent ID that will be assigned.
     */
    function nextAgentId() external view override returns (uint256) {
        return _nextAgentId;
    }
}
