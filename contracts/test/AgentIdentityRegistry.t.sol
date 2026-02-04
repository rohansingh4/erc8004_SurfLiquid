// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentIdentityRegistry.sol";

contract AgentIdentityRegistryTest is Test {
    AgentIdentityRegistry public registry;

    address public owner = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public operator = address(0x3);

    // Required for receiving ERC721 tokens via safeMint
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    string constant TEST_URI = "https://api.example.com/erc8004/metadata";
    string constant UPDATED_URI = "https://api.example.com/erc8004/metadata?v=123";

    event Registered(uint256 indexed agentId, string tokenURI, address indexed owner);
    event AgentURIUpdated(uint256 indexed agentId, string newURI);
    event MetadataSet(uint256 indexed agentId, string indexed key, bytes value);

    function setUp() public {
        registry = new AgentIdentityRegistry();
    }

    // ══════════════════════════════════════════════════════════════
    // Registration Tests
    // ══════════════════════════════════════════════════════════════

    function test_RegisterMintsAndEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Registered(1, TEST_URI, address(this));

        uint256 agentId = registry.register(TEST_URI);

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(1), address(this));
        assertEq(registry.tokenURI(1), TEST_URI);
        assertEq(registry.nextAgentId(), 2);
    }

    function test_RegisterRevertsOnEmptyURI() public {
        vm.expectRevert("TokenURI cannot be empty");
        registry.register("");
    }

    function test_MultipleRegistrations() public {
        uint256 id1 = registry.register(TEST_URI);

        vm.prank(user1);
        uint256 id2 = registry.register("https://example.com/agent2");

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(registry.ownerOf(1), address(this));
        assertEq(registry.ownerOf(2), user1);
        assertEq(registry.nextAgentId(), 3);
    }

    // ══════════════════════════════════════════════════════════════
    // setAgentURI Tests
    // ══════════════════════════════════════════════════════════════

    function test_SetAgentURIByOwner() public {
        registry.register(TEST_URI);

        vm.expectEmit(true, false, false, true);
        emit AgentURIUpdated(1, UPDATED_URI);

        registry.setAgentURI(1, UPDATED_URI);

        assertEq(registry.tokenURI(1), UPDATED_URI);
    }

    function test_SetAgentURIByApprovedAddress() public {
        registry.register(TEST_URI);
        registry.approve(user1, 1);

        vm.prank(user1);
        registry.setAgentURI(1, UPDATED_URI);

        assertEq(registry.tokenURI(1), UPDATED_URI);
    }

    function test_SetAgentURIByApprovedOperator() public {
        registry.register(TEST_URI);
        registry.setApprovalForAll(operator, true);

        vm.prank(operator);
        registry.setAgentURI(1, UPDATED_URI);

        assertEq(registry.tokenURI(1), UPDATED_URI);
    }

    function test_SetAgentURIRevertsForNonOwner() public {
        registry.register(TEST_URI);

        vm.prank(user2);
        vm.expectRevert("Not owner or approved");
        registry.setAgentURI(1, UPDATED_URI);
    }

    function test_SetAgentURIRevertsOnEmptyURI() public {
        registry.register(TEST_URI);

        vm.expectRevert("URI cannot be empty");
        registry.setAgentURI(1, "");
    }

    // ══════════════════════════════════════════════════════════════
    // Metadata Tests
    // ══════════════════════════════════════════════════════════════

    function test_SetAndGetMetadata() public {
        registry.register(TEST_URI);

        bytes memory value = abi.encode("0x1234567890abcdef");

        vm.expectEmit(true, true, false, true);
        emit MetadataSet(1, "agentWallet", value);

        registry.setMetadata(1, "agentWallet", value);

        bytes memory retrieved = registry.getMetadata(1, "agentWallet");
        assertEq(retrieved, value);
    }

    function test_SetMetadataMultipleKeys() public {
        registry.register(TEST_URI);

        bytes memory wallet = abi.encode("0xWallet");
        bytes memory dashboard = abi.encode("https://dune.com/example");

        registry.setMetadata(1, "agentWallet", wallet);
        registry.setMetadata(1, "duneDashboard", dashboard);

        assertEq(registry.getMetadata(1, "agentWallet"), wallet);
        assertEq(registry.getMetadata(1, "duneDashboard"), dashboard);
    }

    function test_SetMetadataRevertsForNonOwner() public {
        registry.register(TEST_URI);

        vm.prank(user2);
        vm.expectRevert("Not owner or approved");
        registry.setMetadata(1, "key", "value");
    }

    function test_SetMetadataByApprovedOperator() public {
        registry.register(TEST_URI);
        registry.setApprovalForAll(operator, true);

        vm.prank(operator);
        registry.setMetadata(1, "key", "value");

        assertEq(registry.getMetadata(1, "key"), "value");
    }

    function test_GetMetadataReturnsEmptyForUnsetKey() public {
        registry.register(TEST_URI);

        bytes memory result = registry.getMetadata(1, "nonexistent");
        assertEq(result.length, 0);
    }

    // ══════════════════════════════════════════════════════════════
    // tokenURI Tests
    // ══════════════════════════════════════════════════════════════

    function test_TokenURIReturnsCorrectValue() public {
        registry.register(TEST_URI);
        assertEq(registry.tokenURI(1), TEST_URI);

        registry.setAgentURI(1, UPDATED_URI);
        assertEq(registry.tokenURI(1), UPDATED_URI);
    }

    function test_TokenURIRevertsForNonexistentToken() public {
        vm.expectRevert();
        registry.tokenURI(999);
    }

    // ══════════════════════════════════════════════════════════════
    // ERC721 Standard Tests
    // ══════════════════════════════════════════════════════════════

    function test_NameAndSymbol() public view {
        assertEq(registry.name(), "DeFAI Agents");
        assertEq(registry.symbol(), "DEFAI-AGENT");
    }

    function test_TransferToken() public {
        registry.register(TEST_URI);

        registry.transferFrom(address(this), user1, 1);

        assertEq(registry.ownerOf(1), user1);
    }

    function test_TransferredOwnerCanUpdateURI() public {
        registry.register(TEST_URI);
        registry.transferFrom(address(this), user1, 1);

        vm.prank(user1);
        registry.setAgentURI(1, UPDATED_URI);

        assertEq(registry.tokenURI(1), UPDATED_URI);
    }

    function test_PreviousOwnerCannotUpdateAfterTransfer() public {
        registry.register(TEST_URI);
        registry.transferFrom(address(this), user1, 1);

        vm.expectRevert("Not owner or approved");
        registry.setAgentURI(1, UPDATED_URI);
    }
}
