import type { AciConfig } from "../config.js";
import { JsonStore, type Store } from "./store.js";

/** Store do índice de código (F1) — compartilhado por cli.ts e mcp/server.ts. */
export function codeStore(cfg: AciConfig & { cacheAbs: string }): Store {
  return new JsonStore(cfg.cacheAbs, "code.json");
}

/** Store do índice de docs/corpus (F2) — compartilhado por cli.ts e mcp/server.ts. */
export function docsStore(cfg: AciConfig & { cacheAbs: string }): Store {
  return new JsonStore(cfg.cacheAbs, "docs.json");
}
