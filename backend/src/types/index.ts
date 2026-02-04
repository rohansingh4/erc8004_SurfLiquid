export interface AgentStats {
  tvl: string;               // e.g., "$236,413"
  totalVaults: number;       // e.g., 108
  activeVaults: number;      // e.g., 2 (active in last 24h)
  totalRebalances: number;   // e.g., 4030
  last24hRebalances: number; // e.g., 12
  avgApy: string;            // e.g., "4.1%"
  totalDeposited: string;    // e.g., "$8,037,433"
  totalWithdrawn: string;    // e.g., "—" (not in API)
  protocolsUsed: string[];   // e.g., ["Morpho", "Aerodrome", "Merkl"]
  lastRebalanceAt: string;   // ISO timestamp
  uptimePercent: string;     // e.g., "99.9%"
  lastUpdated: string;       // ISO timestamp
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

export interface ApiResponse {
  totalAUM: number;
  totalActiveVaults: number;
  activeVaults24h: number;
  totalTransactions: number;
  transactions24h: number;
  avgAPY: number;
  totalVolume: number;
  currentLendingPool: string;
  timestamp: string;
}
