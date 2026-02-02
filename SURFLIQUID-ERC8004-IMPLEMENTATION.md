# SurfLiquid ERC-8004 Dynamic Agent Identity — Implementation Spec

> **Purpose**: This document is a complete implementation guide for Claude Code (or any developer) to build, deploy, and operate SurfLiquid's ERC-8004 agent identity on Base mainnet with a dynamically updating NFT that reflects live protocol stats.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Smart Contracts](#3-smart-contracts)
4. [Backend: Metadata Server](#4-backend-metadata-server)
5. [Backend: Dynamic SVG Image Generator](#5-backend-dynamic-svg-image-generator)
6. [Backend: Auto-Updater Service](#6-backend-auto-updater-service)
7. [Deployment Flow](#7-deployment-flow)
8. [Environment Config](#8-environment-config)
9. [Testing Checklist](#9-testing-checklist)
10. [Mainnet Go-Live Checklist](#10-mainnet-go-live-checklist)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         BASE MAINNET                             │
│                                                                  │
│  ┌─────────────────────┐     ┌──────────────────────────────┐   │
│  │  ERC-8004 Identity   │     │  SurfLiquid Vault Factory    │   │
│  │  Registry            │     │  + Vault Contracts           │   │
│  │  (deploy our own OR  │     │  (already deployed)          │   │
│  │   use official when  │     └──────────────────────────────┘   │
│  │   available on Base) │                                        │
│  └──────┬───────────────┘                                        │
│         │ tokenURI points to ↓                                   │
└─────────┼────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                    YOUR BACKEND SERVER                            │
│                                                                  │
│  ┌────────────────────┐  ┌─────────────────────┐                │
│  │  Metadata Endpoint  │  │  SVG Image Endpoint  │               │
│  │  /erc8004/metadata  │  │  /erc8004/image.svg  │               │
│  │                     │  │                      │                │
│  │  Returns ERC-8004   │  │  Returns dynamic     │               │
│  │  registration JSON  │  │  agent card image     │               │
│  │  with live stats    │  │  with live stats      │               │
│  └─────────┬──────────┘  └──────────┬───────────┘               │
│            │                        │                            │
│            ▼                        ▼                            │
│  ┌──────────────────────────────────────────────┐               │
│  │  Data Sources:                                │               │
│  │  1. api.surfliquid.com/api/summary/daily      │               │
│  │  2. On-chain reads (vault count, TVL)         │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  ┌──────────────────────────────────────────────┐               │
│  │  Auto-Updater (cron / setInterval)            │               │
│  │  Every N hours: calls setAgentURI() on-chain  │               │
│  │  to bump the tokenURI (cache-bust or version) │               │
│  └──────────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Dynamic metadata via HTTPS endpoint** — NOT IPFS. Since we want the NFT to always show fresh stats, the `tokenURI` points to an HTTPS endpoint on your server that generates metadata on-the-fly from your existing API. No need to re-pin to IPFS every time.

2. **On-chain tokenURI update is optional per refresh** — The metadata endpoint itself returns fresh data on every request. However, some NFT indexers cache aggressively, so we include an auto-updater that calls `setAgentURI()` with a cache-busting query param (e.g., `?v=timestamp`) periodically to force re-indexing.

3. **SVG image generated server-side** — The NFT image is an SVG rendered by your server with current stats baked in. This means any wallet or explorer that loads the image sees live numbers. No external image hosting needed.

4. **Test-first on mainnet** — Deploy as a test registration first. Once verified, update `.env` to point to production contracts/wallets. The code doesn't change — only config.

---

## 2. Project Structure

```
surfliquid-erc8004/
├── contracts/
│   ├── src/
│   │   ├── SurfLiquidIdentityRegistry.sol    # Our ERC-8004 identity registry
│   │   └── interfaces/
│   │       └── IERC8004Identity.sol           # Interface
│   ├── script/
│   │   └── Deploy.s.sol                       # Foundry deployment script
│   ├── test/
│   │   └── SurfLiquidIdentityRegistry.t.sol   # Contract tests
│   ├── foundry.toml
│   └── .env                                   # Contract deployment env
│
├── backend/
│   ├── src/
│   │   ├── index.ts                           # Express server entry
│   │   ├── routes/
│   │   │   ├── metadata.ts                    # GET /erc8004/metadata
│   │   │   └── image.ts                       # GET /erc8004/image.svg
│   │   ├── services/
│   │   │   ├── statsService.ts                # Fetches from your API + on-chain
│   │   │   ├── svgGenerator.ts                # Generates dynamic SVG agent card
│   │   │   └── updaterService.ts              # Periodic on-chain tokenURI updater
│   │   ├── utils/
│   │   │   ├── onchain.ts                     # ethers.js provider + contract instances
│   │   │   └── config.ts                      # Loads .env, exports typed config
│   │   └── types/
│   │       └── index.ts                       # TypeScript types
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                                   # Backend env
│
├── .env.example                               # Template for both
└── README.md
```

---

## 3. Smart Contracts

### 3A. Decision: Deploy Our Own vs Use Official Singleton

ERC-8004 intends for **one singleton Identity Registry per chain**. As of now, the official Base mainnet singleton may or may not be deployed yet. 

**Approach**: Deploy our own minimal ERC-8004 compliant Identity Registry on Base mainnet. If/when an official singleton is deployed on Base, we can re-register there and update our tokenURI to point to the same metadata endpoint. Our registry is a simple ERC-721 + URI storage — lightweight and cheap.

### 3B. SurfLiquidIdentityRegistry.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SurfLiquid ERC-8004 Identity Registry
 * @notice Minimal ERC-8004 compliant identity registry for SurfLiquid agents.
 *         Each agent gets an ERC-721 token whose tokenURI points to an
 *         ERC-8004 registration JSON file.
 *
 * @dev Follows the ERC-8004 spec:
 *      - register(tokenURI) → mints NFT, emits Registered
 *      - setAgentURI(agentId, newURI) → updates tokenURI, only owner/approved
 *      - setMetadata(agentId, key, value) → optional on-chain kv store
 *      - getMetadata(agentId, key) → read on-chain metadata
 */
contract SurfLiquidIdentityRegistry is ERC721URIStorage, Ownable, ReentrancyGuard {

    uint256 private _nextAgentId = 1;

    // Optional on-chain key-value metadata per agent
    // agentId => key => value
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    // ── Events (ERC-8004 compliant) ──────────────────────────────
    event Registered(
        uint256 indexed agentId,
        string tokenURI,
        address indexed owner
    );

    event AgentURIUpdated(
        uint256 indexed agentId,
        string newURI
    );

    event MetadataSet(
        uint256 indexed agentId,
        string indexed key,
        bytes value
    );

    // ── Constructor ──────────────────────────────────────────────
    constructor()
        ERC721("SurfLiquid Agents", "SURF-AGENT")
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
    function setAgentURI(uint256 agentId, string calldata newURI) external {
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
    ) external {
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
        returns (bytes memory)
    {
        return _metadata[agentId][key];
    }

    /**
     * @notice Get the next agent ID that will be assigned.
     */
    function nextAgentId() external view returns (uint256) {
        return _nextAgentId;
    }
}
```

### 3C. Deploy.s.sol (Foundry)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SurfLiquidIdentityRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        SurfLiquidIdentityRegistry registry = new SurfLiquidIdentityRegistry();

        console.log("Registry deployed at:", address(registry));

        vm.stopBroadcast();
    }
}
```

### 3D. foundry.toml

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.20"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
base_mainnet = "${BASE_MAINNET_RPC_URL}"
base_sepolia = "${BASE_SEPOLIA_RPC_URL}"

[etherscan]
base_mainnet = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
```

### 3E. Contract .env

```bash
# contracts/.env
DEPLOYER_PRIVATE_KEY=0x...         # Private key that deploys the registry
BASE_MAINNET_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=your_basescan_key
```

### 3F. Deploy Commands

```bash
cd contracts

# Install OpenZeppelin
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# Add remapping
echo "@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/" > remappings.txt

# Deploy to Base mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $BASE_MAINNET_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify

# Save the deployed address → put it in backend/.env as REGISTRY_ADDRESS
```

### 3G. Register the Agent (one-time, after deploy)

```bash
# After deploying, register SurfLiquid's agent
# tokenURI points to our backend metadata endpoint

export REGISTRY_ADDRESS=0x...DEPLOYED_ADDRESS
export AGENT_TOKEN_URI="https://api.surfliquid.com/erc8004/metadata"

cast send $REGISTRY_ADDRESS \
  "register(string)" \
  "$AGENT_TOKEN_URI" \
  --rpc-url $BASE_MAINNET_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY

# Note the agentId from the tx receipt (will be 1 for first registration)
# Save this as AGENT_ID in backend/.env
```

### 3H. Set On-Chain Metadata (one-time, after register)

```bash
# Store the backend agent's operational wallet address on-chain
cast send $REGISTRY_ADDRESS \
  "setMetadata(uint256,string,bytes)" \
  1 \
  "agentWallet" \
  $(cast --from-utf8 "0xYOUR_BACKEND_AGENT_WALLET") \
  --rpc-url $BASE_MAINNET_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY

# Store the Dune dashboard link on-chain for easy discovery
cast send $REGISTRY_ADDRESS \
  "setMetadata(uint256,string,bytes)" \
  1 \
  "duneDashboard" \
  $(cast --from-utf8 "https://dune.com/surfliquid/stats") \
  --rpc-url $BASE_MAINNET_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY
```

---

## 4. Backend: Metadata Server

### 4A. package.json

```json
{
  "name": "surfliquid-erc8004-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ethers": "^6.9.0",
    "dotenv": "^16.3.1",
    "node-cron": "^3.0.3",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/node-cron": "^3.0.11",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.0"
  }
}
```

### 4B. src/utils/config.ts

```typescript
import dotenv from "dotenv";
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || "3001"),
  baseUrl: process.env.BASE_URL || "https://api.surfliquid.com",

  // Chain
  rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
  chainId: parseInt(process.env.CHAIN_ID || "8453"),
  chainName: process.env.CHAIN_NAME || "Base",

  // Contracts
  registryAddress: process.env.REGISTRY_ADDRESS || "",
  agentId: parseInt(process.env.AGENT_ID || "1"),

  // Wallet (for auto-updater to call setAgentURI)
  updaterPrivateKey: process.env.UPDATER_PRIVATE_KEY || "",

  // SurfLiquid data source
  surfliquidApiUrl:
    process.env.SURFLIQUID_API_URL ||
    "https://api.surfliquid.com/api/summary/daily",

  // Agent info
  agentName: process.env.AGENT_NAME || "SurfLiquid Yield Agent",
  agentWallet: process.env.AGENT_WALLET || "",
  websiteUrl: process.env.WEBSITE_URL || "https://surfliquid.com",
  duneUrl:
    process.env.DUNE_URL || "https://dune.com/surfliquid/stats",

  // Update interval in hours
  updateIntervalHours: parseInt(
    process.env.UPDATE_INTERVAL_HOURS || "6"
  ),
};
```

### 4C. src/types/index.ts

```typescript
export interface SurfLiquidStats {
  tvl: string;               // e.g., "$36,420"
  totalVaults: number;        // e.g., 145
  activeVaults: number;       // e.g., 132
  totalRebalances: number;    // e.g., 2,340
  last24hRebalances: number;  // e.g., 24
  avgApy: string;             // e.g., "8.2%"
  totalDeposited: string;     // e.g., "$142,000"
  totalWithdrawn: string;     // e.g., "$105,580"
  protocolsUsed: string[];    // e.g., ["Morpho", "Aerodrome", "Merkl"]
  lastRebalanceAt: string;    // ISO timestamp
  uptimePercent: string;      // e.g., "99.8%"
  lastUpdated: string;        // ISO timestamp
}

export interface ERC8004Registration {
  type: string;
  name: string;
  description: string;
  image: string;
  services: Array<{
    name: string;
    endpoint: string;
    version?: string;
  }>;
  registrations: Array<{
    agentRegistry: string;
    agentId: number;
  }>;
  supportedTrust: string[];
  agentWallet?: Record<string, string>;
}
```

### 4D. src/services/statsService.ts

This service fetches live stats from your existing SurfLiquid API. Adapt the parsing to match your actual `/api/summary/daily` response shape.

```typescript
import axios from "axios";
import { config } from "../utils/config";
import { SurfLiquidStats } from "../types";

// In-memory cache with TTL
let cachedStats: SurfLiquidStats | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches live stats from the SurfLiquid daily summary API.
 *
 * IMPORTANT: Adapt the response parsing below to match the actual
 * shape of your /api/summary/daily endpoint. The fields below are
 * best guesses based on known SurfLiquid metrics. Replace with
 * your actual field names.
 */
export async function getStats(): Promise<SurfLiquidStats> {
  const now = Date.now();

  // Return cached if fresh
  if (cachedStats && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedStats;
  }

  try {
    const response = await axios.get(config.surfliquidApiUrl, {
      timeout: 10000,
    });

    const data = response.data;

    // ──────────────────────────────────────────────────────────
    // TODO: ADAPT THIS MAPPING TO YOUR ACTUAL API RESPONSE
    // The field names below are placeholders. Replace them with
    // whatever your /api/summary/daily actually returns.
    //
    // Example: if your API returns { total_tvl_usd: 36420, ... }
    // then map it like: tvl: `$${data.total_tvl_usd.toLocaleString()}`
    // ──────────────────────────────────────────────────────────

    const stats: SurfLiquidStats = {
      tvl: formatUsd(data.tvl ?? data.total_tvl ?? 0),
      totalVaults: data.total_vaults ?? data.vault_count ?? 0,
      activeVaults: data.active_vaults ?? data.total_vaults ?? 0,
      totalRebalances: data.total_rebalances ?? 0,
      last24hRebalances: data.rebalances_24h ?? 0,
      avgApy: formatPercent(data.avg_apy ?? data.apy ?? 0),
      totalDeposited: formatUsd(data.total_deposited ?? 0),
      totalWithdrawn: formatUsd(data.total_withdrawn ?? 0),
      protocolsUsed: data.protocols ?? [
        "Morpho",
        "Aerodrome",
        "Merkl",
      ],
      lastRebalanceAt:
        data.last_rebalance_at ?? new Date().toISOString(),
      uptimePercent: formatPercent(data.uptime ?? 99.8),
      lastUpdated: new Date().toISOString(),
    };

    cachedStats = stats;
    cacheTimestamp = now;
    return stats;
  } catch (error) {
    console.error("Failed to fetch SurfLiquid stats:", error);

    // Return cached data if available, otherwise fallback
    if (cachedStats) return cachedStats;

    return getFallbackStats();
  }
}

function formatUsd(value: number): string {
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatPercent(value: number): string {
  return `${Number(value).toFixed(1)}%`;
}

function getFallbackStats(): SurfLiquidStats {
  return {
    tvl: "—",
    totalVaults: 0,
    activeVaults: 0,
    totalRebalances: 0,
    last24hRebalances: 0,
    avgApy: "—",
    totalDeposited: "—",
    totalWithdrawn: "—",
    protocolsUsed: ["Morpho", "Aerodrome", "Merkl"],
    lastRebalanceAt: "—",
    uptimePercent: "—",
    lastUpdated: new Date().toISOString(),
  };
}
```

### 4E. src/routes/metadata.ts

This is the main endpoint that the on-chain `tokenURI` points to. Any wallet, marketplace, or agent explorer that reads the NFT will hit this URL and get fresh ERC-8004 registration JSON.

```typescript
import { Router } from "express";
import { config } from "../utils/config";
import { getStats } from "../services/statsService";
import { ERC8004Registration } from "../types";

const router = Router();

/**
 * GET /erc8004/metadata
 *
 * Returns ERC-8004 compliant registration JSON with live stats.
 * This is what the on-chain tokenURI points to.
 */
router.get("/metadata", async (req, res) => {
  try {
    const stats = await getStats();

    const metadata: ERC8004Registration = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",

      name: config.agentName,

      description: [
        `Non-custodial DeFAI yield agent on ${config.chainName}.`,
        `Deploys individual USDC vaults via factory contracts,`,
        `allocates across Morpho lending pools and Aerodrome LP positions,`,
        `auto-rebalances every 12 hours, and compounds Merkl rewards.`,
        ``,
        `Live Stats:`,
        `• TVL: ${stats.tvl}`,
        `• Vaults: ${stats.totalVaults} deployed (${stats.activeVaults} active)`,
        `• Avg APY: ${stats.avgApy}`,
        `• Total Rebalances: ${stats.totalRebalances}`,
        `• Uptime: ${stats.uptimePercent}`,
        `• Last Rebalance: ${stats.lastRebalanceAt}`,
        ``,
        `All operations are on-chain and auditable.`,
        `On-chain proof: ${config.duneUrl}`,
      ].join("\n"),

      // Dynamic SVG image — always fresh
      image: `${config.baseUrl}/erc8004/image.svg`,

      services: [
        {
          name: "web",
          endpoint: config.websiteUrl,
        },
        {
          name: "stats-api",
          endpoint: config.surfliquidApiUrl,
        },
        {
          name: "onchain-proof",
          endpoint: config.duneUrl,
        },
      ],

      registrations: [
        {
          agentRegistry: `eip155:${config.chainId}:${config.registryAddress}`,
          agentId: config.agentId,
        },
      ],

      supportedTrust: ["reputation"],

      agentWallet: {
        [`eip155:${config.chainId}`]: config.agentWallet,
      },
    };

    res.setHeader("Content-Type", "application/json");
    // Allow caching for 5 min so we don't hammer the stats API,
    // but short enough that data stays fresh
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(metadata);
  } catch (error) {
    console.error("Error generating metadata:", error);
    res.status(500).json({ error: "Failed to generate metadata" });
  }
});

export default router;
```

---

## 5. Backend: Dynamic SVG Image Generator

This generates the NFT image — a clean agent card with live stats. SVG is perfect because it's text-based, easily templated, and renders crisp at any size.

### 5A. src/services/svgGenerator.ts

```typescript
import { SurfLiquidStats } from "../types";
import { config } from "../utils/config";

/**
 * Generates a dynamic SVG agent card with live protocol stats.
 * This SVG is what wallets and NFT explorers render as the NFT image.
 */
export function generateAgentCardSvg(stats: SurfLiquidStats): string {
  // Format the last updated time nicely
  const updatedAt = new Date(stats.lastUpdated);
  const updatedStr = updatedAt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <defs>
    <!-- Background gradient — ocean/surf theme -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a1628;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#0f2847;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a3a5c;stop-opacity:1" />
    </linearGradient>

    <!-- Accent gradient for stat cards -->
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:0.15" />
      <stop offset="100%" style="stop-color:#0099ff;stop-opacity:0.08" />
    </linearGradient>

    <!-- Glow effect -->
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="800" height="500" rx="16" fill="url(#bg)" />

  <!-- Subtle border -->
  <rect width="798" height="498" x="1" y="1" rx="15" fill="none"
        stroke="#00d4ff" stroke-opacity="0.2" stroke-width="1" />

  <!-- Header section -->
  <text x="40" y="52" font-family="monospace, 'Courier New'" font-size="14"
        fill="#00d4ff" opacity="0.6" letter-spacing="3">ERC-8004 AGENT IDENTITY</text>

  <!-- Surf emoji + Agent name -->
  <text x="40" y="90" font-family="Arial, Helvetica, sans-serif" font-size="28"
        fill="#ffffff" font-weight="bold">🏄 ${escapeXml(config.agentName)}</text>

  <!-- Chain badge -->
  <rect x="40" y="105" width="130" height="26" rx="13" fill="#0052ff" opacity="0.3" />
  <text x="60" y="123" font-family="Arial, sans-serif" font-size="13"
        fill="#4d9fff" font-weight="600">⬟ ${escapeXml(config.chainName)} Mainnet</text>

  <!-- Protocol badges -->
  <rect x="180" y="105" width="72" height="26" rx="13" fill="#00d4ff" opacity="0.1" />
  <text x="192" y="123" font-family="Arial, sans-serif" font-size="12"
        fill="#00d4ff">Morpho</text>
  <rect x="260" y="105" width="90" height="26" rx="13" fill="#00d4ff" opacity="0.1" />
  <text x="272" y="123" font-family="Arial, sans-serif" font-size="12"
        fill="#00d4ff">Aerodrome</text>
  <rect x="358" y="105" width="64" height="26" rx="13" fill="#00d4ff" opacity="0.1" />
  <text x="370" y="123" font-family="Arial, sans-serif" font-size="12"
        fill="#00d4ff">Merkl</text>

  <!-- Divider line -->
  <line x1="40" y1="148" x2="760" y2="148" stroke="#00d4ff" stroke-opacity="0.15" />

  <!-- Stats Grid — Row 1 -->
  <!-- TVL -->
  <rect x="40" y="165" width="230" height="80" rx="10" fill="url(#accent)" />
  <text x="60" y="195" font-family="Arial, sans-serif" font-size="12"
        fill="#7eb8d0" letter-spacing="1">TVL</text>
  <text x="60" y="228" font-family="Arial, sans-serif" font-size="28"
        fill="#ffffff" font-weight="bold" filter="url(#glow)">${escapeXml(stats.tvl)}</text>

  <!-- Vaults -->
  <rect x="285" y="165" width="230" height="80" rx="10" fill="url(#accent)" />
  <text x="305" y="195" font-family="Arial, sans-serif" font-size="12"
        fill="#7eb8d0" letter-spacing="1">VAULTS DEPLOYED</text>
  <text x="305" y="228" font-family="Arial, sans-serif" font-size="28"
        fill="#ffffff" font-weight="bold">${stats.totalVaults}</text>
  <text x="370" y="228" font-family="Arial, sans-serif" font-size="14"
        fill="#7eb8d0"> (${stats.activeVaults} active)</text>

  <!-- APY -->
  <rect x="530" y="165" width="230" height="80" rx="10" fill="url(#accent)" />
  <text x="550" y="195" font-family="Arial, sans-serif" font-size="12"
        fill="#7eb8d0" letter-spacing="1">AVG APY</text>
  <text x="550" y="228" font-family="Arial, sans-serif" font-size="28"
        fill="#00ff88" font-weight="bold">${escapeXml(stats.avgApy)}</text>

  <!-- Stats Grid — Row 2 -->
  <!-- Rebalances -->
  <rect x="40" y="260" width="230" height="80" rx="10" fill="url(#accent)" />
  <text x="60" y="290" font-family="Arial, sans-serif" font-size="12"
        fill="#7eb8d0" letter-spacing="1">TOTAL REBALANCES</text>
  <text x="60" y="323" font-family="Arial, sans-serif" font-size="28"
        fill="#ffffff" font-weight="bold">${stats.totalRebalances.toLocaleString()}</text>

  <!-- 24h Rebalances -->
  <rect x="285" y="260" width="230" height="80" rx="10" fill="url(#accent)" />
  <text x="305" y="290" font-family="Arial, sans-serif" font-size="12"
        fill="#7eb8d0" letter-spacing="1">24H REBALANCES</text>
  <text x="305" y="323" font-family="Arial, sans-serif" font-size="28"
        fill="#ffffff" font-weight="bold">${stats.last24hRebalances}</text>

  <!-- Uptime -->
  <rect x="530" y="260" width="230" height="80" rx="10" fill="url(#accent)" />
  <text x="550" y="290" font-family="Arial, sans-serif" font-size="12"
        fill="#7eb8d0" letter-spacing="1">UPTIME</text>
  <text x="550" y="323" font-family="Arial, sans-serif" font-size="28"
        fill="#00ff88" font-weight="bold">${escapeXml(stats.uptimePercent)}</text>

  <!-- Divider line -->
  <line x1="40" y1="358" x2="760" y2="358" stroke="#00d4ff" stroke-opacity="0.15" />

  <!-- Proof links section -->
  <text x="40" y="385" font-family="Arial, sans-serif" font-size="12"
        fill="#7eb8d0" letter-spacing="1">ON-CHAIN PROOF</text>
  <text x="40" y="408" font-family="monospace, 'Courier New'" font-size="14"
        fill="#00d4ff">dune.com/surfliquid/stats</text>

  <text x="400" y="385" font-family="Arial, sans-serif" font-size="12"
        fill="#7eb8d0" letter-spacing="1">REBALANCE CYCLE</text>
  <text x="400" y="408" font-family="monospace, 'Courier New'" font-size="14"
        fill="#ffffff">Every 12 hours</text>

  <!-- Footer -->
  <text x="40" y="465" font-family="monospace, 'Courier New'" font-size="11"
        fill="#4a6a80">Agent ID: #${config.agentId} • Registry: ${truncateAddress(config.registryAddress)}</text>

  <text x="40" y="483" font-family="monospace, 'Courier New'" font-size="11"
        fill="#4a6a80">Last updated: ${escapeXml(updatedStr)}</text>

  <!-- Live indicator -->
  <circle cx="735" cy="475" r="5" fill="#00ff88" opacity="0.8">
    <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
  </circle>
  <text x="746" y="480" font-family="Arial, sans-serif" font-size="11"
        fill="#00ff88">LIVE</text>
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
```

### 5B. src/routes/image.ts

```typescript
import { Router } from "express";
import { getStats } from "../services/statsService";
import { generateAgentCardSvg } from "../services/svgGenerator";

const router = Router();

/**
 * GET /erc8004/image.svg
 *
 * Returns a dynamically generated SVG agent card with live stats.
 * This is what the NFT metadata `image` field points to.
 */
router.get("/image.svg", async (req, res) => {
  try {
    const stats = await getStats();
    const svg = generateAgentCardSvg(stats);

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=300"); // 5 min cache
    res.send(svg);
  } catch (error) {
    console.error("Error generating SVG:", error);
    res.status(500).send("Error generating image");
  }
});

export default router;
```

---

## 6. Backend: Auto-Updater Service

The metadata endpoint always returns fresh data, but NFT indexers (OpenSea, etc.) cache tokenURIs aggressively. This service periodically calls `setAgentURI()` on-chain with a cache-busting version parameter to force re-indexing.

### 6A. src/services/updaterService.ts

```typescript
import { ethers } from "ethers";
import cron from "node-cron";
import { config } from "../utils/config";

// Minimal ABI — only what we need
const REGISTRY_ABI = [
  "function setAgentURI(uint256 agentId, string calldata newURI) external",
  "function tokenURI(uint256 tokenId) external view returns (string)",
];

let provider: ethers.JsonRpcProvider;
let wallet: ethers.Wallet;
let registry: ethers.Contract;

/**
 * Initialize the on-chain updater.
 * Call this once at server startup.
 */
export function initUpdater() {
  if (!config.updaterPrivateKey || !config.registryAddress) {
    console.warn(
      "⚠️  Updater not configured — skipping auto-update setup.",
      "Set UPDATER_PRIVATE_KEY and REGISTRY_ADDRESS in .env"
    );
    return;
  }

  provider = new ethers.JsonRpcProvider(config.rpcUrl);
  wallet = new ethers.Wallet(config.updaterPrivateKey, provider);
  registry = new ethers.Contract(
    config.registryAddress,
    REGISTRY_ABI,
    wallet
  );

  console.log(
    `✅ Auto-updater initialized. Will update every ${config.updateIntervalHours}h`
  );
  console.log(`   Updater wallet: ${wallet.address}`);
  console.log(`   Registry: ${config.registryAddress}`);
  console.log(`   Agent ID: ${config.agentId}`);

  // Schedule the cron job
  // Convert hours to cron expression: "0 */N * * *" = every N hours
  const cronExpression = `0 */${config.updateIntervalHours} * * *`;

  cron.schedule(cronExpression, async () => {
    await updateTokenURI();
  });

  // Also run once at startup (after a short delay to let server warm up)
  setTimeout(() => updateTokenURI(), 10000);
}

/**
 * Calls setAgentURI() on-chain with a cache-busting version.
 *
 * The base URL stays the same (our metadata endpoint) — we just
 * append a version query param so indexers see it as a "new" URI
 * and re-fetch the metadata.
 */
async function updateTokenURI() {
  try {
    const version = Math.floor(Date.now() / 1000);
    const newURI = `${config.baseUrl}/erc8004/metadata?v=${version}`;

    console.log(`🔄 Updating tokenURI for agent #${config.agentId}...`);
    console.log(`   New URI: ${newURI}`);

    // Check current gas price to avoid overpaying
    const feeData = await provider.getFeeData();
    console.log(
      `   Gas price: ${ethers.formatUnits(
        feeData.gasPrice ?? 0,
        "gwei"
      )} gwei`
    );

    const tx = await registry.setAgentURI(config.agentId, newURI, {
      // Base mainnet gas is very cheap, but set a reasonable cap
      gasLimit: 100000,
    });

    console.log(`   Tx submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(
      `   ✅ Confirmed in block ${receipt?.blockNumber} (gas used: ${receipt?.gasUsed})`
    );
  } catch (error) {
    console.error("❌ Failed to update tokenURI:", error);

    // Don't crash the server — just log and retry next interval
  }
}

/**
 * Manually trigger an update (for admin endpoints or testing).
 */
export async function triggerUpdate(): Promise<string> {
  await updateTokenURI();
  return "Update triggered";
}
```

### 6B. Gas Cost Estimate

On Base mainnet, `setAgentURI()` is a simple storage write — roughly 50-80k gas. At Base's typical gas prices (~0.001-0.01 gwei), this costs **< $0.01 per update**. Even updating every 6 hours, monthly cost is negligible.

---

## 7. Backend: Server Entry Point

### 7A. src/index.ts

```typescript
import express from "express";
import { config } from "./utils/config";
import metadataRouter from "./routes/metadata";
import imageRouter from "./routes/image";
import { initUpdater, triggerUpdate } from "./services/updaterService";

const app = express();

// ── Health check ─────────────────────────────────────────────
app.get("/erc8004/health", (req, res) => {
  res.json({
    status: "ok",
    agentId: config.agentId,
    registry: config.registryAddress,
    chain: config.chainName,
    chainId: config.chainId,
  });
});

// ── ERC-8004 endpoints ───────────────────────────────────────
app.use("/erc8004", metadataRouter);
app.use("/erc8004", imageRouter);

// ── Admin: force update (protect this in production) ─────────
app.post("/erc8004/admin/force-update", async (req, res) => {
  // TODO: Add auth middleware (API key, IP whitelist, etc.)
  try {
    const result = await triggerUpdate();
    res.json({ status: "ok", result });
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
});

// ── Start server ─────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`\n🏄 SurfLiquid ERC-8004 Agent Server`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Chain: ${config.chainName} (${config.chainId})`);
  console.log(`   Metadata: ${config.baseUrl}/erc8004/metadata`);
  console.log(`   Image: ${config.baseUrl}/erc8004/image.svg`);
  console.log(`   Dune: ${config.duneUrl}`);
  console.log();

  // Initialize the auto-updater (periodic on-chain tokenURI refresh)
  initUpdater();
});
```

---

## 8. Environment Config

### 8A. .env.example

```bash
# ═══════════════════════════════════════════════════════════════
# SurfLiquid ERC-8004 Agent Configuration
# ═══════════════════════════════════════════════════════════════

# ── Server ────────────────────────────────────────────────────
PORT=3001
BASE_URL=https://api.surfliquid.com    # Public URL where this server is reachable

# ── Chain Config ──────────────────────────────────────────────
# For test deployment (still on mainnet, just test token):
RPC_URL=https://mainnet.base.org
CHAIN_ID=8453
CHAIN_NAME=Base

# ── Contract Addresses ────────────────────────────────────────
# Fill these after deploying the registry contract (Step 3F)
REGISTRY_ADDRESS=0x...
AGENT_ID=1                              # Assigned after register() call

# ── Wallets ───────────────────────────────────────────────────
# The private key used to call setAgentURI() for auto-updates.
# This should be the deployer/owner of the agent NFT, OR an
# approved operator. Use a dedicated hot wallet with minimal funds.
UPDATER_PRIVATE_KEY=0x...

# The wallet address your backend agent uses for on-chain txns
# (rebalancing, vault operations). This is displayed in metadata.
AGENT_WALLET=0x...

# ── SurfLiquid Data Source ────────────────────────────────────
SURFLIQUID_API_URL=https://api.surfliquid.com/api/summary/daily

# ── Agent Display Info ────────────────────────────────────────
AGENT_NAME=SurfLiquid Yield Agent
WEBSITE_URL=https://surfliquid.com
DUNE_URL=https://dune.com/surfliquid/stats

# ── Update Schedule ───────────────────────────────────────────
# How often to call setAgentURI() on-chain to bust indexer caches.
# The metadata endpoint always returns fresh data regardless.
# Lower = more frequent on-chain txns (but very cheap on Base).
UPDATE_INTERVAL_HOURS=6

# ═══════════════════════════════════════════════════════════════
# MAINNET GO-LIVE: When ready for users to see, you only need to:
# 1. Verify REGISTRY_ADDRESS is correct
# 2. Verify AGENT_WALLET is your production backend wallet
# 3. Ensure SURFLIQUID_API_URL returns production data
# 4. Restart the server
# No code changes needed — it's all config.
# ═══════════════════════════════════════════════════════════════
```

---

## 9. Deployment Flow (Step by Step)

```
Phase 1: Contract Deploy
────────────────────────
1. cd contracts/
2. forge install OpenZeppelin/openzeppelin-contracts --no-commit
3. Set up contracts/.env with DEPLOYER_PRIVATE_KEY and RPC URLs
4. forge script script/Deploy.s.sol --rpc-url $BASE_MAINNET_RPC_URL --broadcast --verify
5. Note the deployed REGISTRY_ADDRESS

Phase 2: Register Agent
────────────────────────
6. cast send $REGISTRY_ADDRESS "register(string)" \
     "https://api.surfliquid.com/erc8004/metadata" \
     --rpc-url $BASE_MAINNET_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY
7. Note the agentId from tx receipt (should be 1)
8. Optionally set on-chain metadata (agentWallet, duneDashboard)

Phase 3: Backend Deploy
────────────────────────
9.  cd backend/
10. npm install
11. Copy .env.example → .env, fill in REGISTRY_ADDRESS, AGENT_ID, keys
12. npm run dev  (test locally)
13. Verify endpoints:
    - curl http://localhost:3001/erc8004/health
    - curl http://localhost:3001/erc8004/metadata  (should return JSON)
    - Open http://localhost:3001/erc8004/image.svg  (should render SVG)
14. Deploy backend to your hosting (same server as api.surfliquid.com
    or a separate service — just needs to be reachable at BASE_URL)

Phase 4: Verify Everything
──────────────────────────
15. Read tokenURI on-chain:
    cast call $REGISTRY_ADDRESS "tokenURI(uint256)" 1 --rpc-url $RPC_URL
    → Should return your metadata endpoint URL
16. Fetch that URL → should return ERC-8004 JSON with live stats
17. Open the image URL → should render SVG agent card with live numbers
18. Check Basescan: the NFT should show up at the deployer's address
19. Wait for one auto-update cycle → check logs for successful setAgentURI tx

Phase 5: Mainnet Go-Live (when ready for users)
────────────────────────────────────────────────
20. Verify all .env values are production-ready
21. Restart the backend
22. That's it — the NFT is already on mainnet, now it shows real data
```

---

## 10. Testing Checklist

```
Contract Tests
──────────────
[ ] register() mints token and emits Registered event
[ ] register() with empty URI reverts
[ ] setAgentURI() works for token owner
[ ] setAgentURI() reverts for non-owner
[ ] setAgentURI() works for approved operator
[ ] setMetadata() stores and retrieves correctly
[ ] setMetadata() reverts for non-owner
[ ] Multiple agents can be registered
[ ] tokenURI() returns correct URI after setAgentURI()

Backend Tests
─────────────
[ ] GET /erc8004/health returns 200 with correct chain info
[ ] GET /erc8004/metadata returns valid ERC-8004 JSON
[ ] GET /erc8004/metadata includes live stats (not all zeros/dashes)
[ ] GET /erc8004/metadata has correct Content-Type: application/json
[ ] GET /erc8004/image.svg returns valid SVG
[ ] GET /erc8004/image.svg has Content-Type: image/svg+xml
[ ] SVG renders correctly in browser
[ ] Stats cache works (second request within 5 min doesn't hit API)
[ ] Stats fallback works (kill your API, metadata still returns)
[ ] Auto-updater sends setAgentURI tx on schedule
[ ] Auto-updater handles tx failures gracefully (no crash)
[ ] Force update endpoint works: POST /erc8004/admin/force-update

Integration Tests
─────────────────
[ ] On-chain tokenURI resolves to your metadata endpoint
[ ] Metadata JSON image field resolves to your SVG endpoint
[ ] NFT visible on Basescan at deployer address
[ ] SVG shows current stats matching your /api/summary/daily
[ ] After auto-update, tokenURI on-chain has new ?v= param
[ ] Dune link in description is clickable (when rendered as markdown)
```

---

## 11. Mainnet Go-Live Checklist

```
Security
────────
[ ] UPDATER_PRIVATE_KEY is a dedicated hot wallet (NOT your main deployer)
[ ] Hot wallet has minimal ETH (just enough for gas — ~0.001 ETH for months)
[ ] Deployer wallet retains NFT ownership (can transfer to Safe later)
[ ] /erc8004/admin/force-update is protected (API key or IP whitelist)
[ ] No private keys in code or git history
[ ] .env is in .gitignore

Data Accuracy
─────────────
[ ] Stats API returns correct current data
[ ] TVL number matches Dune dashboard
[ ] Vault count matches on-chain factory
[ ] APY is reasonable and correctly formatted
[ ] Uptime calculation is accurate

Operations
──────────
[ ] Backend server has monitoring/alerting
[ ] Auto-updater failure triggers alert (not just silent log)
[ ] Hot wallet balance monitoring (alert when < 0.0005 ETH)
[ ] Consider: transfer NFT ownership to your Safe multi-sig
    cast send $REGISTRY "transferFrom(address,address,uint256)" \
      $DEPLOYER_ADDRESS $SAFE_ADDRESS 1 --private-key $DEPLOYER_KEY
    Then approve the hot wallet as operator:
    (from Safe) call setApprovalForAll(hotWallet, true)

Future Enhancements
───────────────────
[ ] Migrate to official Base singleton when ERC-8004 deploys one
[ ] Add Reputation Registry for user feedback
[ ] Add Validation Registry for third-party verification
[ ] Integrate x402 for paid agent services
[ ] Register on multiple chains (Ethereum mainnet, other L2s)
```

---

## Appendix: Key Addresses Reference

Fill these in as you deploy:

```
Identity Registry:     0x_________________________________
Agent ID:              ___
Deployer Wallet:       0x_________________________________
Updater Hot Wallet:    0x_________________________________
Agent Operational Wallet: 0x_________________________________
Safe Multi-Sig:        0x_________________________________

Metadata URL:          https://api.surfliquid.com/erc8004/metadata
Image URL:             https://api.surfliquid.com/erc8004/image.svg
Dune Dashboard:        https://dune.com/surfliquid/stats
Basescan (registry):   https://basescan.org/address/0x___
Basescan (NFT):        https://basescan.org/token/0x___?a=0x___
```
