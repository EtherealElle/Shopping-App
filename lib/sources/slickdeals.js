import { fetchText } from '../http.js';
import { decodeEntities, toNumber } from '../text.js';

// For retailers that don't expose their catalog, read Slickdeals' public search RSS feed: deals
// posted and voted on by its community. Prices here are whatever the poster reported.
const MAX_AGE_DAYS = 60;
const MAX_DEALS = 40;
const DAY_MS = 24 * 60 * 60 * 1000;
const LEAD_LENGTH = 80;
const NOT_A_DEAL = /sweepstakes|giveaway/i;
const PRICE = String.raw`\$\s?(\d[\d,]*(?:\.\d{1,2})?)`;
const LIST_PRICE = new RegExp(String.raw`(?:reg(?:ular(?:ly)?)?\.?|was|list(?:\s+price)?|orig(?:inal(?:ly)?)?\.?|msrp|retail(?:s)?(?:\s+for)?)[:\s]*${PRICE}`, 'i');

function tagContent(item, name) {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match ? match[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '') : '';
}

const plainText = (html) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export async function fetchFeedDeals(store) {
  const query = encodeURIComponent(store.query);
  const xml = await fetchText(`https://slickdeals.net/newsearch.php?q=${query}&searcharea=deals&searchin=first&rss=1`);
  const now = Date.now();
  const deals = [];
  for (const item of xml.split(/<item[\s>]/).slice(1)) {
    const deal = toDeal(store, item, now);
    if (deal) deals.push(deal);
  }
  return deals.sort((a, b) => b.rank - a.rank).slice(0, MAX_DEALS).map(({ rank, ...deal }) => deal);
}

function toDeal(store, item, now) {
  const title = plainText(tagContent(item, 'title'));
  const description = plainText(tagContent(item, 'description'));
  const content = tagContent(item, 'content:encoded');
  const postedAt = Date.parse(tagContent(item, 'pubDate'));
  const url = threadUrl(decodeEntities(tagContent(item, 'link')).trim());
  if (!title || !url || !Number.isFinite(postedAt)) return null;

  const ageDays = (now - postedAt) / DAY_MS;
  if (ageDays > MAX_AGE_DAYS) return null;

  // Search results are loose, so keep only posts that link out to the store or name it up front
  // (in the title or the opening of the description, as in "Best Buy has ...").
  const merchant = (content.match(/data-product-exitWebsite="([^"]+)"/) || [])[1] || null;
  const text = `${title} ${description}`;
  const soldByStore = Boolean(merchant) && (merchant === store.domain || merchant.endsWith(`.${store.domain}`));
  if (!soldByStore && !store.match.test(`${title} ${description.slice(0, LEAD_LENGTH)}`)) return null;
  if (NOT_A_DEAL.test(title) || store.exclude?.test(text)) return null;

  const score = Number((content.match(/Thumb Score:\s*([+-]?\d+)/) || [])[1] || 0);
  const price = dealPrice(title);
  const listMatch = text.match(LIST_PRICE);
  const listPrice = listMatch && price && toNumber(listMatch[1]) > price ? toNumber(listMatch[1]) : null;
  const pctMatch = title.match(/(up to\s+)?(\d{1,2})%\s*off/i);
  const pctIsUpTo = !listPrice && Boolean(pctMatch?.[1]);

  let pctOff = null;
  if (listPrice) pctOff = Math.round((1 - price / listPrice) * 100);
  else if (pctMatch) pctOff = Number(pctMatch[2]);

  return {
    id: `${store.id}:${(tagContent(item, 'guid') || url).trim()}`,
    title,
    url,
    image: (content.match(/<img[^>]+src="(https:\/\/[^"]+)"/) || [])[1] || null,
    price,
    listPrice,
    pctOff,
    pctIsUpTo,
    score,
    postedAt,
    merchant: soldByStore ? null : merchant,
    // Favor well-voted posts, discounted by age because old deals are usually dead, and boosted
    // when the post is clearly about this store rather than mentioning it in passing.
    rank: ((score + 3) / Math.pow(ageDays + 2, 1.2)) * (soldByStore || store.match.test(title.slice(0, LEAD_LENGTH / 2)) ? 2 : 1),
  };
}

// Titles often carry more than one dollar figure ("Two $50 gift cards for $80", "under $50 sale",
// "free shipping on $35+"). Prefer an explicit "for $X", then the first figure that isn't a threshold.
function dealPrice(title) {
  const explicit = title.match(new RegExp(String.raw`\bfor\s+${PRICE}`, 'i'));
  if (explicit) return toNumber(explicit[1]);
  for (const match of title.matchAll(new RegExp(String.raw`(\b[\w/]+\s+)?${PRICE}(\+|\s+off\b)?`, 'gi'))) {
    const [, before = '', amount, after] = match;
    if (after || /^(under|over|on|off|save|w\/|with|orders?|above|below)\s+$/i.test(before)) continue;
    return toNumber(amount);
  }
  return null;
}

function threadUrl(link) {
  try {
    const url = new URL(link);
    if (url.protocol !== 'https:' || url.hostname !== 'slickdeals.net') return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}
