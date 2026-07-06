/**
 * Métricas do ACI — instrumentação exigida pela PROPOSAL-0003:
 * tempo de indexação, tempo de busca, nº de arquivos, contexto retornado,
 * economia estimada de tokens e taxa de acerto (hit-rate).
 *
 * Heurística de tokens: ~4 chars/token (regra prática para PT-BR + código).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface IndexMetrics {
  filesIndexed: number;
  symbolsIndexed: number;
  docsIndexed: number;
  indexMs: number;
}

export interface QueryMetrics {
  query: string;
  searchMs: number;
  hits: number;
  tokensReturned: number;
  tokensIfFullFiles: number;
  savedTokens: number;
  savedPct: number;
}

export class Timer {
  private start = Date.now();
  reset(): void {
    this.start = Date.now();
  }
  ms(): number {
    return Date.now() - this.start;
  }
}

export function queryMetrics(
  query: string,
  searchMs: number,
  hits: number,
  returnedText: string,
  fullFilesText: string,
): QueryMetrics {
  const tokensReturned = estimateTokens(returnedText);
  const tokensIfFullFiles = estimateTokens(fullFilesText);
  const savedTokens = Math.max(0, tokensIfFullFiles - tokensReturned);
  const savedPct = tokensIfFullFiles
    ? Math.round((savedTokens / tokensIfFullFiles) * 100)
    : 0;
  return {
    query,
    searchMs,
    hits,
    tokensReturned,
    tokensIfFullFiles,
    savedTokens,
    savedPct,
  };
}
