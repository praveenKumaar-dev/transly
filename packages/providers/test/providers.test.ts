import { describe, expect, it, vi } from "vitest";
import { createTransly } from "@praveenkumar-k/transly-core";
import { libreTranslate, openAI, ProviderError } from "../src/index.js";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

describe("openAI provider", () => {
  it("sends batch once, parses, never leaks key in errors", async () => {
    const f = vi.fn(async (_u: any, init: any) => {
      const texts = JSON.parse(JSON.parse(init.body).messages[1].content).texts as string[];
      return json({
        choices: [{ message: { content: JSON.stringify({ translations: texts.map((t) => `T:${t}`) }) } }],
      });
    });
    const p = openAI({ apiKey: "sk-secret", fetch: f as any });
    expect((await p.translateBatch(["a", "b"], { to: "ta" })).map((r) => r.text)).toEqual(["T:a", "T:b"]);
    expect(f).toHaveBeenCalledTimes(1);
    expect((f.mock.calls[0]![1] as any).headers.authorization).toBe("Bearer sk-secret");
  });
  it("rejects malformed output", async () => {
    const p = openAI({
      apiKey: "k",
      retries: 0,
      fetch: (async () => json({ choices: [{ message: { content: '{"translations":["only one"]}' } }] })) as any,
    });
    await expect(p.translateBatch(["a", "b"], { to: "ta" })).rejects.toThrow(/Malformed/);
  });
  it("retries 429 then succeeds; does not retry 401", async () => {
    let n = 0;
    const ok = { choices: [{ message: { content: '{"translations":["x"]}' } }] };
    const p = openAI({ apiKey: "k", baseDelayMs: 1, fetch: (async () => (n++ < 1 ? json({}, 429) : json(ok))) as any });
    expect((await p.translate("a", { to: "ta" })).text).toBe("x");
    expect(n).toBe(2);
    let m = 0;
    const q = openAI({ apiKey: "bad", baseDelayMs: 1, fetch: (async () => (m++, json({}, 401))) as any });
    await expect(q.translate("a", { to: "ta" })).rejects.toMatchObject({ kind: "auth" });
    expect(m).toBe(1);
  });
});

describe("libretranslate + core", () => {
  it("works end-to-end through the engine", async () => {
    const f = vi.fn(async (_u: any, init: any) =>
      json({ translatedText: JSON.parse(init.body).q.map((s: string) => s.toUpperCase()) }),
    );
    const t = createTransly({
      sourceLanguage: "en",
      supportedLanguages: ["en", "ml"],
      provider: libreTranslate({ url: "http://lt:5000", fetch: f as any }),
    });
    expect(await t.translateBatch(["a", "b"], { to: "ml" })).toEqual(["A", "B"]);
    expect(f.mock.calls[0]![0]).toBe("http://lt:5000/translate");
  });
  it("classifies timeouts", async () => {
    const slow = ((_u: any, init: any) =>
      new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("abort"))))) as any;
    const p = libreTranslate({ url: "http://x", fetch: slow, timeoutMs: 10, retries: 0 });
    await expect(p.translate("a", { to: "ml" })).rejects.toBeInstanceOf(ProviderError);
  });
});
