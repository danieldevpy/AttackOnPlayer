import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Store — persistência do índice + cache.
 *
 * F0 usa um backend JSON-em-arquivo (zero dependência nativa) para manter o
 * pacote instalável sem build de C++ e não interferir no fluxo paralelo da V1.
 * A interface `Store` isola o backend: em F1+, quando o volume justificar,
 * troca-se por `better-sqlite3` (ou `node:sqlite`) sem tocar nos chamadores.
 */
export interface Store {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  delete(key: string): void;
  keys(prefix?: string): string[];
  flush(): void;
}

interface Snapshot {
  schema: number;
  updatedAt: string;
  data: Record<string, unknown>;
}

export class JsonStore implements Store {
  private readonly file: string;
  private data: Record<string, unknown> = {};
  private dirty = false;

  constructor(cacheDir: string, name = "index.json") {
    this.file = join(cacheDir, name);
    if (existsSync(this.file)) {
      try {
        const snap = JSON.parse(readFileSync(this.file, "utf8")) as Snapshot;
        this.data = snap.data ?? {};
      } catch {
        this.data = {};
      }
    }
  }

  get<T = unknown>(key: string): T | undefined {
    return this.data[key] as T | undefined;
  }

  set(key: string, value: unknown): void {
    this.data[key] = value;
    this.dirty = true;
  }

  has(key: string): boolean {
    return key in this.data;
  }

  delete(key: string): void {
    if (key in this.data) {
      delete this.data[key];
      this.dirty = true;
    }
  }

  keys(prefix?: string): string[] {
    const all = Object.keys(this.data);
    return prefix ? all.filter((k) => k.startsWith(prefix)) : all;
  }

  flush(): void {
    if (!this.dirty) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const snap: Snapshot = {
      schema: 1,
      updatedAt: new Date().toISOString(),
      data: this.data,
    };
    writeFileSync(this.file, JSON.stringify(snap));
    this.dirty = false;
  }
}
