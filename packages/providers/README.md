# @transly/providers

Server-side adapters for `@transly/core`.

```bash
npm install @transly/core @transly/providers
```

```ts
import { createTransly } from "@transly/core";
import { openAI, libreTranslate } from "@transly/providers";

const provider = openAI({ apiKey: process.env.OPENAI_API_KEY!, model: "gpt-4o-mini" });
// or: libreTranslate({ url: "http://localhost:5000" })

const transly = createTransly({ sourceLanguage: "en", supportedLanguages: ["en", "ta"], provider });
```

Timeouts, retries with exponential backoff (429/5xx/network only), error classification via `ProviderError.kind`.
Error messages never contain keys or response bodies. **Server-side only.**

Not yet included: Google Cloud Translation, DeepL, circuit breaker, cost tracking.

MIT
