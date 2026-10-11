const DISABLED_KEY = 'shoppingTool.disabledStores';
const VIEW_KEY = 'shoppingTool.view';
const PAGE_SIZE = 60;
const RENDER_DELAY_MS = 60;
const SORTS = [
  ['best', 'Best of each store'],
  ['discount', 'Biggest discount'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
];

const state = {
  // 'local' when served by server.js (deals fetched on demand), 'static' on GitHub Pages
  // (deals fetched ahead of time by the build).
  mode: 'local',
  generatedAt: null,
  categories: [],
  stores: [],
  disabled: new Set(), // ids of stores the user has switched off
  category: 'all',
  sort: 'best',
  storeFilter: 'all',
  shown: PAGE_SIZE,
  results: new Map(), // store id -> { loading, data, failed }
};

const $ = (id) => document.getElementById(id);
const isLive = (store) => store.kind !== 'feed';

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

// Deal data comes from other sites, so only ever link to or load plain https URLs.
function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function formatPrice(amount) {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  });
}

function timeAgo(timestamp) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const plural = (count, noun) => `${count.toLocaleString('en-US')} ${noun}${count === 1 ? '' : 's'}`;

function readStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The choice just won't be remembered.
  }
}

function saveView() {
  writeStored(VIEW_KEY, { category: state.category, sort: state.sort });
  // Keeps the category in the address so a tab can be bookmarked or reloaded.
  history.replaceState(null, '', state.category === 'all' ? location.pathname + location.search : `#${state.category}`);
}

// --- Which stores and deals are on screen ----------------------------------

const inCategory = (store) => state.category === 'all' || store.category === state.category;
const enabledStores = () => state.stores.filter((store) => inCategory(store) && !state.disabled.has(store.id));

function viewStores() {
  const stores = enabledStores();
  return state.storeFilter === 'all' ? stores : stores.filter((store) => store.id === state.storeFilter);
}

const byDiscount = (a, b) => (b.deal.pctOff ?? -1) - (a.deal.pctOff ?? -1) || (b.deal.score ?? 0) - (a.deal.score ?? 0);
const byPrice = (direction) => (a, b) => {
  const [x, y] = [a.deal.price, b.deal.price];
  if (typeof x !== 'number' || typeof y !== 'number') return (typeof y === 'number') - (typeof x === 'number');
  return direction * (x - y);
};

function dealsInView() {
  const perStore = viewStores().map((store) =>
    (state.results.get(store.id)?.data?.deals || []).map((deal) => ({ deal, store })),
  );
  if (state.sort === 'discount') return perStore.flat().sort(byDiscount);
  if (state.sort === 'price-asc') return perStore.flat().sort(byPrice(1));
  if (state.sort === 'price-desc') return perStore.flat().sort(byPrice(-1));

  // "Best of each store": every store's top deal first, then every store's second, and so on,
  // so one store with a huge sale can't crowd out the rest. Each store's list arrives already
  // ranked (by discount for live prices, by votes and age for community deals).
  const merged = [];
  const longest = Math.max(0, ...perStore.map((deals) => deals.length));
  for (let round = 0; round < longest; round++) {
    merged.push(...perStore.map((deals) => deals[round]).filter(Boolean).sort(byDiscount));
  }
  return merged;
}

// --- Loading ---------------------------------------------------------------

const queue = [];
let running = 0;

function enqueue(id, refresh = false) {
  state.results.set(id, { loading: true, data: state.results.get(id)?.data || null });
  queue.push({ id, refresh });
  pump();
}

function pump() {
  // The hosted copy only downloads small ready-made files, so it can load more at once.
  const limit = state.mode === 'static' ? 8 : 3;
  while (running < limit && queue.length) {
    const job = queue.shift();
    running++;
    fetchDeals(job).finally(() => {
      running--;
      pump();
    });
  }
}

async function fetchDeals({ id, refresh }) {
  const previous = state.results.get(id)?.data || null;
  try {
    // Relative URL: on GitHub Pages the site lives under a sub-path, not at the domain root.
    const res = await fetch(`data/deals/${encodeURIComponent(id)}.json${refresh ? '?refresh' : ''}`);
    if (!res.ok) throw new Error(`the app returned an error (${res.status})`);
    state.results.set(id, { loading: false, data: await res.json() });
  } catch (err) {
    const offline = state.mode === 'local' ? 'the app server is not running' : 'the site could not be reached';
    const reason = err instanceof TypeError ? offline : err.message;
    state.results.set(id, { loading: false, data: previous, failed: reason });
  }
  scheduleRender();
}

function loadView() {
  for (const store of enabledStores()) {
    if (!state.results.has(store.id)) enqueue(store.id);
  }
}

// --- Rendering -------------------------------------------------------------

let renderTimer = null;

// Results arrive one store at a time; redraw once per burst rather than once per store.
function scheduleRender() {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    renderDeals();
  }, RENDER_DELAY_MS);
}

function dealCard({ deal, store }) {
  const url = safeUrl(deal.url);
  if (!url) return null;
  const image = safeUrl(deal.image);
  const img = image && el('img', { src: image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  if (img) img.addEventListener('error', () => img.remove());

  const badge = deal.pctOff ? `${deal.pctIsUpTo ? 'up to ' : ''}${deal.pctOff}% off` : null;
  const meta = [];
  if (deal.postedAt) {
    meta.push(`${deal.score > 0 ? '+' : ''}${deal.score} votes`, `posted ${timeAgo(deal.postedAt)}`);
    if (deal.merchant) meta.push(`sold at ${deal.merchant}`);
  }

  return el('a', { class: 'card', href: url, target: '_blank', rel: 'noopener noreferrer' },
    el('div', { class: 'thumb' }, img, badge && el('span', { class: 'badge' }, badge)),
    el('div', { class: 'card-body' },
      el('div', { class: 'card-store' }, store.name),
      el('div', { class: 'card-title' }, deal.title),
      deal.note && el('div', { class: 'note' }, deal.note),
      typeof deal.price === 'number' && el('div', { class: 'prices' },
        el('span', { class: 'price' }, formatPrice(deal.price)),
        deal.listPrice && el('s', { class: 'list-price' }, formatPrice(deal.listPrice)),
      ),
      meta.length > 0 && el('div', { class: 'meta' }, meta.join(' · ')),
    ),
  );
}

// One store's state in words, for the store list.
function storeStatus(store) {
  const result = state.results.get(store.id);
  if (!result) return '';
  if (result.loading && !result.data) return 'loading…';
  if (!result.data || (result.data.error && !result.data.stale)) return "couldn't load";
  const count = result.data.deals.length;
  const deals = count ? plural(count, 'deal') : 'no deals right now';
  return result.data.stale || result.failed ? `${deals}, from ${timeAgo(result.data.fetchedAt)}` : deals;
}

function summaryText(stores, dealCount) {
  const results = stores.map((store) => state.results.get(store.id));
  const pending = results.filter((result) => !result || result.loading).length;
  if (pending) return `Loading ${stores.length - pending} of ${plural(stores.length, 'store')}…`;

  const withDeals = results.filter((result) => result.data?.deals.length).length;
  const failed = results.filter((result) => !result.data || (result.data.error && !result.data.stale)).length;
  const older = results.filter((result) => result.data?.stale).length;
  const hidden = state.stores.filter((store) => inCategory(store) && state.disabled.has(store.id)).length;

  const parts = [`${plural(dealCount, 'deal')} from ${plural(withDeals, 'store')}`];
  if (state.mode === 'static' && state.generatedAt) parts.push(`updated ${timeAgo(state.generatedAt)}`);
  if (older) parts.push(`${plural(older, 'store')} showing older deals`);
  if (failed) parts.push(`${plural(failed, 'store')} couldn't be loaded`);
  if (hidden && state.storeFilter === 'all') parts.push(`${plural(hidden, 'store')} switched off`);
  return parts.join(' · ');
}

function renderDeals() {
  const stores = viewStores();
  const deals = dealsInView();
  const loading = stores.some((store) => !state.results.get(store.id) || state.results.get(store.id).loading);

  $('summary').textContent = stores.length ? summaryText(stores, deals.length) : '';

  let cards = deals.slice(0, state.shown).map(dealCard).filter(Boolean);
  if (!cards.length && loading) cards = Array.from({ length: 12 }, () => el('div', { class: 'skeleton' }));
  $('deals').replaceChildren(...cards);

  let empty = '';
  if (!stores.length) empty = 'Every store in this category is switched off. Use the Stores button to switch some back on.';
  else if (!deals.length && !loading) empty = 'No deals in this category right now.';
  $('empty').hidden = !empty;
  $('empty').textContent = empty;

  const remaining = deals.length - state.shown;
  $('show-more').hidden = remaining <= 0;
  $('show-more').textContent = `Show ${Math.min(PAGE_SIZE, Math.max(remaining, 0))} more (${Math.max(remaining, 0).toLocaleString('en-US')} left)`;
}

function renderTabs() {
  const tabs = [{ id: 'all', label: 'All' }, ...state.categories];
  $('category-tabs').replaceChildren(...tabs.map(({ id, label }) => el('button', {
    type: 'button',
    class: 'tab',
    'aria-pressed': String(state.category === id),
    onclick: () => showView({ category: id, storeFilter: 'all' }),
  }, label)));
  // On a phone the tabs scroll sideways; keep the chosen one on screen.
  $('category-tabs').querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  const off = state.disabled.size;
  $('choose-stores').textContent = off ? `Stores (${off} off)` : 'Stores';
}

function renderToolbar() {
  $('sort').replaceChildren(...SORTS.map(([value, label]) => el('option', { value, selected: state.sort === value }, label)));
  const stores = enabledStores().slice().sort((a, b) => a.name.localeCompare(b.name));
  $('store-filter').replaceChildren(
    el('option', { value: 'all', selected: state.storeFilter === 'all' }, `All ${stores.length} stores`),
    ...stores.map((store) => el('option', { value: store.id, selected: state.storeFilter === store.id }, store.name)),
  );
  $('refresh').hidden = state.mode !== 'local';
}

// Switch what is on screen, then load whatever that view still needs.
function showView(change = {}) {
  Object.assign(state, change, { shown: PAGE_SIZE });
  if (!enabledStores().some((store) => store.id === state.storeFilter)) state.storeFilter = 'all';
  saveView();
  renderTabs();
  renderToolbar();
  loadView();
  renderDeals();
}

function renderStoreList() {
  const term = $('store-search').value.trim().toLowerCase();
  const groups = [];
  for (const category of state.categories) {
    const all = state.stores.filter((store) => store.category === category.id);
    const stores = all.filter((store) => store.name.toLowerCase().includes(term));
    if (!stores.length) continue;
    const setAll = (enabled) => {
      for (const store of all) {
        if (enabled) state.disabled.delete(store.id);
        else state.disabled.add(store.id);
      }
      writeStored(DISABLED_KEY, [...state.disabled]);
      renderStoreList();
    };
    groups.push(
      el('div', { class: 'group-head' },
        el('h3', {}, category.label),
        el('button', { type: 'button', class: 'link-button', onclick: () => setAll(true) }, 'All on'),
        el('button', { type: 'button', class: 'link-button', onclick: () => setAll(false) }, 'All off'),
      ),
      el('div', { class: 'store-options' }, ...stores.map((store) => {
        const checkbox = el('input', { type: 'checkbox', checked: !state.disabled.has(store.id) });
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) state.disabled.delete(store.id);
          else state.disabled.add(store.id);
          writeStored(DISABLED_KEY, [...state.disabled]);
        });
        return el('label', { class: 'store-option' },
          checkbox,
          el('span', { class: 'name' }, store.name, el('span', { class: 'store-status' }, storeStatus(store))),
          el('span', { class: `kind ${isLive(store) ? 'kind-live' : 'kind-feed'}` }, isLive(store) ? 'Live prices' : 'Community deals'),
        );
      })),
    );
  }
  $('store-list').replaceChildren(...(groups.length ? groups : [el('p', { class: 'legend' }, 'No stores match that search.')]));
}

// --- Startup ---------------------------------------------------------------

async function start() {
  let catalog;
  try {
    const res = await fetch('data/stores.json');
    if (!res.ok) throw new Error();
    catalog = await res.json();
  } catch {
    $('empty').hidden = false;
    $('empty').textContent = "Couldn't load the store list. Reload to try again. If you're running the app on your own computer, make sure it's started (npm start).";
    return;
  }
  state.mode = catalog.mode;
  state.generatedAt = catalog.generatedAt || null;
  state.categories = catalog.categories;
  state.stores = catalog.stores;

  const known = new Set(state.stores.map((store) => store.id));
  const disabled = readStored(DISABLED_KEY, []);
  state.disabled = new Set((Array.isArray(disabled) ? disabled : []).filter((id) => known.has(id)));

  const validCategory = (id) => id === 'all' || state.categories.some((category) => category.id === id);
  const saved = readStored(VIEW_KEY, {}) || {};
  const fromAddress = location.hash.slice(1);
  if (validCategory(fromAddress)) state.category = fromAddress;
  else if (validCategory(saved.category)) state.category = saved.category;
  if (SORTS.some(([value]) => value === saved.sort)) state.sort = saved.sort;

  if (state.mode === 'static') {
    $('footnote').hidden = false;
    $('footnote').textContent = 'Deals are refreshed automatically several times a day, so a price may have changed since the last update. Check the store before buying.';
  }

  $('sort').addEventListener('change', () => showView({ sort: $('sort').value }));
  $('store-filter').addEventListener('change', () => showView({ storeFilter: $('store-filter').value }));
  $('show-more').addEventListener('click', () => {
    state.shown += PAGE_SIZE;
    renderDeals();
  });
  $('refresh').addEventListener('click', () => {
    for (const store of viewStores()) enqueue(store.id, true);
    renderDeals();
  });
  $('choose-stores').addEventListener('click', () => {
    $('store-search').value = '';
    renderStoreList();
    $('store-dialog').showModal();
  });
  $('store-search').addEventListener('input', renderStoreList);
  $('store-dialog').addEventListener('close', () => showView());

  showView();
}

start();
