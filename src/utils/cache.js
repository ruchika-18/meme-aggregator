// Very small in-memory cache with timestamp
const cache = {
  tokens: [],        // normalized array we’ll serve to clients
  lastUpdated: 0     // ms epoch
};

export function getTokens() {
  return { items: cache.tokens, lastUpdated: cache.lastUpdated };
}

export function setTokens(tokens) {
  cache.tokens = tokens;
  cache.lastUpdated = Date.now();
}
