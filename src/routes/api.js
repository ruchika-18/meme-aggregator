// src/routes/api.js
import { Router } from "express";
import { readTokens, refreshTokens } from "../services/aggregator.js";

const router = Router();

/**
 * Health check
 * GET /api/health
 */
router.get("/health", (req, res) => {
  const { items, lastUpdated } = readTokens();
  res.json({
    ok: true,
    lastUpdated,
    count: items.length,
  });
});

/**
 * List tokens (from cache) with optional search/sort/pagination
 * GET /api/tokens?q=&sort=&dir=&page=&pageSize=
 *
 * sort: price_sol | market_cap_sol | volume_sol | liquidity_sol | transaction_count | price_1hr_change
 * dir:  asc | desc
 */
router.get("/tokens", (req, res) => {
  const { items, lastUpdated } = readTokens();

  let data = items.slice();

  // --- search ---
  const q = (req.query.q || "").toString().trim().toLowerCase();
  if (q) {
    data = data.filter((t) =>
      (t.token_name || "").toLowerCase().includes(q) ||
      (t.token_ticker || "").toLowerCase().includes(q) ||
      (t.token_address || "").toLowerCase().includes(q)
    );
  }

  // --- sort ---
  const sortable = new Set([
    "price_sol",
    "market_cap_sol",
    "volume_sol",
    "liquidity_sol",
    "transaction_count",
    "price_1hr_change",
  ]);
  const sortKey = (req.query.sort || "").toString();
  const dir = (req.query.dir || "desc").toString().toLowerCase(); // default desc
  if (sortable.has(sortKey)) {
    data.sort((a, b) => {
      const av = Number(a[sortKey] ?? 0);
      const bv = Number(b[sortKey] ?? 0);
      return dir === "asc" ? av - bv : bv - av;
    });
  }

  // --- pagination ---
  const pageSize = Math.max(1, Math.min(200, Number(req.query.pageSize || 50)));
  const page = Math.max(1, Number(req.query.page || 1));
  const total = data.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const slice = data.slice(start, end);

  res.json({
    ok: true,
    lastUpdated,
    total,
    page,
    pageSize,
    items: slice,
  });
});

/**
 * (Optional) Manual refresh trigger for testing.
 * GET /api/refresh
 * -> polls upstream now and updates cache
 */
router.get("/refresh", async (req, res) => {
  try {
    const n = await refreshTokens();
    res.json({ ok: true, updatedCount: n });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "refresh failed" });
  }
});

export default router;

