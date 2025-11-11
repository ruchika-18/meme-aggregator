// src/server.js
import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { WebSocketServer } from "ws";

import apiRouter from "./routes/api.js";
import { refreshTokens, readTokens } from "./services/aggregator.js";

const app = express();
app.use(cors());
app.use(express.json());

// REST
app.use("/api", apiRouter);

const server = http.createServer(app);

// WS
const wss = new WebSocketServer({ server, path: "/ws" });

// simple helper to broadcast to all clients
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.readyState === 1) c.send(msg);
  });
}

// On connect: send a snapshot (lightweight)
wss.on("connection", (socket) => {
  const { items, lastUpdated } = readTokens();
  socket.send(JSON.stringify({ type: "snapshot", lastUpdated, count: items.length }));
});

// Poll + notify loop
const POLL_MS = Number(process.env.POLL_MS || 30000);
let lastSnapshot = new Map(); // token_address -> price

async function pollOnce() {
  try {
    await refreshTokens();
    const { items, lastUpdated } = readTokens();

    // compute changes (price delta vs last snapshot)
    const changes = [];
    const nextSnapshot = new Map();
    for (const t of items) {
      const prev = lastSnapshot.get(t.token_address);
      nextSnapshot.set(t.token_address, t.price_sol);
      if (prev != null && prev !== t.price_sol) {
        changes.push({
          token_address: t.token_address,
          price_sol: t.price_sol,
          delta: t.price_sol - prev,
        });
      }
    }
    lastSnapshot = nextSnapshot;

    if (changes.length) {
      broadcast({ type: "price_updates", lastUpdated, changes });
    }
  } catch (err) {
    console.error("poll error:", err.message);
  }
}

const PORT = Number(process.env.PORT || 8080);
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Kick off loop
pollOnce();
setInterval(pollOnce, POLL_MS);
