import axios from "axios";

/**
 * We fetch from public endpoints and normalize into one shape.
 * Shape:
 * {
 *   id: string,
 *   name: string,
 *   symbol: string,
 *   chain: "BINANCE" | "COINGECKO" | string,
 *   price: number,
 *   change24h: number,
 *   volume24h: number,
 *   liquidity: number
 * }
 */

async function fetchFromBinance() {
  // 24h stats for BTCUSDT & ETHUSDT
  const symbols = ["BTCUSDT", "ETHUSDT"];
  const calls = symbols.map(s =>
    axios.get("https://api.binance.com/api/v3/ticker/24hr", { params: { symbol: s } })
  );
  const res = await Promise.allSettled(calls);

  const items = [];
  for (const r of res) {
    if (r.status !== "fulfilled") continue;
    const d = r.value.data;
    items.push({
      id: d.symbol,
      name: d.symbol.replace("USDT",""),
      symbol: d.symbol.replace("USDT",""),
      chain: "BINANCE",
      price: Number(d.lastPrice),
      change24h: Number(d.priceChangePercent),
      volume24h: Number(d.volume),
      liquidity: Number(d.quoteVolume) // proxy
    });
  }
  return items;
}

async function fetchFromCoingecko() {
  // Simple price for btc & eth with 24h change
  const url = "https://api.coingecko.com/api/v3/simple/price";
  const { data } = await axios.get(url, {
    params: {
      ids: "bitcoin,ethereum",
      vs_currencies: "usd",
      include_24hr_change: "true"
    }
  });

  const items = [];
  if (data.bitcoin) {
    items.push({
      id: "bitcoin",
      name: "Bitcoin",
      symbol: "BTC",
      chain: "COINGECKO",
      price: Number(data.bitcoin.usd),
      change24h: Number(data.bitcoin.usd_24h_change ?? 0),
      volume24h: 0,
      liquidity: 0
    });
  }
  if (data.ethereum) {
    items.push({
      id: "ethereum",
      name: "Ethereum",
      symbol: "ETH",
      chain: "COINGECKO",
      price: Number(data.ethereum.usd),
      change24h: Number(data.ethereum.usd_24h_change ?? 0),
      volume24h: 0,
      liquidity: 0
    });
  }
  return items;
}

export async function aggregateOnce() {
  const [bin, cg] = await Promise.allSettled([
    fetchFromBinance(),
    fetchFromCoingecko()
  ]);

  const out = [];
  if (bin.status === "fulfilled") out.push(...bin.value);
  if (cg.status === "fulfilled") out.push(...cg.value);

  return out;
}
