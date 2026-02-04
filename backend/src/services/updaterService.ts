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
export function initUpdater(): void {
  if (!config.updaterPrivateKey || !config.registryAddress) {
    console.warn(
      "  Updater not configured — skipping auto-update setup.",
      "Set UPDATER_PRIVATE_KEY and REGISTRY_ADDRESS in .env"
    );
    return;
  }

  provider = new ethers.JsonRpcProvider(config.rpcUrl);
  wallet = new ethers.Wallet(config.updaterPrivateKey, provider);
  registry = new ethers.Contract(config.registryAddress, REGISTRY_ABI, wallet);

  console.log(
    `  Auto-updater initialized. Will update every ${config.updateIntervalHours}h`
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
async function updateTokenURI(): Promise<void> {
  try {
    const version = Math.floor(Date.now() / 1000);
    const newURI = `${config.baseUrl}/erc8004/metadata?v=${version}`;

    console.log(`  Updating tokenURI for agent #${config.agentId}...`);
    console.log(`   New URI: ${newURI}`);

    // Check current gas price to avoid overpaying
    const feeData = await provider.getFeeData();
    console.log(
      `   Gas price: ${ethers.formatUnits(feeData.gasPrice ?? 0, "gwei")} gwei`
    );

    const tx = await registry.setAgentURI(config.agentId, newURI, {
      // Base mainnet gas is very cheap, but set a reasonable cap
      gasLimit: 100000,
    });

    console.log(`   Tx submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(
      `     Confirmed in block ${receipt?.blockNumber} (gas used: ${receipt?.gasUsed})`
    );
  } catch (error) {
    console.error("  Failed to update tokenURI:", error);

    // Don't crash the server — just log and retry next interval
  }
}

/**
 * Manually trigger an update (for admin endpoints or testing).
 */
export async function triggerUpdate(): Promise<string> {
  if (!registry) {
    return "Updater not configured";
  }
  await updateTokenURI();
  return "Update triggered";
}
