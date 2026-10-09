// Outbound requests identify themselves honestly. A store that refuses this client is treated as
// unavailable rather than worked around.
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingTool/0.1; personal use)';
const MAX_CONCURRENT = 4;
const MAX_REDIRECTS = 5;

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
  if (status === 403 || status === 429 || status === 503) return `Store refused automated access (HTTP ${status})`;
  if (status === 404) return 'Page not found (HTTP 404)';
  return `Unexpected response (HTTP ${status})`;
}

export async function fetchText(url, { timeoutMs = 20000 } = {}) {
  await acquire();
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    const cookies = new Map();
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const headers = { 'User-Agent': USER_AGENT, Accept: '*/*' };
      if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      const res = await fetch(current, { headers, signal, redirect: 'manual' });
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
