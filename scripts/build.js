// Builds the static site for GitHub Pages into dist/: the page itself plus one JSON file of deals
// per store. Pass --save-snapshot to also record this run's results in snapshot/.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CATEGORIES, STORES, publicStore } from '../lib/stores.js';
import { fetchDeals, failedResult } from '../lib/deals.js';

const ROOT = path.join(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const SNAPSHOT_DIR = path.join(ROOT, 'snapshot');
const SAVE_SNAPSHOT = process.argv.includes('--save-snapshot');
// Where the previous build is being served, if anywhere.
const PREVIOUS_SITE_URL = process.env.PREVIOUS_SITE_URL?.replace(/\/+$/, '');
const PARALLEL_STORES = 4;
const FEED_PAUSE_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// A store that can't be read this time keeps its most recent good deals, taken from the snapshot
// committed in the repo or from the site as currently published, whichever is newer.
async function lastGoodResult(store) {
  const candidates = [
    await readJson(path.join(SNAPSHOT_DIR, `${store.id}.json`)),
    PREVIOUS_SITE_URL ? await fetchJson(`${PREVIOUS_SITE_URL}/data/deals/${store.id}.json`) : null,
  ].filter((result) => result && Array.isArray(result.deals) && Number.isFinite(result.fetchedAt) && (!result.error || result.stale));
  if (!candidates.length) return null;
  const { stale, error, ...latest } = candidates.sort((a, b) => b.fetchedAt - a.fetchedAt)[0];
  return latest;
}

async function buildStore(store) {
  let result;
  try {
    result = await fetchDeals(store);
    if (SAVE_SNAPSHOT) await writeJson(path.join(SNAPSHOT_DIR, `${store.id}.json`), result);
    console.log(`ok    ${store.name}: ${result.deals.length} deals`);
  } catch (err) {
    result = failedResult(store, await lastGoodResult(store), err);
    console.log(`FAIL  ${store.name}: ${err.message}${result.stale ? ` (keeping ${result.deals.length} earlier deals)` : ''}`);
  }
  await writeJson(path.join(OUT_DIR, 'data', 'deals', `${store.id}.json`), result);
  return result;
}

async function buildStores(stores, parallel, pauseMs = 0) {
  const queue = [...stores];
  const results = [];
  await Promise.all(Array.from({ length: parallel }, async () => {
    for (let store = queue.shift(); store; store = queue.shift()) {
      results.push(await buildStore(store));
      if (pauseMs) await sleep(pauseMs);
    }
  }));
  return results;
}

await rm(OUT_DIR, { recursive: true, force: true });
await cp(path.join(ROOT, 'public'), OUT_DIR, { recursive: true });
await writeJson(path.join(OUT_DIR, 'data', 'stores.json'), {
  mode: 'static',
  generatedAt: Date.now(),
  categories: CATEGORIES,
  stores: STORES.map(publicStore),
});

// Every community feed comes from one site, so those are fetched one at a time with a pause.
const results = (await Promise.all([
  buildStores(STORES.filter((store) => store.kind !== 'feed'), PARALLEL_STORES),
  buildStores(STORES.filter((store) => store.kind === 'feed'), 1, FEED_PAUSE_MS),
])).flat();

const failed = results.filter((result) => result.error);
console.log(`\n${results.length - failed.length} of ${results.length} stores updated, ${failed.filter((r) => r.stale).length} kept earlier deals, ${failed.filter((r) => !r.stale).length} have nothing to show.`);
// If nothing at all could be read, fail so a broken run doesn't replace the published site.
if (failed.length === results.length) process.exit(1);
