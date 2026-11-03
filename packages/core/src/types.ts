export type Messages = { [key: string]: string | Messages };
export type Params = Record<string, string | number | boolean | Date | null | undefined>;
export interface TranslationOptions {
  from?: string;
  to: string;
  context?: string;
  signal?: AbortSignal;
}
export interface TranslationResult {
  text: string;
  provider: string;
  model?: string;
}
export interface TranslationProvider {
  readonly id: string;
  readonly model?: string;
  translate(text: string, options: TranslationOptions): Promise<TranslationResult>;
  translateBatch(texts: string[], options: TranslationOptions): Promise<TranslationResult[]>;
}
export interface CacheStore {
  get(key: string): string | undefined | Promise<string | undefined>;
  set(key: string, value: string): void | Promise<void>;
  delete(key: string): void | Promise<void>;
  clear(): void | Promise<void>;
}
export interface TranslyConfig {
  sourceLanguage: string;
  supportedLanguages: string[];
  defaultLanguage?: string;
  fallbacks?: Record<string, string[]>;
  messages?: Record<string, Record<string, Messages>>; // lang -> namespace -> messages
  defaultNamespace?: string;
  loader?: (language: string, namespace: string) => Promise<Messages>;
  provider?: TranslationProvider;
  cache?: CacheStore;
  glossaryVersion?: string;
  configVersion?: string;
  /** Max source strings per provider call. */
  batchSize?: number;
  onMissingKey?: (key: string, language: string) => void;
}
export type Listener = (event: { type: "language" | "namespace"; language: string; namespace?: string }) => void;
