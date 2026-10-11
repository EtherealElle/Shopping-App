import { fetchText, FetchError } from '../http.js';

// Magento stores publish their catalog through a GraphQL endpoint. Markdowns sit in a named
// category, so find that category by name and read its products' regular and current prices.
const PAGE_SIZE = 100;
const MAX_PAGES = 4;
const MAX_DEALS = 60;
const MIN_PCT_OFF = 5;
const PRODUCT_FIELDS = 'name url_key url_suffix small_image{url} price_range{minimum_price{regular_price{value} final_price{value}}}';

async function query(store, graphql) {
  const body = await fetchText(`https://${store.domain}/graphql?query=${encodeURIComponent(graphql)}`, { timeoutMs: 30000 });
  let data;
  try {
    ({ data } = JSON.parse(body));
  } catch {
    // Handled below.
  }
  if (!data) throw new FetchError('Store did not return catalog data');
  return data;
}

export async function fetchMagentoDeals(store) {
  const { categoryList } = await query(store, `{categoryList(filters:{name:{match:${JSON.stringify(store.saleCategory)}}}){uid product_count}}`);
  const [category] = (categoryList || []).sort((a, b) => b.product_count - a.product_count);
  if (!category) throw new FetchError(`Store has no "${store.saleCategory}" category`);

  const byUrl = new Map();
  for (let page = 1; page <= MAX_PAGES; page++) {
    let products;
    try {
      ({ products } = await query(store, `{products(filter:{category_uid:{eq:${JSON.stringify(category.uid)}}},pageSize:${PAGE_SIZE},currentPage:${page}){page_info{total_pages} items{${PRODUCT_FIELDS}}}}`));
    } catch (err) {
      if (page > 1) break;
      throw err;
    }
    for (const item of products?.items || []) {
      const deal = toDeal(store, item);
      if (deal && !byUrl.has(deal.url)) byUrl.set(deal.url, deal);
    }
    if (page >= (products?.page_info?.total_pages || 0)) break;
  }
  return [...byUrl.values()].sort((a, b) => b.pctOff - a.pctOff).slice(0, MAX_DEALS);
}

function toDeal(store, item) {
  const prices = item.price_range?.minimum_price;
  const price = Number(prices?.final_price?.value);
  const listPrice = Number(prices?.regular_price?.value);
  if (!item.name || !item.url_key || !(price > 0) || !(listPrice > price)) return null;
  const pctOff = Math.round((1 - price / listPrice) * 100);
  if (pctOff < MIN_PCT_OFF) return null;
  const url = `https://${store.domain}/${item.url_key}${item.url_suffix || ''}`;
  return {
    id: `${store.id}:${item.url_key}`,
    title: item.name,
    url,
    image: item.small_image?.url || null,
    price,
    listPrice,
    pctOff,
  };
}
