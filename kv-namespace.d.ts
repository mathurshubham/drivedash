/** Minimal KV surface used by `src/lib/access.ts`. Hand-maintained — wrangler types omit the runtime. */
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}
