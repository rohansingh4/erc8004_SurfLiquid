import dotenv from "dotenv";
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || "3001"),
  baseUrl: process.env.BASE_URL || "https://api.example.com",

  // Chain
  rpcUrl: process.env.RPC_URL || "https://mainnet.base.org",
  chainId: parseInt(process.env.CHAIN_ID || "8453"),
  chainName: process.env.CHAIN_NAME || "Base",

  // Contracts
  registryAddress: process.env.REGISTRY_ADDRESS || "",
  agentId: parseInt(process.env.AGENT_ID || "1"),

  // Wallet (for auto-updater to call setAgentURI)
  updaterPrivateKey: process.env.UPDATER_PRIVATE_KEY || "",

  // Stats data source
  statsApiUrl:
    process.env.STATS_API_URL ||
    "https://api.example.com/api/summary/daily",

  // Agent info
  agentName: process.env.AGENT_NAME || "DeFAI Yield Agent",
  agentWallet: process.env.AGENT_WALLET || "",
  websiteUrl: process.env.WEBSITE_URL || "https://example.com",
  duneUrl: process.env.DUNE_URL || "https://dune.com/example/stats",

  // Update interval in hours
  updateIntervalHours: parseInt(process.env.UPDATE_INTERVAL_HOURS || "6"),

  // Admin API key for protected endpoints
  adminApiKey: process.env.ADMIN_API_KEY || "",
};
