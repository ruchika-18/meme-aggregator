import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRouter from "./routes/api.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// mount API under /api
app.use("/api", apiRouter);

// simple health check
app.get("/", (_req, res) => {
  res.send("OK");
});

const PORT = process.env.PORT || 8080;

// ----- Background polling every N ms -----
import { getSnapshot } from "./services/aggregator.js";

const POLL_MS = Number(process.env.DATA_REFRESH_INTERVAL || 30000);

async function refreshLoop() {
  try {
    const snap = await getSnapshot();
    console.log(`[poll] refreshed at ${snap.updatedAt}, items=${snap.items.length}`);
  } catch (err) {
    console.error("[poll] refresh failed:", err?.message || err);
  }
}

// start immediately, then repeat
refreshLoop();
setInterval(refreshLoop, POLL_MS);


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
