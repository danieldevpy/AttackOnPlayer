import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface SourceGlob {
  include?: string[];
  exclude?: string[];
  kinds?: string[];
  file?: string;
  pattern?: string;
}

export interface AciConfig {
  version: number;
  root: string;
  cacheDir: string;
  sources: Record<string, SourceGlob>;
  budget: {
    defaultMaxTokens: number;
    summaryMaxTokens: number;
    snippetContextLines: number;
  };
  notes?: string;
}

/** Diretório do pacote aci (packages/aci). */
export const PKG_DIR = resolve(__dirname, "..");

/** Carrega aci.config.json e resolve caminhos absolutos. */
export function loadConfig(): AciConfig & { rootAbs: string; cacheAbs: string } {
  const raw = JSON.parse(
    readFileSync(resolve(PKG_DIR, "aci.config.json"), "utf8"),
  ) as AciConfig;
  const rootAbs = resolve(PKG_DIR, raw.root);
  const cacheAbs = resolve(PKG_DIR, raw.cacheDir);
  return { ...raw, rootAbs, cacheAbs };
}
