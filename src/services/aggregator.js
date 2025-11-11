// src/services/aggregator.js
import axios from "axios";
import { setTokens, getTokens } from "../utils/cache.js";

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

/** Small helper: retry a GET with exponential backoff */
async function getWithRetry(url, params = {}) {
  let attempt = 0;
  while (true) {
    try {
      const res = await axios.get(url, { params, timeout: 10000 });
      return res.data;
    } catch (err) {
      attempt++;
      const status = err?.response?.status;
      const retryable = !status || status >= 500 || status === 429;
      if (!retryable || attempt > MAX_RETRIES) throw err;

      const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

/** ---- Source 1: DexScreener (search top keywords) ---- */
async function fetchDexScreener() {
  // Use a few common queries to get a variety of tokens
  const queries = ["solana", "raydium", "pump"];
  const all = [];

  for (const q of queries) {
    const data = await getWithRetry(
      "https://api.dexscreener.com/latest/dex/search",
      { q }
    );

    const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
    for (const p of pairs.slice(0, 20)) {
      // Some pairs don’t have a clean token address; skip if missing
      const chain = (p?.chainId || "").toUpperCase();
      const base = p?.baseToken;
      if (!base?.address) continue;

      // Normalize into assignment shape
      all.push({
        token_address: base.address,
        token_name: base.name || base.symbol || "Unknown",
        token_ticker: base.symbol || "",
        price_sol: Number(p?.priceNative ?? 0) || 0,
        market_cap_sol: Number(p?.fdv ?? 0) / 1e9 || 0, // crude approx (FDV in native)
        volume_sol: Number(p?.volume?.h24 ?? 0) || 0,
        liquidity_sol: Number(p?.liquidity?.base ?? 0) || 0,
        transaction_count: Number(p?.txns?.h24?.buys ?? 0) + Number(p?.txns?.h24?.sells ?? 0) || 0,
        price_1hr_change: Number(p?.priceChange?.h1 ?? 0) || 0,
        protocol: `DexScreener:${chain}`,
        _source: "dexscreener",
      });
    }
  }
  return all;
}

/** ---- Source 2: GeckoTerminal (Solana tokens) ---- */
async function fetchGeckoTerminal() {
  // Their API returns pages; grab one page of popular tokens
  const data = await getWithRetry(
    "https://api.geckoterminal.com/api/v2/networks/solana/tokens"
  );

  const tokens = Array.isArray(data?.data) ? data.data : [];
  // Each entry is { id, type, attributes: {...} }
  return tokens.slice(0, 50).map((t) => {
    const a = t?.attributes || {};
    // gecko terminal may not give exact same fields, map what we can
    return {
      token_address: a.address || a.token_address || t?.id || "",
      token_name: a.name || a.symbol || "Unknown",
      token_ticker: a.symbol || "",
      price_sol: Number(a.price_native ?? 0) || 0,
      market_cap_sol: Number(a.market_cap ?? 0) || 0,
      volume_sol: Number(a.volume_24h ?? 0) || 0,
      liquidity_sol: Number(a.liquidity ?? 0) || 0,
      transaction_count: Number(a.transactions_24h ?? 0) || 0,
      price_1hr_change: Number(a.price_change_1h ?? 0) || 0,
      protocol: "GeckoTerminal:SOL",
      _source: "geckoterminal",
    };
  }).filter(t => t.token_address);
}

/** Merge duplicates by token_address (prefer freshest non-zero values) */
function mergeByAddress(list) {
  const map = new Map();
  for (const t of list) {
    const key = t.token_address;
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, { ...t });
    } else {
      const prev = map.get(key);
      // simple merge policy: prefer max values where it makes sense
      map.set(key, {
        ...prev,
        token_name: prev.token_name || t.token_name,
        token_ticker: prev.token_ticker || t.token_ticker,
        price_sol: prev.price_sol || t.price_sol,
        market_cap_sol: Math.max(prev.market_cap_sol, t.market_cap_sol),
        volume_sol: Math.max(prev.volume_sol, t.volume_sol),
        liquidity_sol: Math.max(prev.liquidity_sol, t.liquidity_sol),
        transaction_count: Math.max(prev.transaction_count, t.transaction_count),
        price_1hr_change: prev.price_1hr_change || t.price_1hr_change,
        protocol: prev.protocol || t.protocol,
        _source: `${prev._source},${t._source}`,
      });
    }
  }
  return Array.from(map.values());
}

/** Public: refresh upstream and update cache */
export async function refreshTokens() {
  const [fromDex, fromGecko] = await Promise.allSettled([
    fetchDexScreener(),
    fetchGeckoTerminal(),
  ]);

  const merged = [
    ...(fromDex.status === "fulfilled" ? fromDex.value : []),
    ...(fromGecko.status === "fulfilled" ? fromGecko.value : []),
  ];

  const final = mergeByAddress(merged);
  setTokens(final);
  return final.length;
}

/** Public: get from cache (no blocking). Useful to serve API fast. */
export function readTokens() {
  return getTokens();
}
