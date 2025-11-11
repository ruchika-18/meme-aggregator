// ultra-simple in-memory cache for the latest snapshot
let _cache = { updatedAt: null, items: [] };

export function setCache(snapshot) {
  _cache = { ...snapshot };
}

export function getCache() {
  return _cache;
}
