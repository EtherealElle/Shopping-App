import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = path.join(import.meta.dirname, '..', '.cache');

export async function readCache(key) {
  try {
    return JSON.parse(await readFile(path.join(CACHE_DIR, `${key}.json`), 'utf8'));
  } catch {
    return null;
  }
}

export async function writeCache(key, value) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(value));
}
