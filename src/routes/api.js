import { Router } from "express";
import { getSnapshot } from "../services/aggregator.js";
import { getCache } from "../utils/cache.js";

const router = Router();

// Returns the latest computed snapshot (and refreshes it on demand)
router.get("/snapshot", async (req, res, next) => {
  try {
    const snap = await getSnapshot();
    res.json(snap);
  } catch (err) {
    next(err);
  }
});

// Returns whatever is currently in memory
router.get("/cache", (req, res) => {
  res.json(getCache());
});

export default router;
