const STORAGE_KEY = 'shoppingTool.selectedStores';
const DEFAULT_STORES = ['kate-spade-outlet', 'kate-spade', 'pandora', 'coach-outlet', 'best-buy', 'micro-center', 'newegg', 'rebecca-minkoff', 'lovense'];
const CATEGORIES = [['all', 'All'], ['fashion', 'Fashion'], ['tech', 'Tech'], ['general', 'Everything stores']];
const PREVIEW_COUNT = 12;
const MAX_PARALLEL = 3;
const TOP_PICKS_PER_STORE = 3;
const TOP_PICKS_TOTAL = 12;

const state = {
  stores: [],
  selected: new Set(),
  category: 'all',
  results: new Map(), // store id -> { loading, data, failed }
  expanded: new Set(),
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

function loadSelection() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    // Fall through to the defaults.
  }
  return DEFAULT_STORES;
}

function saveSelection() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.selected]));
  } catch {
    // Selection just won't persist.
  }
}

function visibleStores() {
  return state.stores.filter(
    (store) => state.selected.has(store.id) && (state.category === 'all' || store.category === state.category),
  );
}

// --- Loading -------------------------------------------------------------

const queue = [];
let running = 0;

function enqueue(id, refresh = false) {
  state.results.set(id, { loading: true, data: state.results.get(id)?.data || null });
  queue.push({ id, refresh });
  pump();
}

function pump() {
  while (running < MAX_PARALLEL && queue.length) {
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
    const res = await fetch(`/api/deals?store=${encodeURIComponent(id)}${refresh ? '&refresh' : ''}`);
    if (!res.ok) throw new Error(`the app returned an error (${res.status})`);
    state.results.set(id, { loading: false, data: await res.json() });
  } catch (err) {
    const reason = err instanceof TypeError ? 'the app server is not running' : err.message;
    state.results.set(id, { loading: false, data: previous, failed: reason });
  }
  renderStore(id);
  renderTopPicks();
}

// --- Rendering -----------------------------------------------------------

function dealCard(deal, { storeName } = {}) {
  const url = safeUrl(deal.url);
  if (!url) return null;
  const image = safeUrl(deal.image);
  const img = image && el('img', { src: image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
  if (img) img.addEventListener('error', () => img.remove());

  const badge = deal.pctOff ? `${deal.pctIsUpTo ? 'up to ' : ''}${deal.pctOff}% off` : null;
  const meta = [];
  if (storeName) meta.push(storeName);
  if (deal.postedAt) {
    meta.push(`${deal.score > 0 ? '+' : ''}${deal.score} votes`, `posted ${timeAgo(deal.postedAt)}`);
    if (deal.merchant) meta.push(`sold at ${deal.merchant}`);
  }

  return el('a', { class: 'card', href: url, target: '_blank', rel: 'noopener noreferrer' },
    el('div', { class: 'thumb' }, img, badge && el('span', { class: 'badge' }, badge)),
    el('div', { class: 'card-body' },
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

function statusFor(store, result) {
  if (!result || (result.loading && !result.data)) return { text: 'Loading…' };
  if (result.failed && !result.data) return { text: `Couldn't load: ${result.failed}.`, error: true };
  const { data } = result;
  const updated = `updated ${timeAgo(data.fetchedAt)}`;
  if (result.loading) return { text: 'Refreshing…' };
  if (result.failed) return { text: `Refresh failed: ${result.failed}. Showing results ${updated}.`, error: true };
  if (data.error && data.stale) return { text: `Refresh failed: ${data.error}. Showing results ${updated}.`, error: true };
  if (data.error) return { text: `Couldn't load: ${data.error}.`, error: true };
  const count = data.deals.length;
  return { text: `${count} deal${count === 1 ? '' : 's'} · ${updated}` };
}

function renderStore(id) {
  const section = document.querySelector(`[data-store="${CSS.escape(id)}"]`);
  const store = state.stores.find((s) => s.id === id);
  if (!section || !store) return;

  const result = state.results.get(id);
  const status = statusFor(store, result);
  const deals = result?.data?.deals || [];
  const expanded = state.expanded.has(id);

  const head = el('div', { class: 'store-head' },
    el('h2', {}, store.name),
    el('span', { class: `kind ${isLive(store) ? 'kind-live' : 'kind-feed'}` }, isLive(store) ? 'Live prices' : 'Community deals'),
    el('span', { class: `status${status.error ? ' error' : ''}` }, status.text),
    el('button', { type: 'button', class: 'link-button', disabled: result?.loading, onclick: () => { enqueue(id, true); renderStore(id); } }, 'Refresh'),
  );

  let body;
  if (!result || (result.loading && !result.data)) {
    body = el('div', { class: 'grid' }, ...Array.from({ length: 6 }, () => el('div', { class: 'skeleton' })));
  } else if (!deals.length) {
    const failed = status.error;
    const message = failed
      ? 'No deals to show for this store right now.'
      : isLive(store)
        ? `${store.name} has nothing marked down in the pages this app checks.`
        : `No deals mentioning ${store.name} were posted on Slickdeals in the last 60 days.`;
    body = el('div', { class: 'empty' }, message);
  } else {
    const shown = expanded ? deals : deals.slice(0, PREVIEW_COUNT);
    body = el('div', { class: 'grid' }, ...shown.map((deal) => dealCard(deal)));
  }

  const more = deals.length > PREVIEW_COUNT && el('button', {
    type: 'button',
    class: 'link-button more',
    onclick: () => {
      if (expanded) state.expanded.delete(id);
      else state.expanded.add(id);
      renderStore(id);
    },
  }, expanded ? 'Show fewer' : `Show all ${deals.length}`);

  section.replaceChildren(head, body, more || '');
}

function renderTopPicks() {
  const picks = [];
  for (const store of visibleStores().filter(isLive)) {
    const deals = state.results.get(store.id)?.data?.deals || [];
    for (const deal of deals.slice(0, TOP_PICKS_PER_STORE)) picks.push({ deal, storeName: store.name });
  }
  picks.sort((a, b) => b.deal.pctOff - a.deal.pctOff);
  $('top-picks').hidden = picks.length === 0;
  $('top-picks-grid').replaceChildren(
    ...picks.slice(0, TOP_PICKS_TOTAL).map(({ deal, storeName }) => dealCard(deal, { storeName })).filter(Boolean),
  );
}

function renderSections() {
  const stores = visibleStores();
  $('store-sections').replaceChildren(...stores.map((store) => el('section', { class: 'store', 'data-store': store.id })));
  $('empty-page').hidden = stores.length > 0;
  for (const store of stores) {
    if (!state.results.has(store.id)) enqueue(store.id);
    renderStore(store.id);
  }
  renderTopPicks();
}

function renderTabs() {
  $('category-tabs').replaceChildren(...CATEGORIES.map(([id, label]) => el('button', {
    type: 'button',
    class: 'tab',
    'aria-pressed': String(state.category === id),
    onclick: () => {
      state.category = id;
      renderTabs();
      renderSections();
    },
  }, label)));
  $('choose-stores').textContent = `Stores (${state.selected.size})`;
}

function renderStoreList() {
  const term = $('store-search').value.trim().toLowerCase();
  const groups = [];
  for (const [category, label] of CATEGORIES.slice(1)) {
    const stores = state.stores.filter((s) => s.category === category && s.name.toLowerCase().includes(term));
    if (!stores.length) continue;
    groups.push(
      el('h3', {}, label),
      el('div', { class: 'store-options' }, ...stores.map((store) => {
        const checkbox = el('input', { type: 'checkbox', checked: state.selected.has(store.id) });
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) state.selected.add(store.id);
          else state.selected.delete(store.id);
          saveSelection();
          renderTabs();
        });
        return el('label', { class: 'store-option' },
          checkbox,
          el('span', { class: 'name' }, store.name),
          el('span', { class: `kind ${isLive(store) ? 'kind-live' : 'kind-feed'}` }, isLive(store) ? 'Live prices' : 'Community deals'),
        );
      })),
    );
  }
  $('store-list').replaceChildren(...(groups.length ? groups : [el('p', { class: 'legend' }, 'No stores match that search.')]));
}

// --- Startup -------------------------------------------------------------

async function start() {
  try {
    const res = await fetch('/api/stores');
    if (!res.ok) throw new Error();
    state.stores = await res.json();
  } catch {
    $('empty-page').hidden = false;
    $('empty-page').textContent = "Couldn't load the store list. Make sure the app is running (npm start), then reload.";
    return;
  }
  const known = new Set(state.stores.map((s) => s.id));
  state.selected = new Set(loadSelection().filter((id) => known.has(id)));

  $('choose-stores').addEventListener('click', () => {
    $('store-search').value = '';
    renderStoreList();
    $('store-dialog').showModal();
  });
  $('store-search').addEventListener('input', renderStoreList);
  $('store-dialog').addEventListener('close', renderSections);

  renderTabs();
  renderSections();
}

start();
