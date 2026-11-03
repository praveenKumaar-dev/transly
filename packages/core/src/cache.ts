import type { CacheStore } from "./types.js";

export class MemoryCache implements CacheStore {
  private map = new Map<string, { v: string; exp: number }>();
  constructor(private opts: { max?: number; ttlMs?: number } = {}) {}
  get(key: string) {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, e); // LRU touch
    return e.v;
  }
  set(key: string, v: string) {
    this.map.delete(key);
    this.map.set(key, { v, exp: Date.now() + (this.opts.ttlMs ?? 86_400_000) });
    const max = this.opts.max ?? 5000;
    while (this.map.size > max) this.map.delete(this.map.keys().next().value as string);
  }
  delete(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
  get size() {
    return this.map.size;
  }
}

/** Non-cryptographic 53-bit hash (cyrb53); fine for cache keys, not for security. */
export function hash(str: string): string {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
