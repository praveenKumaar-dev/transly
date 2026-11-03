import type { TranslationOptions, TranslationProvider, TranslationResult } from "@transly/core";
import { postJson, type HttpOptions } from "./http.js";

export function libreTranslate(cfg: { url: string; apiKey?: string } & HttpOptions): TranslationProvider {
  const call = async (q: string[], o: TranslationOptions) => {
    const d = await postJson(
      `${cfg.url.replace(/\/$/, "")}/translate`,
      { q, source: o.from ?? "auto", target: o.to, format: "text", ...(cfg.apiKey ? { api_key: cfg.apiKey } : {}) },
      {},
      cfg,
      o.signal,
    );
    const arr: unknown = d?.translatedText;
    if (!Array.isArray(arr) || arr.length !== q.length) throw new Error("Malformed provider response");
    return arr.map((text): TranslationResult => ({ text: String(text), provider: "libretranslate" }));
  };
  return { id: "libretranslate", translateBatch: call, translate: async (t, o) => (await call([t], o))[0]! };
}
