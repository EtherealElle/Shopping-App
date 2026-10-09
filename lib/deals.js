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
    const deals = await SOURCES[store.kind](store);
    const result = { storeId: store.id, fetchedAt: Date.now(), deals };
    await writeCache(store.id, result);
    return result;
  } catch (err) {
    // Keep showing the last good result if the store is temporarily unreachable.
    if (cached) return { ...cached, stale: true, error: err.message };
    return { storeId: store.id, fetchedAt: Date.now(), deals: [], error: err.message };
  }
}
