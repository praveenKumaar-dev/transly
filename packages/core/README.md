# @transly/core

Framework-independent translation engine. Zero runtime dependencies. Works in Node 18+, browsers, edge runtimes.

```bash
npm install @transly/core
```

```ts
import { createTransly } from "@transly/core";

const transly = createTransly({
  sourceLanguage: "en",
  supportedLanguages: ["en", "ta", "ml", "hi"],
  messages: { en: { common: { welcome: "Welcome, {name}", cart: "{count, plural, one {# item} other {# items}}" } } },
  provider, // optional, see @transly/providers
});

transly.t("welcome", { name: "Praveen" }); // static catalogs
await transly.setLanguage("ta");
await transly.translate("Hello", { to: "ta" }); // runtime AI translation (needs a provider)
await transly.translateBatch(["a", "b"], { to: "ml" }); // ONE provider call, deduped, cached
```

## Features

- Nested keys, namespaces (`"dash:title"`), lazy `loader`, `{name}` interpolation, ICU `plural` / `number` / `date`, `_one`/`_other` plural keys
- Fallback chains (`pt-BR` → `pt` → default → source), any BCP 47 tag
- Runtime translation: batching, in-flight de-duplication, LRU+TTL cache (pluggable `CacheStore`), `AbortSignal`
- Output validation: translations that drop or alter `{placeholders}` / HTML tags are rejected and never cached
- `subscribe()` for reactive UI, `dispose()` for cleanup

## Security

Never put provider API keys in browser code. Run providers on your server and call them through your own endpoint.

## Limitations (v0.1)

No framework bindings, CLI, hosted API, or Redis/IndexedDB cache stores yet. ICU `select` / `selectordinal` are not implemented.

MIT
