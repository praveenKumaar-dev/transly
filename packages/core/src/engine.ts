import { MemoryCache, hash } from "./cache.js";
import { formatMessage, placeholdersMatch } from "./format.js";
import type { Listener, Messages, Params, TranslationOptions, TranslyConfig } from "./types.js";

export class TranslyError extends Error {
  constructor(
    message: string,
    readonly code: "NO_PROVIDER" | "UNSUPPORTED_LANGUAGE" | "DISPOSED" | "ABORTED",
  ) {
    super(message);
    this.name = "TranslyError";
  }
}

export interface Transly {
  t(key: string, params?: Params): string;
  translate(text: string, options: Omit<TranslationOptions, "to"> & { to?: string }): Promise<string>;
  translateBatch(texts: string[], options: Omit<TranslationOptions, "to"> & { to?: string }): Promise<string[]>;
  translateObject<T extends Messages>(obj: T, options?: Omit<TranslationOptions, "to"> & { to?: string }): Promise<T>;
  setLanguage(language: string): Promise<void>;
  getLanguage(): string;
  getAvailableLanguages(): string[];
  subscribe(listener: Listener): () => void;
  loadNamespace(namespace: string, language?: string): Promise<void>;
  dispose(): void;
}

function lookup(msgs: Messages | undefined, path: string): string | undefined {
  let cur: string | Messages | undefined = msgs;
  for (const p of path.split(".")) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function createTransly(config: TranslyConfig): Transly {
  const { sourceLanguage, supportedLanguages } = config;
  const ns0 = config.defaultNamespace ?? "common";
  const cache = config.cache ?? new MemoryCache();
  const batchSize = config.batchSize ?? 50;
  const store = new Map<string, Messages>(); // `${lang}:${ns}`
  for (const [l, nss] of Object.entries(config.messages ?? {}))
    for (const [n, m] of Object.entries(nss)) store.set(`${l}:${n}`, m);
  const loaded = new Set<string>();
  const inflight = new Map<string, Promise<string>>();
  const listeners = new Set<Listener>();
  let language = config.defaultLanguage ?? sourceLanguage;
  let disposed = false;
  const check = () => {
    if (disposed) throw new TranslyError("Instance disposed", "DISPOSED");
  };
  const supported = (l: string) => {
    if (!supportedLanguages.includes(l)) throw new TranslyError(`Unsupported language: ${l}`, "UNSUPPORTED_LANGUAGE");
  };
  const emit = (e: Parameters<Listener>[0]) => listeners.forEach((l) => l(e));

  function chain(lang: string): string[] {
    const out = [lang, ...(config.fallbacks?.[lang] ?? [])];
    const base = lang.split("-")[0]!;
    if (base !== lang) out.push(base);
    out.push(config.defaultLanguage ?? sourceLanguage, sourceLanguage);
    return [...new Set(out)];
  }

  function cacheKey(text: string, from: string, to: string, ctx?: string) {
    const p = config.provider;
    return `tr:${hash([text, from, to, p?.id, p?.model, ctx, config.glossaryVersion, config.configVersion].join("\u0000"))}`;
  }

  function validated(src: string, out: string): string {
    return out.trim() && placeholdersMatch(src, out) ? out : src; // unsafe output falls back to source
  }

  async function runBatch(texts: string[], o: TranslationOptions): Promise<string[]> {
    if (!config.provider) throw new TranslyError("No translation provider configured", "NO_PROVIDER");
    const res: string[] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      if (o.signal?.aborted) throw new TranslyError("Aborted", "ABORTED");
      const chunk = texts.slice(i, i + batchSize);
      const r = await config.provider.translateBatch(chunk, o);
      if (r.length !== chunk.length) throw new Error("Provider returned wrong number of results");
      res.push(...r.map((x, j) => validated(chunk[j]!, x.text)));
    }
    return res;
  }

  async function batch(texts: string[], opts: Omit<TranslationOptions, "to"> & { to?: string }): Promise<string[]> {
    check();
    const to = opts.to ?? language,
      from = opts.from ?? sourceLanguage;
    supported(to);
    if (to === from) return [...texts];
    const o: TranslationOptions = { ...opts, from, to };
    const out: string[] = new Array(texts.length);
    const misses = new Map<string, number[]>(); // unique text -> positions
    await Promise.all(
      texts.map(async (t, i) => {
        if (!t.trim()) {
          out[i] = t;
          return;
        }
        const hit = await cache.get(cacheKey(t, from, to, opts.context));
        if (hit !== undefined) out[i] = hit;
        else misses.set(t, [...(misses.get(t) ?? []), i]);
      }),
    );
    const unique: string[] = [],
      waiting: Promise<void>[] = [];
    for (const t of misses.keys()) {
      const k = cacheKey(t, from, to, opts.context);
      const existing = inflight.get(k);
      if (existing)
        waiting.push(
          existing.then((v) => {
            for (const i of misses.get(t)!) out[i] = v;
          }),
        );
      else unique.push(t);
    }
    if (unique.length) {
      const p = runBatch(unique, o);
      for (const [n, t] of unique.entries()) {
        const k = cacheKey(t, from, to, opts.context);
        const single = p.then((r) => r[n]!);
        inflight.set(k, single);
        single.then(
          () => inflight.delete(k),
          () => inflight.delete(k),
        );
      }
      const r = await p;
      await Promise.all(
        unique.map(async (t, n) => {
          await cache.set(cacheKey(t, from, to, opts.context), r[n]!);
          for (const i of misses.get(t)!) out[i] = r[n]!;
        }),
      );
    }
    await Promise.all(waiting);
    return out;
  }

  const engine: Transly = {
    t(key, params) {
      check();
      const colon = key.indexOf(":");
      const ns = colon > 0 ? key.slice(0, colon) : ns0;
      const path = colon > 0 ? key.slice(colon + 1) : key;
      for (const lang of chain(language)) {
        const msgs = store.get(`${lang}:${ns}`);
        let msg: string | undefined;
        if (typeof params?.count === "number") {
          const cat = new Intl.PluralRules(lang).select(params.count);
          msg = lookup(msgs, `${path}_${cat}`) ?? lookup(msgs, `${path}_other`);
        }
        msg ??= lookup(msgs, path);
        if (msg !== undefined) return formatMessage(msg, params, lang);
      }
      config.onMissingKey?.(key, language);
      return path;
    },
    translate: async (text, o) => (await batch([text], o))[0]!,
    translateBatch: batch,
    async translateObject(obj, o = {}) {
      const strings: string[] = [];
      const walk = (v: Messages, f: (s: string) => string): Messages =>
        Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === "string" ? f(x) : walk(x, f)]));
      walk(obj, (s) => (strings.push(s), s));
      const tr = await batch(strings, o);
      let i = 0;
      return walk(obj, () => tr[i++]!) as typeof obj;
    },
    async setLanguage(l) {
      check();
      supported(l);
      if (config.loader) {
        const nss = new Set([ns0, ...[...loaded].map((k) => k.slice(k.indexOf(":") + 1))]);
        await Promise.all([...nss].map((n) => engine.loadNamespace(n, l)));
      }
      language = l;
      emit({ type: "language", language: l });
    },
    getLanguage: () => language,
    getAvailableLanguages: () => [...supportedLanguages],
    subscribe(l) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    async loadNamespace(namespace, lang = language) {
      check();
      const k = `${lang}:${namespace}`;
      if (!config.loader || loaded.has(k)) return;
      store.set(k, await config.loader(lang, namespace));
      loaded.add(k);
      emit({ type: "namespace", language: lang, namespace });
    },
    dispose() {
      disposed = true;
      listeners.clear();
      inflight.clear();
    },
  };
  return engine;
}
