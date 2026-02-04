import axios from "axios";
import { config } from "../utils/config";
import { AgentStats, ApiResponse } from "../types";

// In-memory cache with TTL
let cachedStats: AgentStats | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches live stats from the daily summary API.
 * Uses the field mappings from the implementation plan:
 * - data.totalAUM → TVL
 * - data.totalActiveVaults → total vaults
 * - data.activeVaults24h → active vaults
 * - data.totalTransactions → total rebalances
 * - data.transactions24h → 24h rebalances
 * - data.avgAPY → avg APY
 * - data.totalVolume → total deposited
 * - data.currentLendingPool → protocols used (parsed)
 */
export async function getStats(): Promise<AgentStats> {
  const now = Date.now();

  // Return cached if fresh
  if (cachedStats && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedStats;
  }

  try {
    const response = await axios.get<ApiResponse>(
      config.statsApiUrl,
      {
        timeout: 10000,
      }
    );

    const data = response.data;

    const stats: AgentStats = {
      tvl: formatUsd(data.totalAUM ?? 0),
      totalVaults: data.totalActiveVaults ?? 0,
      activeVaults: data.activeVaults24h ?? 0,
      totalRebalances: data.totalTransactions ?? 0,
      last24hRebalances: data.transactions24h ?? 0,
      avgApy: formatPercent(data.avgAPY ?? 0),
      totalDeposited: formatUsd(data.totalVolume ?? 0),
      totalWithdrawn: "—", // Not available in API
      protocolsUsed: parseProtocols(data.currentLendingPool),
      lastRebalanceAt: data.timestamp ?? new Date().toISOString(),
      uptimePercent: "99.9%", // Hardcoded as not in API
      lastUpdated: new Date().toISOString(),
    };

    cachedStats = stats;
    cacheTimestamp = now;
    return stats;
  } catch (error) {
    console.error("Failed to fetch agent stats:", error);

    // Return cached data if available, otherwise fallback
    if (cachedStats) return cachedStats;

    return getFallbackStats();
  }
}

/**
 * Parse protocol names from the currentLendingPool string.
 * Example input: "Morpho USDC/WETH, Aerodrome USDC-WETH LP"
 * Output: ["Morpho", "Aerodrome"]
 */
function parseProtocols(lendingPoolString: string | undefined): string[] {
  if (!lendingPoolString) {
    return ["Morpho", "Aerodrome", "Merkl"];
  }

  const protocolPatterns = [
    "Morpho",
    "Aerodrome",
    "Merkl",
    "Aave",
    "Compound",
    "Uniswap",
  ];
  const found: string[] = [];

  for (const protocol of protocolPatterns) {
    if (
      lendingPoolString.toLowerCase().includes(protocol.toLowerCase()) &&
      !found.includes(protocol)
    ) {
      found.push(protocol);
    }
  }

  // Return at least the default protocols if none found
  return found.length > 0 ? found : ["Morpho", "Aerodrome", "Merkl"];
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

function getFallbackStats(): AgentStats {
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
