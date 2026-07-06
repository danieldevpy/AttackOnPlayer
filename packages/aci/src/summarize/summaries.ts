import type { Store } from "../store/store.js";
import type { DocKind, DocSection } from "../index/docs.js";

/**
 * Resumo automático (F3).
 *
 * Sem front-matter YAML no corpus (nota F2), o resumo de cada spec/prompt/
 * proposal já existe pronto na F2: a seção de nível 1 — título + metadados em
 * negrito + intro antes do primeiro `##` — é exatamente o "resumo antes de
 * abrir o arquivo inteiro" que o DOC_MAP pede à mão. Para ADR, a própria
 * seção (`## ADR-NNN`) já É o resumo (o DECISION_LOG é escrito nesse formato:
 * contexto → decisão → consequência, compacto). Nenhuma heurística nova de
 * sumarização — só reaproveita a estrutura já indexada.
 */
export interface DocSummary {
  docId?: string;
  kind: DocKind;
  file: string;
  title: string;
  snippet: string;
}

function loadDocSections(store: Store): DocSection[] {
  return store.get<DocSection[]>("docs:all") ?? [];
}

function toSummary(s: DocSection): DocSummary {
  return { docId: s.docId, kind: s.kind, file: s.file, title: s.heading, snippet: s.snippet };
}

/**
 * Resumo por docId (ex.: "SPEC-0004", "ADR-014", "PROMPT-0028", "PROPOSAL-0003")
 * ou por caminho de arquivo (ex.: "AGENTS.md", "docs/BACKLOG.md") — para docs
 * genéricos sem docId, que só existem em um arquivo.
 */
export function summarize(store: Store, target: string): DocSummary | undefined {
  const sections = loadDocSections(store);
  const needle = target.toLowerCase();

  const byDocId = sections.filter((s) => s.docId?.toLowerCase() === needle);
  if (byDocId.length > 0) {
    return toSummary(byDocId.find((s) => s.level === 1) ?? byDocId[0]);
  }

  const byFile = sections.filter((s) => s.file === target || s.file.endsWith("/" + target));
  if (byFile.length > 0) {
    return toSummary(byFile.find((s) => s.level === 1) ?? byFile[0]);
  }

  return undefined;
}
