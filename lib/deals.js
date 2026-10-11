import { readCache, writeCache } from './cache.js';
import { fetchShopifyDeals } from './sources/shopify.js';
import { fetchTapestryDeals } from './sources/tapestry.js';
import { fetchLovenseDeals } from './sources/lovense.js';
import { fetchFeedDeals } from './sources/slickdeals.js';

const MINUTE = 60 * 1000;
// Store catalogs change slowly and are large; community feeds move fast and are small.
const TTL_MS = { shopify: 6 * 60 * MINUTE, tapestry: 6 * 60 * MINUTE, lovense: 6 * 60 * MINUTE, feed: 30 * MINUTE };
// Floor on manual refreshes so repeated clicks can't hammer a store.
const MIN_REFRESH_MS = 2 * MINUTE;

const SOURCES = { shopify: fetchShopifyDeals, tapestry: fetchTapestryDeals, lovense: fetchLovenseDeals, feed: fetchFeedDeals };
const inFlight = new Map();

// Fetches a store's deals now, with no caching. Throws if the store can't be read.
export async function fetchDeals(store) {
  const deals = await SOURCES[store.kind](store);
  return { storeId: store.id, fetchedAt: Date.now(), deals };
}

// What to show when a fetch fails: the last good result marked stale, or an empty result.
export function failedResult(store, previous, err) {
  if (previous) return { ...previous, stale: true, error: err.message };
  return { storeId: store.id, fetchedAt: Date.now(), deals: [], error: err.message };
}

// Cached deals for the local server.
export async function getDeals(store, { refresh = false } = {}) {
  const cached = await readCache(store.id);
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;
  if (cached && age < (refresh ? MIN_REFRESH_MS : TTL_MS[store.kind])) return cached;

  if (!inFlight.has(store.id)) {
    inFlight.set(store.id, load(store, cached).finally(() => inFlight.delete(store.id)));
  }
  return inFlight.get(store.id);
}

async function load(store, cached) {
  try {
    const result = await fetchDeals(store);
    await writeCache(store.id, result);
    return result;
  } catch (err) {
    return failedResult(store, cached, err);
  }
}
