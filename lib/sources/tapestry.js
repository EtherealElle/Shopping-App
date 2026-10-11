import { fetchText, FetchError } from '../http.js';

// Tapestry brands (Kate Spade, Coach and their outlets) share one storefront. Each listing page
// embeds its first screen of products, with current and regular prices, in the page's Next.js data.
const MAX_DEALS = 60;
const PAUSE_MS = 400;
const NOTE_MAX_LENGTH = 90;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchTapestryDeals(store) {
  const byId = new Map();
  let pagesRead = 0;
  let lastError = new FetchError('Store pages are not in the expected format');
  for (const listingPath of store.paths) {
    try {
      const html = await fetchText(`https://${store.domain}${listingPath}`, { timeoutMs: 30000 });
      const products = extractProducts(html);
      if (products) pagesRead++;
      for (const product of products || []) {
        const deal = toDeal(store, product);
        if (deal && !byId.has(deal.id)) byId.set(deal.id, deal);
      }
    } catch (err) {
      lastError = err;
    }
    await sleep(PAUSE_MS);
  }
  // No readable page at all is a failure, not "nothing on sale".
  if (!pagesRead) throw lastError;
  return [...byId.values()].sort((a, b) => b.pctOff - a.pctOff).slice(0, MAX_DEALS);
}

// The page's product list, or null if the page doesn't contain one.
function extractProducts(html) {
  let data = '';
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      data += JSON.parse(match[1]);
    } catch {
      // Skip a chunk that isn't a plain JSON string.
    }
  }
  const marker = data.match(/"totalPages":\d+,"products":\[/);
  if (!marker) return null;
  const start = marker.index + marker[0].length - 1;
  const end = closingIndex(data, start);
  if (end < 0) return null;
  try {
    return JSON.parse(data.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Index of the bracket that closes the array or object opening at `start`.
function closingIndex(text, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function toDeal(store, product) {
  const prices = product.prices || product.defaultVariant?.prices;
  if (!product.name || !product.url || !prices?.isOnSale || product.inventory?.orderable === false) return null;
  const price = Number(prices.currentPrice);
  const listPrice = Number(prices.regularPrice);
  if (!(price > 0) || !(listPrice > price)) return null;
  const image = product.media?.full?.[0]?.src;
  return {
    id: `${store.id}:${product.masterId || product.id}`,
    title: product.name,
    url: new URL(product.url, `https://${store.domain}`).href,
    image: image ? `${image}?wid=480` : null,
    price,
    listPrice,
    pctOff: Math.round((1 - price / listPrice) * 100),
    note: promoNote(product),
  };
}

// The store's own on-page promotion text for this product, e.g. an extra-percent-off callout.
function promoNote(product) {
  for (const promo of product.promoPLP || []) {
    const html = promo?.['call-out-message']?.content?.text;
    if (typeof html !== 'string') continue;
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (text) return text.length > NOTE_MAX_LENGTH ? `${text.slice(0, NOTE_MAX_LENGTH - 1)}…` : text;
  }
  return null;
}
