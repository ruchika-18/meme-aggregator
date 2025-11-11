import axios from "axios";
import { setCache } from "../utils/cache.js";

/**
 * In a real app these would call external APIs. For now we return
 * one synthetic record so the pipeline is testable end-to-end.
 */
async function sourceDemo() {
  // simulate latency
  await new Promise(r => setTimeout(r, 50));

  return [
    {
      id: 1,
      name: "Demo Coin",
      symbol: "DEMO",
      price: (Math.random() * 100).toFixed(2),
      change1h: (Math.random() * 10 - 5).toFixed(2),
      change24h: (Math.random() * 20 - 10).toFixed(2),
      volume24h: Math.floor(Math.random() * 1_500_000),
      liquidity: Math.floor(Math.random() * 2_000_000),
      chain: "ETH",
      status: "New pairs"
    }
  ];
}

const SOURCES = [sourceDemo];

export async function getSnapshot() {
  const rows = [];

  for (const fn of SOURCES) {
    try {
      const part = await fn();
      if (Array.isArray(part)) rows.push(...part);
    } catch (e) {
      console.error("source error:", e?.message || e);
    }
  }

  // Normalize
  const items = rows.map((t, i) => ({
    id: String(t.id ?? i),
    name: t.name ?? "Unknown",
    symbol: t.symbol ?? "",
    price: Number(t.price ?? 0),
    change1h: Number(t.change1h ?? 0),
    change24h: Number(t.change24h ?? 0),
    volume24h: Number(t.volume24h ?? 0),
    liquidity: Number(t.liquidity ?? 0),
    chain: t.chain ?? "ETH",
    status: t.status ?? "New pairs"
  }));

  const snapshot = {
    updatedAt: new Date().toISOString(),
    items
  };

  // put into memory so /api/cache can read it
  setCache(snapshot);
  return snapshot;
}

export default { getSnapshot };
