import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Converte um glob simples (*, **, ?) em RegExp ancorada. */
function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$");
}

function walk(dir: string, acc: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
}

/**
 * Resolve include/exclude (globs relativos a `root`) para caminhos absolutos.
 * Zero dependência — suficiente para a escala do repositório.
 */
export function resolveGlobs(
  root: string,
  include: string[] = [],
  exclude: string[] = [],
): string[] {
  const all: string[] = [];
  walk(root, all);
  const inc = include.map(globToRegExp);
  const exc = exclude.map(globToRegExp);
  const out: string[] = [];
  for (const abs of all) {
    const rel = relative(root, abs).split(sep).join("/");
    if (inc.length && !inc.some((r) => r.test(rel))) continue;
    if (exc.some((r) => r.test(rel))) continue;
    out.push(abs);
  }
  return out.sort();
}
