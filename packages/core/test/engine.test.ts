import { describe, expect, it, vi } from "vitest";
import { createTransly, type TranslationProvider } from "../src/index.js";

const mock = () => {
  const translateBatch = vi.fn(async (texts: string[], o) =>
    texts.map((t) => ({ text: `[${o.to}]${t}`, provider: "mock" })),
  );
  const p: TranslationProvider = {
    id: "mock",
    translateBatch,
    translate: async (t, o) => (await translateBatch([t], o))[0]!,
  };
  return { p, translateBatch };
};
const base = {
  sourceLanguage: "en",
  supportedLanguages: ["en", "ta", "pt-BR", "pt"],
  messages: {
    en: {
      common: {
        welcome: "Welcome, {name}",
        only_en: "English only",
        cart_one: "{count} item",
        cart_other: "{count} items",
        a: { b: "nested" },
      },
    },
    ta: { common: { welcome: "வரவேற்பு, {name}" } },
  },
};

describe("t()", () => {
  it("translates, nests, falls back to source, returns key when missing", () => {
    const missing = vi.fn();
    const t = createTransly({ ...base, onMissingKey: missing });
    expect(t.t("welcome", { name: "P" })).toBe("Welcome, P");
    return t.setLanguage("ta").then(() => {
      expect(t.t("welcome", { name: "P" })).toBe("வரவேற்பு, P");
      expect(t.t("only_en")).toBe("English only");
      expect(t.t("a.b")).toBe("nested");
      expect(t.t("nope")).toBe("nope");
      expect(missing).toHaveBeenCalledWith("nope", "ta");
    });
  });
  it("plural suffix keys", () => {
    const t = createTransly(base);
    expect(t.t("cart", { count: 1 })).toBe("1 item");
    expect(t.t("cart", { count: 3 })).toBe("3 items");
  });
  it("regional fallback pt-BR -> pt", async () => {
    const t = createTransly({ ...base, messages: { ...base.messages, pt: { common: { hi: "Olá" } } } });
    await t.setLanguage("pt-BR");
    expect(t.t("hi")).toBe("Olá");
  });
  it("rejects unsupported language and notifies subscribers", async () => {
    const t = createTransly(base);
    const l = vi.fn();
    const off = t.subscribe(l);
    await expect(t.setLanguage("xx")).rejects.toMatchObject({ code: "UNSUPPORTED_LANGUAGE" });
    await t.setLanguage("ta");
    expect(l).toHaveBeenCalledWith({ type: "language", language: "ta" });
    off();
    await t.setLanguage("en");
    expect(l).toHaveBeenCalledTimes(1);
  });
  it("lazy namespaces via loader, reloaded for new language", async () => {
    const loader = vi.fn(async (l: string, n: string) => ({ title: `${l}/${n}` }));
    const t = createTransly({ ...base, loader });
    await t.loadNamespace("dash");
    expect(t.t("dash:title")).toBe("en/dash");
    await t.setLanguage("ta");
    expect(t.t("dash:title")).toBe("ta/dash");
    await t.loadNamespace("dash");
    expect(loader).toHaveBeenCalledTimes(3); // en/dash, ta/common, ta/dash
  });
  it("throws after dispose", () => {
    const t = createTransly(base);
    t.dispose();
    expect(() => t.t("x")).toThrow(/disposed/);
  });
});

describe("runtime translation", () => {
  it("batches, dedupes, and caches", async () => {
    const { p, translateBatch } = mock();
    const t = createTransly({ ...base, provider: p });
    const r = await t.translateBatch(["a", "b", "a"], { to: "ta" });
    expect(r).toEqual(["[ta]a", "[ta]b", "[ta]a"]);
    expect(translateBatch).toHaveBeenCalledTimes(1);
    expect(translateBatch.mock.calls[0]![0]).toEqual(["a", "b"]);
    await t.translate("a", { to: "ta" });
    expect(translateBatch).toHaveBeenCalledTimes(1); // cache hit
  });
  it("dedupes concurrent in-flight requests", async () => {
    const { p, translateBatch } = mock();
    const t = createTransly({ ...base, provider: p });
    const [x, y] = await Promise.all([t.translate("hello", { to: "ta" }), t.translate("hello", { to: "ta" })]);
    expect(x).toBe(y);
    expect(translateBatch).toHaveBeenCalledTimes(1);
  });
  it("cache key varies by context and language", async () => {
    const { p, translateBatch } = mock();
    const t = createTransly({ ...base, provider: p });
    await t.translate("Book", { to: "ta", context: "verb" });
    await t.translate("Book", { to: "ta", context: "noun" });
    await t.translate("Book", { to: "pt" });
    expect(translateBatch).toHaveBeenCalledTimes(3);
  });
  it("falls back to source when provider breaks placeholders", async () => {
    const bad: TranslationProvider = {
      id: "bad",
      translateBatch: async (ts) => ts.map(() => ({ text: "no placeholder", provider: "bad" })),
      translate: async () => ({ text: "", provider: "bad" }),
    };
    const t = createTransly({ ...base, provider: bad });
    expect(await t.translate("Hi {name}", { to: "ta" })).toBe("Hi {name}");
  });
  it("chunks by batchSize and keeps order", async () => {
    const { p, translateBatch } = mock();
    const t = createTransly({ ...base, provider: p, batchSize: 2 });
    const r = await t.translateBatch(["1", "2", "3"], { to: "ta" });
    expect(r).toEqual(["[ta]1", "[ta]2", "[ta]3"]);
    expect(translateBatch).toHaveBeenCalledTimes(2);
  });
  it("translateObject preserves shape", async () => {
    const { p } = mock();
    const t = createTransly({ ...base, provider: p });
    expect(await t.translateObject({ a: "x", n: { b: "y" } }, { to: "ta" })).toEqual({ a: "[ta]x", n: { b: "[ta]y" } });
  });
  it("same-language is a no-op; no provider errors clearly", async () => {
    const t = createTransly(base);
    expect(await t.translate("x", { to: "en" })).toBe("x");
    await expect(t.translate("x", { to: "ta" })).rejects.toMatchObject({ code: "NO_PROVIDER" });
  });
  it("does not poison cache on failure", async () => {
    let n = 0;
    const flaky: TranslationProvider = {
      id: "f",
      translate: async () => {
        throw 0;
      },
      translateBatch: async (ts) => {
        if (n++ === 0) throw new Error("x");
        return ts.map((t) => ({ text: t + "!", provider: "f" }));
      },
    };
    const t = createTransly({ ...base, provider: flaky });
    await expect(t.translate("a", { to: "ta" })).rejects.toThrow();
    expect(await t.translate("a", { to: "ta" })).toBe("a!");
  });
});
