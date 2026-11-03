export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "rate_limit" | "timeout" | "server" | "bad_request" | "network",
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
export interface HttpOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
}

function classify(status: number): ProviderError {
  if (status === 401 || status === 403) return new ProviderError("Provider authentication failed", "auth", false);
  if (status === 429) return new ProviderError("Provider rate limit", "rate_limit", true);
  if (status >= 500) return new ProviderError(`Provider error ${status}`, "server", true);
  return new ProviderError(`Provider rejected request (${status})`, "bad_request", false);
}

/** POST JSON with timeout + exponential backoff. Error messages never include secrets or bodies. */
export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  o: HttpOptions,
  signal?: AbortSignal,
): Promise<any> {
  const f = o.fetch ?? fetch,
    retries = o.retries ?? 2;
  let last: unknown;
  for (let a = 0; a <= retries; a++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), o.timeoutMs ?? 15000);
    const onAbort = () => ac.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      const res = await f(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok) throw classify(res.status);
      return await res.json();
    } catch (e) {
      if (signal?.aborted) throw e;
      last =
        e instanceof ProviderError
          ? e
          : new ProviderError("Provider request failed", ac.signal.aborted ? "timeout" : "network", true);
      if (!(last as ProviderError).retryable || a === retries) break;
      await new Promise((r) => setTimeout(r, (o.baseDelayMs ?? 200) * 2 ** a));
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  throw last;
}
