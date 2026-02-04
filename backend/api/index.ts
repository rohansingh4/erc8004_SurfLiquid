import express from "express";

// Load environment variables
const config = {
  port: parseInt(process.env.PORT || "3001"),
  baseUrl: process.env.BASE_URL || "https://erc8004-surf-liquid.vercel.app",
  rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
  chainId: parseInt(process.env.CHAIN_ID || "8453"),
  chainName: process.env.CHAIN_NAME || "Base",
  registryAddress: process.env.REGISTRY_ADDRESS || "0x2031C13F4927E3f97Eba0066BA330927A77EB540",
  agentId: parseInt(process.env.AGENT_ID || "1"),
  agentWallet: process.env.AGENT_WALLET || "0xb0538910f0Abffc41F0CF701E626975E51e92bC7",
  statsApiUrl: process.env.STATS_API_URL || "https://api.example.com/api/summary/daily",
  agentName: process.env.AGENT_NAME || "DeFAI Yield Agent",
  websiteUrl: process.env.WEBSITE_URL || "https://example.com",
  duneUrl: process.env.DUNE_URL || "https://dune.com/example/stats",
};

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

// ── ERC-8004 Metadata ────────────────────────────────────────
app.get("/erc8004/metadata", async (req, res) => {
  const metadata = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: config.agentName,
    description: [
      `Non-custodial DeFAI yield agent on ${config.chainName}.`,
      `Deploys individual USDC vaults via factory contracts,`,
      `allocates across Morpho lending pools and Aerodrome LP positions,`,
      `auto-rebalances every 12 hours, and compounds Merkl rewards.`,
      ``,
      `All operations are on-chain and auditable.`,
      `On-chain proof: ${config.duneUrl}`,
    ].join("\n"),
    image: `${config.baseUrl}/erc8004/image.svg`,
    services: [
      { name: "web", endpoint: config.websiteUrl },
      { name: "stats-api", endpoint: config.statsApiUrl },
      { name: "onchain-proof", endpoint: config.duneUrl },
    ],
    registrations: [
      {
        agentRegistry: `eip155:${config.chainId}:${config.registryAddress}`,
        agentId: config.agentId,
      },
    ],
    supportedTrust: ["reputation"],
    agentWallet: config.agentWallet
      ? { [`eip155:${config.chainId}`]: config.agentWallet }
      : undefined,
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(metadata);
});

// ── Dynamic SVG Image ────────────────────────────────────────
app.get("/erc8004/image.svg", (req, res) => {
  const updatedStr = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a1628;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#0f2847;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a3a5c;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00d4ff;stop-opacity:0.15" />
      <stop offset="100%" style="stop-color:#0099ff;stop-opacity:0.08" />
    </linearGradient>
  </defs>
  <rect width="800" height="500" rx="16" fill="url(#bg)" />
  <rect width="798" height="498" x="1" y="1" rx="15" fill="none" stroke="#00d4ff" stroke-opacity="0.2" stroke-width="1" />
  <text x="40" y="52" font-family="monospace" font-size="14" fill="#00d4ff" opacity="0.6" letter-spacing="3">ERC-8004 AGENT IDENTITY</text>
  <text x="40" y="90" font-family="Arial, sans-serif" font-size="28" fill="#ffffff" font-weight="bold">${config.agentName}</text>
  <rect x="40" y="105" width="130" height="26" rx="13" fill="#0052ff" opacity="0.3" />
  <text x="60" y="123" font-family="Arial, sans-serif" font-size="13" fill="#4d9fff" font-weight="600">${config.chainName} Mainnet</text>
  <line x1="40" y1="148" x2="760" y2="148" stroke="#00d4ff" stroke-opacity="0.15" />
  <rect x="40" y="165" width="350" height="80" rx="10" fill="url(#accent)" />
  <text x="60" y="195" font-family="Arial, sans-serif" font-size="12" fill="#7eb8d0" letter-spacing="1">REGISTRY</text>
  <text x="60" y="228" font-family="monospace" font-size="16" fill="#ffffff">${config.registryAddress.slice(0, 20)}...</text>
  <rect x="410" y="165" width="350" height="80" rx="10" fill="url(#accent)" />
  <text x="430" y="195" font-family="Arial, sans-serif" font-size="12" fill="#7eb8d0" letter-spacing="1">AGENT ID</text>
  <text x="430" y="228" font-family="Arial, sans-serif" font-size="28" fill="#00ff88" font-weight="bold">#${config.agentId}</text>
  <rect x="40" y="260" width="350" height="80" rx="10" fill="url(#accent)" />
  <text x="60" y="290" font-family="Arial, sans-serif" font-size="12" fill="#7eb8d0" letter-spacing="1">AGENT WALLET</text>
  <text x="60" y="323" font-family="monospace" font-size="16" fill="#ffffff">${config.agentWallet.slice(0, 20)}...</text>
  <rect x="410" y="260" width="350" height="80" rx="10" fill="url(#accent)" />
  <text x="430" y="290" font-family="Arial, sans-serif" font-size="12" fill="#7eb8d0" letter-spacing="1">CHAIN</text>
  <text x="430" y="323" font-family="Arial, sans-serif" font-size="28" fill="#ffffff" font-weight="bold">${config.chainName}</text>
  <line x1="40" y1="358" x2="760" y2="358" stroke="#00d4ff" stroke-opacity="0.15" />
  <text x="40" y="385" font-family="Arial, sans-serif" font-size="12" fill="#7eb8d0" letter-spacing="1">ON-CHAIN PROOF</text>
  <text x="40" y="408" font-family="monospace" font-size="14" fill="#00d4ff">${config.duneUrl.replace("https://", "")}</text>
  <text x="40" y="465" font-family="monospace" font-size="11" fill="#4a6a80">Agent ID: #${config.agentId} • Registry: ${config.registryAddress.slice(0, 6)}...${config.registryAddress.slice(-4)}</text>
  <text x="40" y="483" font-family="monospace" font-size="11" fill="#4a6a80">Last updated: ${updatedStr}</text>
  <circle cx="735" cy="475" r="5" fill="#00ff88" opacity="0.8">
    <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
  </circle>
  <text x="746" y="480" font-family="Arial, sans-serif" font-size="11" fill="#00ff88">LIVE</text>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(svg);
});

// Export for Vercel
export default app;
