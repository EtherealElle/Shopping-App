import { fetchText, FetchError } from '../http.js';

// Shopify stores publish their catalog at /products.json, including each variant's current price
// and the store's own "compare at" (list) price.
const PAGE_SIZE = 250;
const MAX_PAGES = 4;
const MAX_DEALS = 60;
const MIN_PCT_OFF = 5;
// Some stores leave internal test listings in their public catalog (for example "Test Buy").
const PLACEHOLDER_TITLE = /^\s*test\b/i;

export async function fetchShopifyDeals(store) {
  const deals = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    let products;
    try {
      const body = await fetchText(`https://${store.domain}/products.json?limit=${PAGE_SIZE}&page=${page}`);
      products = JSON.parse(body).products || [];
    } catch (err) {
      if (page > 1) break;
      throw err instanceof FetchError ? err : new FetchError('Store did not return a product catalog');
    }
    for (const product of products) {
      const deal = toDeal(store, product);
      if (deal) deals.push(deal);
    }
    if (products.length < PAGE_SIZE) break;
  }
  return deals.sort((a, b) => b.pctOff - a.pctOff).slice(0, MAX_DEALS);
}

function toDeal(store, product) {
  if (PLACEHOLDER_TITLE.test(product.title || '')) return null;
  let best = null;
  for (const variant of product.variants || []) {
    const price = Number(variant.price);
    const listPrice = Number(variant.compare_at_price);
    if (variant.available === false || !(price > 0) || !(listPrice > price)) continue;
    const pctOff = Math.round((1 - price / listPrice) * 100);
    if (!best || pctOff > best.pctOff) best = { price, listPrice, pctOff };
  }
  if (!best || best.pctOff < MIN_PCT_OFF) return null;
  return {
    id: `${store.id}:${product.id}`,
    title: product.title,
    url: `https://${store.domain}/products/${product.handle}`,
    image: thumbnail(product.images?.[0]?.src),
    ...best,
  };
}

function thumbnail(src) {
  if (!src) return null;
  try {
    const url = new URL(src);
    url.searchParams.set('width', '480');
    return url.href;
  } catch {
    return null;
  }
}
