// Outbound requests identify themselves honestly. A store that refuses this client is treated as
// unavailable rather than worked around.
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingTool/0.1; personal use)';
const MAX_CONCURRENT = 4;
const MAX_REDIRECTS = 5;
const RETRY_DELAY_MS = 3000;
const MAX_RETRY_DELAY_MS = 10000;

export class FetchError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

let active = 0;
const waiting = [];

async function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else active--;
}

function describeStatus(status) {
  if (status === 403) return 'Store refused automated access (HTTP 403)';
  if (status === 429) return 'Store is limiting how often it can be checked (HTTP 429)';
  if (status === 503) return 'Store is temporarily unavailable (HTTP 503)';
  if (status === 404) return 'Page not found (HTTP 404)';
  return `Unexpected response (HTTP ${status})`;
}

// How long a "slow down" response asks us to wait, capped so one store can't stall everything.
function retryDelayMs(res) {
  const seconds = Number(res.headers.get('retry-after'));
  return Math.min(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : RETRY_DELAY_MS, MAX_RETRY_DELAY_MS);
}

export async function fetchText(url, { timeoutMs = 20000 } = {}) {
  await acquire();
  try {
    const cookies = new Map();
    let current = url;
    let retried = false;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const headers = { 'User-Agent': USER_AGENT, Accept: '*/*' };
      if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      // The time limit applies to each request, not to the wait before a retry.
      let res;
      try {
        res = await fetch(current, { headers, signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
      } catch (err) {
        // A connection that fails to open (as opposed to a slow store) is usually momentary.
        if (retried || err.name === 'TimeoutError' || err.name === 'AbortError') throw err;
        retried = true;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        const next = new URL(location, current);
        // Some stores redirect a page to itself once to set cookies, so carry them on same-host hops.
        if (next.host !== new URL(current).host) cookies.clear();
        else {
          for (const cookie of res.headers.getSetCookie()) {
            const [pair] = cookie.split(';');
            const eq = pair.indexOf('=');
            if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
          }
        }
        await res.body?.cancel();
        current = next.href;
        continue;
      }
      // A busy or rate-limiting store gets one more try after waiting as long as it asks.
      if ((res.status === 429 || res.status === 503) && !retried) {
        retried = true;
        await res.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(res)));
        continue;
      }
      if (!res.ok) throw new FetchError(describeStatus(res.status), res.status);
      return await res.text();
    }
    throw new FetchError('Too many redirects');
  } catch (err) {
    if (err instanceof FetchError) throw err;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new FetchError('Store took too long to respond');
    throw new FetchError(`Network error (${err.cause?.code || err.message})`);
  } finally {
    release();
  }
}
