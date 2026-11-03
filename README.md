# Transly

[![CI](https://github.com/praveenKumaar-dev/transly/actions/workflows/ci.yml/badge.svg)](https://github.com/praveenKumaar-dev/transly/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight, framework-independent AI translation engine for JavaScript and TypeScript.

Transly unifies **static localization catalogs** (ICU message formats, fallbacks, pluralization) with **runtime AI translation** (LLM-based translations, batching, caching, in-flight deduplication, and placeholder integrity verification).

---

## Packages

| Package | Version | Description |
|---|---|---|
| [`@praveenkumar-k/transly-core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@praveenkumar-k/transly-core.svg)](https://www.npmjs.com/package/@praveenkumar-k/transly-core) | Framework-independent translation engine with zero runtime dependencies. |
| [`@praveenkumar-k/transly-providers`](./packages/providers) | [![npm](https://img.shields.io/npm/v/@praveenkumar-k/transly-providers.svg)](https://www.npmjs.com/package/@praveenkumar-k/transly-providers) | Server-side translation provider adapters (OpenAI, LibreTranslate) with retries, timeouts, and error classification. |

---

## Quickstart

### 1. Installation

```bash
npm install @praveenkumar-k/transly-core
# Optional: for server-side AI translation providers
npm install @praveenkumar-k/transly-providers
```

### 2. Basic Static Translation

```ts
import { createTransly } from "@praveenkumar-k/transly-core";

const transly = createTransly({
  sourceLanguage: "en",
  supportedLanguages: ["en", "es", "fr", "ta", "hi"],
  messages: {
    en: {
      common: {
        welcome: "Welcome, {name}!",
        cart: "{count, plural, one {# item} other {# items}}",
      },
    },
  },
});

// Simple key lookup with variable interpolation
console.log(transly.t("common.welcome", { name: "Praveen" }));
// => "Welcome, Praveen!"

// ICU Pluralization
console.log(transly.t("common.cart", { count: 3 }));
// => "3 items"
```

### 3. Runtime AI Translation with Providers

```ts
import { createTransly } from "@praveenkumar-k/transly-core";
import { openAI } from "@praveenkumar-k/transly-providers";

const transly = createTransly({
  sourceLanguage: "en",
  supportedLanguages: ["en", "es", "ta", "ml"],
  provider: openAI({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
  }),
});

// On-demand AI translation (cached automatically)
const result = await transly.translate("Welcome to our service", { to: "es" });
console.log(result.text);

// Batch translation in a single API call with automatic deduplication
const batch = await transly.translateBatch(
  ["Dashboard", "Settings", "Log Out"],
  { to: "ta" }
);
```

---

## Key Features

- **Zero Runtime Dependencies**: `@praveenkumar-k/transly-core` is pure TypeScript that runs in Node 18+, browsers, and edge environments.
- **ICU Message Syntax**: Supports variable interpolation `{name}`, number formatting, date formatting, and plural rules (`one`, `other`, etc.).
- **Smart Fallback Chains**: Seamless locale resolution (e.g. `pt-BR` → `pt` → default language → source language).
- **Batching & Deduplication**: Groups multiple string translation requests into single provider calls with in-flight request deduplication.
- **Placeholder & HTML Integrity**: Automatically validates that AI translations preserve `{placeholders}` and markup without dropping or corrupting them.
- **Pluggable Caching**: Built-in in-memory LRU + TTL caching with an interface to bring your own cache stores (Redis, IndexedDB, etc.).
- **Reactive UI Ready**: Built-in `.subscribe()` pattern to react to language updates and catalog changes.

---

## Development & Monorepo Workflow

This project is managed as an npm workspace.

```bash
# Clone the repository
git clone https://github.com/praveenKumaar-dev/transly.git
cd transly

# Install dependencies
npm ci

# Build all packages
npm run build

# Run all test suites across workspaces
npm test

# Run tests with coverage reports
npm run coverage

# Run type-checking
npm run typecheck

# Lint and format
npm run lint
npm run format:check
```

### Releasing Changes

We use [Changesets](https://github.com/changesets/changesets) for automated versioning and changelogs.

```bash
# Create a changeset entry
npm run changeset

# Commit and push
git add .
git commit -m "Add changeset"
git push origin main
```

---

## Contributing

Contributions, bug reports, and feature requests are welcome! Please check out [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the [MIT License](./LICENSE).
