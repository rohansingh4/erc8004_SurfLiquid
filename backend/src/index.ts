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

// ── Admin Auth Middleware ────────────────────────────────────
const adminAuth = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;

  if (!config.adminApiKey) {
    // If no API key is configured, admin endpoints are disabled
    res.status(503).json({ error: "Admin API not configured" });
    return;
  }

  if (apiKey !== config.adminApiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
};

// ── Admin: force update (protected by API key) ───────────────
app.post("/erc8004/admin/force-update", adminAuth, async (req, res) => {
  try {
    const result = await triggerUpdate();
    res.json({ status: "ok", result });
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
});

// ── Start server ─────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`\n  ERC-8004 Agent Server`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Chain: ${config.chainName} (${config.chainId})`);
  console.log(`   Metadata: ${config.baseUrl}/erc8004/metadata`);
  console.log(`   Image: ${config.baseUrl}/erc8004/image.svg`);
  console.log(`   Dune: ${config.duneUrl}`);
  console.log();

  // Initialize the auto-updater (periodic on-chain tokenURI refresh)
  initUpdater();
});
