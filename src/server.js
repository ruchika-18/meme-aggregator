import "dotenv/config.js";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import http from "http";

import apiRouter from "./routes/api.js";
import { aggregateOnce } from "./services/aggregator.js";
import { setTokens, getTokens } from "./utils/cache.js";

const PORT = Number(process.env.PORT || 8080);
const POLL_MS = Number(process.env.POLL_MS || 30000);

const app = express();
app.use(cors());
app.use(express.json());

// REST routes
app.use("/api", apiRouter);

// basic homepage
app.get("/", (_req, res) => {
  res.type("text/plain").send("Real-time Data Aggregation Service is running.\nUse /api/health or /api/tokens");
});

// HTTP server + WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcastWS(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// polling loop to refresh cache and notify WS
async function poll() {
  try {
    const items = await aggregateOnce();
    setTokens(items);
    broadcastWS({ type: "tokens:update", ...getTokens() });
    console.log(`[poll] updated ${items.length} items @ ${new Date().toISOString()}`);
  } catch (err) {
    console.error("poll error:", err?.message ?? err);
  }
}

server.listen(PORT, async () => {
  console.log(`➜ http://localhost:${PORT}`);
  await poll();               // fetch immediately
  setInterval(poll, POLL_MS); // then every 30s (from .env)
});
