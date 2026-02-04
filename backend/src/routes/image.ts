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
