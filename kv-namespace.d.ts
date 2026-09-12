/** Minimal runtime shims. Hand-maintained — `wrangler types` regenerates `cloudflare-env.d.ts`. */
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface CloudflareEnv {
  ACCESS?: KVNamespace;
}
