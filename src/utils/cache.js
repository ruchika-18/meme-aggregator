// src/utils/cache.js
// Very small in-memory cache with timestamp (ESM)

const store = {
  tokens: [],       // normalized array we’ll serve
  lastUpdated: 0,   // epoch ms
};

export function setTokens(tokens) {
  store.tokens = tokens ?? [];
  store.lastUpdated = Date.now();
}

export function getTokens() {
  return { items: store.tokens, lastUpdated: store.lastUpdated };
}
