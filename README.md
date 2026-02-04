# ERC-8004 Agent Identity Registry

A complete implementation of the [ERC-8004 Agent Identity](https://eips.ethereum.org/EIPS/eip-8004) standard for on-chain AI agent registration. This project provides smart contracts, a dynamic metadata backend, and tools for deploying your own agent identity system.

## 🌐 Live Deployment

| Network | Contract Address | View |
|---------|------------------|------|
| Base Mainnet | `0x2031C13F4927E3f97Eba0066BA330927A77EB540` | [BaseScan](https://basescan.org/address/0x2031c13f4927e3f97eba0066ba330927a77eb540#code) |

**Registered Agent:** Token ID #1 owned by `0xb0538910f0Abffc41F0CF701E626975E51e92bC7`

---

## 📖 What is ERC-8004?

ERC-8004 is a standard for **on-chain AI agent identity**. It allows autonomous agents (like yield optimizers, trading bots, or any DeFAI system) to have a verifiable, on-chain identity that includes:

- **Unique Agent ID** - An ERC-721 NFT representing the agent
- **Dynamic Metadata** - A tokenURI pointing to live agent stats and capabilities
- **On-chain Key-Value Store** - Optional metadata stored directly on-chain
- **Ownership & Permissions** - NFT-based access control for updates

### Why Use ERC-8004?

| Benefit | Description |
|---------|-------------|
| **Verifiability** | Prove your agent exists and is registered on-chain |
| **Discoverability** | Other protocols can query agent registries |
| **Trust** | Build reputation through on-chain history |
| **Interoperability** | Standard interface for agent-to-agent communication |
| **Dynamic NFTs** | Metadata updates in real-time with live stats |

---

## 🏗️ Project Structure

```
├── contracts/                    # Foundry smart contracts
│   ├── src/
│   │   ├── AgentIdentityRegistry.sol    # Main ERC-8004 registry
│   │   └── interfaces/
│   │       └── IERC8004Identity.sol     # ERC-8004 interface
│   ├── script/
│   │   └── Deploy.s.sol                 # Deployment script
│   └── test/
│       └── AgentIdentityRegistry.t.sol  # 19 comprehensive tests
│
├── backend/                      # TypeScript/Express metadata server
│   └── src/
│       ├── index.ts              # Server entry point
│       ├── routes/
│       │   ├── metadata.ts       # ERC-8004 JSON endpoint
│       │   └── image.ts          # Dynamic SVG generator
│       ├── services/
│       │   ├── statsService.ts   # Fetches live agent stats
│       │   ├── svgGenerator.ts   # Creates dynamic NFT image
│       │   └── updaterService.ts # Auto-updates tokenURI on-chain
│       ├── types/
│       │   └── index.ts          # TypeScript interfaces
│       └── utils/
│           └── config.ts         # Environment configuration
│
├── .env.example                  # Environment template
└── README.md                     # This file
```

---

## 🚀 Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, cast, anvil)
- [Node.js](https://nodejs.org/) v18+
- An Ethereum wallet with Base ETH for gas

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/erc8004-agent-identity.git
cd erc8004-agent-identity
```

### 2. Install Dependencies

```bash
# Install smart contract dependencies
cd contracts
forge install

# Install backend dependencies
cd ../backend
npm install
```

### 3. Configure Environment

```bash
# Copy the example environment file
cp .env.example backend/.env

# Edit with your values
nano backend/.env
```

**Required Environment Variables:**

```env
# Your deployer wallet private key (without 0x prefix works too)
DEPLOYER_PRIVATE_KEY=0x...

# Your wallet address (for AGENT_WALLET display)
AGENT_WALLET=0x...

# After deployment, fill these:
REGISTRY_ADDRESS=0x...
AGENT_ID=1
```

### 4. Run Tests

```bash
cd contracts
forge test -vvv
```

Expected output: `19 tests passed`

### 5. Deploy to Base Mainnet

```bash
cd contracts

# Deploy the registry contract
DEPLOYER_PRIVATE_KEY=0x_YOUR_KEY forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://mainnet.base.org \
  --broadcast

# Note the deployed address from the output
```

### 6. Verify Contract (Optional)

```bash
forge verify-contract YOUR_CONTRACT_ADDRESS \
  src/AgentIdentityRegistry.sol:AgentIdentityRegistry \
  --chain base \
  --etherscan-api-key YOUR_BASESCAN_API_KEY \
  --watch
```

### 7. Register Your Agent

```bash
# Set your registry address
export REGISTRY=0x_YOUR_REGISTRY_ADDRESS
export TOKEN_URI="https://your-api.com/erc8004/metadata"

# Register (mints NFT #1 to your wallet)
cast send $REGISTRY "register(string)" "$TOKEN_URI" \
  --rpc-url https://mainnet.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY
```

### 8. Start the Backend

```bash
cd backend
npm run build
npm start
```

---

## 🔍 Viewing Your Deployment

### On BaseScan

1. **View Contract:** https://basescan.org/address/YOUR_CONTRACT_ADDRESS
2. **Read Contract:** Go to "Read Contract" tab to call view functions
3. **View NFT:** Search your wallet on BaseScan to see the minted NFT

### Using Cast (Command Line)

```bash
# Get token URI for agent #1
cast call $REGISTRY "tokenURI(uint256)" 1 --rpc-url https://mainnet.base.org

# Get owner of agent #1
cast call $REGISTRY "ownerOf(uint256)" 1 --rpc-url https://mainnet.base.org

# Get next agent ID (shows total registered + 1)
cast call $REGISTRY "nextAgentId()" --rpc-url https://mainnet.base.org

# Get NFT name and symbol
cast call $REGISTRY "name()" --rpc-url https://mainnet.base.org
cast call $REGISTRY "symbol()" --rpc-url https://mainnet.base.org

# Read on-chain metadata
cast call $REGISTRY "getMetadata(uint256,string)" 1 "agentWallet" --rpc-url https://mainnet.base.org
```

### Using the Backend API

```bash
# Health check
curl http://localhost:3001/erc8004/health

# Get ERC-8004 metadata JSON
curl http://localhost:3001/erc8004/metadata

# Get dynamic SVG image
curl http://localhost:3001/erc8004/image.svg > agent-card.svg
```

---

## ⚡ Available Functions

### Smart Contract Functions

| Function | Description | Access |
|----------|-------------|--------|
| `register(tokenURI)` | Register a new agent, mints NFT | Anyone |
| `setAgentURI(agentId, newURI)` | Update agent's metadata URI | Owner/Approved |
| `setMetadata(agentId, key, value)` | Store on-chain key-value data | Owner/Approved |
| `getMetadata(agentId, key)` | Read on-chain metadata | Anyone |
| `tokenURI(agentId)` | Get metadata URI for agent | Anyone |
| `ownerOf(agentId)` | Get NFT owner address | Anyone |
| `nextAgentId()` | Get next available agent ID | Anyone |

### Backend API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/erc8004/health` | GET | Health check with config info |
| `/erc8004/metadata` | GET | ERC-8004 compliant JSON metadata |
| `/erc8004/image.svg` | GET | Dynamic SVG agent card |
| `/erc8004/admin/force-update` | POST | Trigger on-chain URI update (requires API key) |

---

## 🛠️ Post-Deployment Operations

### Update Token URI

When your metadata endpoint changes or you want to bust caches:

```bash
cast send $REGISTRY "setAgentURI(uint256,string)" 1 "https://new-api.com/metadata?v=2" \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

### Store On-Chain Metadata

Store important data directly on-chain (survives even if your server goes down):

```bash
# Store agent wallet address
cast send $REGISTRY "setMetadata(uint256,string,bytes)" 1 "agentWallet" \
  $(cast --to-bytes32 "0xYourAgentWallet") \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY

# Store version info
cast send $REGISTRY "setMetadata(uint256,string,bytes)" 1 "version" \
  $(cast --to-bytes32 "v1.0.0") \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

### Transfer Agent Ownership

Transfer your agent NFT to another wallet:

```bash
cast send $REGISTRY "transferFrom(address,address,uint256)" \
  $YOUR_ADDRESS $NEW_OWNER_ADDRESS 1 \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

### Approve Operator

Allow another address to manage your agent:

```bash
# Approve specific address for token #1
cast send $REGISTRY "approve(address,uint256)" $OPERATOR_ADDRESS 1 \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY

# Or approve for all your tokens
cast send $REGISTRY "setApprovalForAll(address,bool)" $OPERATOR_ADDRESS true \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

### Register Additional Agents

You can register multiple agents from the same or different wallets:

```bash
# Register agent #2
cast send $REGISTRY "register(string)" "https://api.example.com/agent2/metadata" \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

---

## 📊 ERC-8004 Metadata Format

The `/erc8004/metadata` endpoint returns JSON conforming to the ERC-8004 spec:

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "DeFAI Yield Agent",
  "description": "Non-custodial DeFAI yield agent on Base...",
  "image": "https://api.example.com/erc8004/image.svg",
  "services": [
    {
      "name": "web",
      "endpoint": "https://example.com"
    },
    {
      "name": "stats-api",
      "endpoint": "https://api.example.com/api/summary/daily"
    }
  ],
  "registrations": [
    {
      "agentRegistry": "eip155:8453:0x2031C13F4927E3f97Eba0066BA330927A77EB540",
      "agentId": 1
    }
  ],
  "supportedTrust": ["reputation"],
  "agentWallet": {
    "eip155:8453": "0xb0538910f0Abffc41F0CF701E626975E51e92bC7"
  }
}
```

---

## 🔄 Auto-Updater Service

The backend includes an auto-updater that periodically calls `setAgentURI()` on-chain to:

1. **Bust indexer caches** - NFT marketplaces cache metadata; updating the URI forces a refresh
2. **Add timestamps** - Appends `?v=timestamp` to prove liveness

Configure in `.env`:

```env
UPDATE_INTERVAL_HOURS=6        # How often to update
UPDATER_PRIVATE_KEY=0x...      # Key with permission to update
```

---

## 🎨 Dynamic SVG Agent Card

The `/erc8004/image.svg` endpoint generates a live SVG showing:

- Agent name and chain
- TVL, vaults deployed, APY
- Total rebalances and uptime
- Protocol badges (Morpho, Aerodrome, etc.)
- Last updated timestamp
- Live indicator animation

This SVG is what NFT marketplaces display as your agent's image.

---

## 🔐 Security Considerations

1. **Private Keys** - Never commit `.env` files with real keys
2. **Updater Wallet** - Use a separate hot wallet with minimal funds for auto-updates
3. **Admin API Key** - Protect the `/admin/force-update` endpoint
4. **URI Validation** - The contract requires non-empty URIs

---

## 🧪 Running Tests

```bash
cd contracts

# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test test_RegisterMintsAndEmitsEvent

# Gas report
forge test --gas-report
```

**Test Coverage:**
- Registration (mint, events, validation)
- URI updates (owner, approved, operator permissions)
- On-chain metadata (set, get, permissions)
- ERC-721 standard (transfers, approvals, name/symbol)

---

## 📁 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Backend server port | No (default: 3001) |
| `BASE_URL` | Public URL of your backend | Yes |
| `RPC_URL` | Ethereum RPC endpoint | No (default: Base mainnet) |
| `CHAIN_ID` | Chain ID | No (default: 8453) |
| `CHAIN_NAME` | Display name for chain | No (default: Base) |
| `REGISTRY_ADDRESS` | Deployed contract address | Yes |
| `AGENT_ID` | Your agent's token ID | Yes |
| `UPDATER_PRIVATE_KEY` | Key for auto-updates | For auto-updater |
| `AGENT_WALLET` | Agent's operational wallet | No |
| `STATS_API_URL` | External stats data source | No |
| `AGENT_NAME` | Display name for agent | No |
| `WEBSITE_URL` | Agent's website | No |
| `DUNE_URL` | Dune dashboard URL | No |
| `UPDATE_INTERVAL_HOURS` | Auto-update frequency | No (default: 6) |
| `ADMIN_API_KEY` | Protects admin endpoints | For admin API |
| `DEPLOYER_PRIVATE_KEY` | For deployment | For deployment |
| `BASESCAN_API_KEY` | For contract verification | For verification |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🔗 Resources

- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004)
- [Foundry Book](https://book.getfoundry.sh/)
- [Base Documentation](https://docs.base.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)

---

## 💬 Support

- Open an issue for bugs or feature requests
- Star the repo if you find it useful!
