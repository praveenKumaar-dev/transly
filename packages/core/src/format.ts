import type { Params } from "./types.js";

/** Find the index of the brace matching the one at `start`. */
function matchBrace(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

function pluralBranch(body: string, value: number, locale: string): string {
  // body: `one {# item} other {# items} =0 {none}`
  const branches = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    while (body[i] === " " || body[i] === "\n") i++;
    const open = body.indexOf("{", i);
    if (open < 0) break;
    const sel = body.slice(i, open).trim();
    const close = matchBrace(body, open);
    if (close < 0) break;
    branches.set(sel, body.slice(open + 1, close));
    i = close + 1;
  }
  const exact = branches.get(`=${value}`);
  if (exact !== undefined) return exact;
  const cat = new Intl.PluralRules(locale).select(value);
  return branches.get(cat) ?? branches.get("other") ?? "";
}

/** Supports {name}, {n, number}, {n, plural, one {...} other {...}} with `#`. */
export function formatMessage(message: string, params: Params = {}, locale = "en"): string {
  let out = "";
  let i = 0;
  while (i < message.length) {
    const ch = message[i]!;
    if (ch !== "{") {
      out += ch;
      i++;
      continue;
    }
    const end = matchBrace(message, i);
    if (end < 0) {
      out += message.slice(i);
      break;
    }
    const inner = message.slice(i + 1, end);
    const parts = inner.split(",");
    const name = parts[0]!.trim();
    const type = parts[1]?.trim();
    const value = params[name];
    if (type === "plural") {
      const body = inner.slice(inner.indexOf(",", inner.indexOf(",") + 1) + 1);
      const n = Number(value ?? 0);
      const branch = pluralBranch(body, n, locale);
      out += formatMessage(branch.replace(/#/g, new Intl.NumberFormat(locale).format(n)), params, locale);
    } else if (type === "number") {
      out += new Intl.NumberFormat(locale).format(Number(value));
    } else if (type === "date") {
      out += new Intl.DateTimeFormat(locale).format(value instanceof Date ? value : new Date(String(value)));
    } else {
      out += value === undefined || value === null ? `{${name}}` : String(value);
    }
    i = end + 1;
  }
  return out;
}

/** Tokens that a translation must preserve verbatim. */
export function extractPlaceholders(text: string): string[] {
  const tokens: string[] = [];
  for (const m of text.matchAll(/\{[^{}]*\}|<\/?[a-zA-Z][^>]*>/g)) tokens.push(m[0]);
  return tokens.sort();
}

export function placeholdersMatch(source: string, translated: string): boolean {
  const a = extractPlaceholders(source),
    b = extractPlaceholders(translated);
  return a.length === b.length && a.every((t, i) => t === b[i]);
}
