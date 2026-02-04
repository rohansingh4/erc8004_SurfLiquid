import express from "express";
import { config } from "../src/utils/config";
import metadataRouter from "../src/routes/metadata";
import imageRouter from "../src/routes/image";

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

// Export for Vercel
export default app;
