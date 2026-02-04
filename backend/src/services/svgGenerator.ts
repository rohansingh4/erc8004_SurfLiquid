import { AgentStats } from "../types";
import { config } from "../utils/config";

/**
 * Generates a dynamic SVG agent card with live protocol stats.
 * This SVG is what wallets and NFT explorers render as the NFT image.
 */
export function generateAgentCardSvg(stats: AgentStats): string {
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

  // Generate protocol badges dynamically
  const protocolBadges = generateProtocolBadges(stats.protocolsUsed);

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
        fill="#ffffff" font-weight="bold">${escapeXml(config.agentName)}</text>

  <!-- Chain badge -->
  <rect x="40" y="105" width="130" height="26" rx="13" fill="#0052ff" opacity="0.3" />
  <text x="60" y="123" font-family="Arial, sans-serif" font-size="13"
        fill="#4d9fff" font-weight="600">${escapeXml(config.chainName)} Mainnet</text>

  <!-- Protocol badges -->
${protocolBadges}

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
        fill="#00d4ff">dune.com/example/stats</text>

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

function generateProtocolBadges(protocols: string[]): string {
  const badges: string[] = [];
  let xPos = 180;

  for (const protocol of protocols.slice(0, 3)) {
    // Max 3 badges
    const width = protocol.length * 8 + 24;
    badges.push(`  <rect x="${xPos}" y="105" width="${width}" height="26" rx="13" fill="#00d4ff" opacity="0.1" />
  <text x="${xPos + 12}" y="123" font-family="Arial, sans-serif" font-size="12"
        fill="#00d4ff">${escapeXml(protocol)}</text>`);
    xPos += width + 8;
  }

  return badges.join("\n");
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
  if (!address || address.length < 10) return address || "Not Set";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
