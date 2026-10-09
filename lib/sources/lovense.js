import { fetchText } from '../http.js';
import { decodeEntities, toNumber } from '../text.js';

// Lovense lists its whole range on one server-rendered store page, each product card carrying a
// selling price and, when discounted, the original price.
const STORE_PATH = '/public/store';
const MIN_PCT_OFF = 5;

const text = (html) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const amount = (card, className) => {
  const match = card.match(new RegExp(`class="${className}\\s*">\\s*\\$([\\d,]+(?:\\.\\d{1,2})?)`));
  return match ? toNumber(match[1]) : NaN;
};

export async function fetchLovenseDeals(store) {
  const html = await fetchText(`https://${store.domain}${STORE_PATH}`, { timeoutMs: 30000 });
  const byUrl = new Map();
  for (const card of html.split('<div class="toy_img').slice(1)) {
    const deal = toDeal(store, card);
    if (deal && !byUrl.has(deal.url)) byUrl.set(deal.url, deal);
  }
  return [...byUrl.values()].sort((a, b) => b.pctOff - a.pctOff);
}

function toDeal(store, card) {
  const href = (card.match(/href="(\/[^"]+)"/) || [])[1];
  const name = text((card.match(/<p class="toy_name">([\s\S]*?)<\/p>/) || [])[1] || '');
  const price = amount(card, 'sell_price');
  const listPrice = amount(card, 'og_price');
  if (!href || !name || !(price > 0) || !(listPrice > price)) return null;
  const pctOff = Math.round((1 - price / listPrice) * 100);
  if (pctOff < MIN_PCT_OFF) return null;

  const description = text((card.match(/<p class="toy_desc"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '');
  // Lazy-loaded cards keep the real image in data-src behind a placeholder src.
  const imageTag = (card.match(/<img class="pro_img[^>]*>/) || [])[0] || '';
  const image = (imageTag.match(/data-src="(https:\/\/[^"]+)"/) || imageTag.match(/src="(https:\/\/[^"]+)"/) || [])[1] || null;
  const url = new URL(href, `https://${store.domain}`).href;

  return {
    id: `${store.id}:${href}`,
    title: description ? `${name}: ${description}` : name,
    url,
    image,
    price,
    listPrice,
    pctOff,
  };
}
