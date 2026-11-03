# @praveenkumar-k/transly-providers

Server-side adapters for `@praveenkumar-k/transly-core`.

```bash
npm install @praveenkumar-k/transly-core @praveenkumar-k/transly-providers
```

```ts
import { createTransly } from "@praveenkumar-k/transly-core";
import { openAI, libreTranslate } from "@praveenkumar-k/transly-providers";

const provider = openAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-4o-mini" });
// or: libreTranslate({ url: "http://localhost:5000" })

const transly = createTransly({ sourceLanguage: "en", supportedLanguages: ["en", "ta"], provider });
```

Timeouts, retries with exponential backoff (429/5xx/network only), error classification via `ProviderError.kind`.
Error messages never contain keys or response bodies. **Server-side only.**

Not yet included: Google Cloud Translation, DeepL, circuit breaker, cost tracking.

MIT
