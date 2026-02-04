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
        `• Total Rebalances: ${stats.totalRebalances.toLocaleString()}`,
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
          endpoint: config.statsApiUrl,
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

      agentWallet: config.agentWallet
        ? {
            [`eip155:${config.chainId}`]: config.agentWallet,
          }
        : undefined,
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
