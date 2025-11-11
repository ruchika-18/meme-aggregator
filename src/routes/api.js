import express from "express";
import { getTokens } from "../utils/cache.js";

const router = express.Router();

// health
router.get("/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// all tokens (latest snapshot)
router.get("/tokens", (req, res) => {
  const { items, lastUpdated } = getTokens();
  res.json({ items, lastUpdated });
});

// SSE stream sending snapshot every 5s
router.get("/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = () => {
    const payload = JSON.stringify(getTokens());
    res.write(`data: ${payload}\n\n`);
  };

  send(); // immediately
  const t = setInterval(send, 5000);

  req.on("close", () => clearInterval(t));
});

export default router;
