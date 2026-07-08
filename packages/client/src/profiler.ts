/**
 * Profiler de performance do client.
 *
 * IMPORTANTE — o que este profiler mede (e o que a v1 media ERRADO):
 * A v1 media apenas o tempo de CPU DENTRO de animate() (start no topo, end após render).
 * Isso NÃO é o frame time real: requestAnimationFrame é limitado pela taxa do monitor
 * (60Hz → 16.6ms, 144Hz → 6.9ms), então a "fps" que a v1 reportava (200–400) era ficção —
 * era "quantos frames caberiam SE só existisse o trabalho do animate". Os picos de "ping"
 * (25–50ms) não estão no trabalho do animate: estão no GAP entre o fim de um render e o
 * próximo rAF — onde acontecem GC, layout/paint do browser, decode dos patches binários do
 * Colyseus e (o suspeito nº1) recompilação de shaders quando uma luz entra/sai da cena.
 *
 * Esta v2 mede as três grandezas que importam:
 *  - interval: rAF→rAF real (o frame time de verdade / stutter percebido)
 *  - inside:   CPU gasta dentro do animate() (o que a v1 chamava de frameTime)
 *  - outside:  interval − inside (GC + paint + rede + recompilação — onde o pico se esconde)
 * E registra "frames longos" (interval acima de um limite) com o breakdown do culpado.
 *
 * Baixa alocação: agrega incrementalmente (sem Map por frame) e guarda os intervalos num
 * ring buffer de Float64Array — a ferramenta de diagnóstico não pode ser fonte de GC.
 */

interface LabelAgg {
  count: number;
  total: number;
  min: number;
  max: number;
}

interface LongFrame {
  frame: number;
  interval: number;
  inside: number;
  outside: number;
  worstLabel: string;
  worstMs: number;
}

const RING = 600; // ~10s @60fps de intervalos para percentis

class Profiler {
  private enabled = true;
  // Ring buffers de intervalos reais e de CPU-dentro-do-animate.
  private intervals = new Float64Array(RING);
  private insides = new Float64Array(RING);
  private idx = 0;
  private filled = 0;

  // Agregação por label (dobrada incrementalmente — zero Map por frame).
  private labels = new Map<string, LabelAgg>();
  // Marks abertas do frame atual: label → start. Reutilizada e limpa a cada frame.
  private openMarks = new Map<string, number>();

  private frameStart = 0; // performance.now() no topo do animate() atual
  private prevFrameStart = 0; // idem do frame anterior (para o intervalo real)
  private pendingInterval = 0; // intervalo real deste frame (0 = 1º frame, não conta)
  private frameCount = 0;

  // Culpado do frame atual (label com maior duração), para atribuir frames longos.
  private worstLabel = "";
  private worstMs = 0;

  // Frames longos capturados (interval > longThresholdMs). 33ms ≈ um frame de 60fps PERDIDO
  // (hitch real), não o jitter normal de 20–25ms. Ajuste fino via setLongThreshold().
  private longThresholdMs = 33;
  private longFrames: LongFrame[] = [];
  private maxLongFrames = 60;

  start(frameNumber: number) {
    if (!this.enabled) return;
    const now = performance.now();
    this.frameCount = frameNumber;

    // Intervalo real rAF→rAF: topo-do-animate anterior → topo deste. 0 no 1º frame (não conta).
    this.pendingInterval = this.prevFrameStart > 0 ? now - this.prevFrameStart : 0;
    this.prevFrameStart = now;
    this.frameStart = now;

    this.openMarks.clear();
    this.worstLabel = "";
    this.worstMs = 0;
  }

  /** Chamada em par (mesmo label) para delimitar um trecho: 1ª abre, 2ª fecha e agrega. */
  mark(label: string) {
    if (!this.enabled) return;
    const now = performance.now();
    const open = this.openMarks.get(label);
    if (open === undefined) {
      this.openMarks.set(label, now);
      return;
    }
    const dur = now - open;
    this.openMarks.delete(label);

    let agg = this.labels.get(label);
    if (!agg) {
      agg = { count: 0, total: 0, min: Infinity, max: -Infinity };
      this.labels.set(label, agg);
    }
    agg.count++;
    agg.total += dur;
    if (dur < agg.min) agg.min = dur;
    if (dur > agg.max) agg.max = dur;

    if (dur > this.worstMs) {
      this.worstMs = dur;
      this.worstLabel = label;
    }
  }

  measure(label: string, fn: () => void) {
    if (!this.enabled) return fn();
    this.mark(label);
    fn();
    this.mark(label);
  }

  end() {
    if (!this.enabled) return;
    const now = performance.now();
    const inside = now - this.frameStart;

    // 1º frame não tem intervalo real ainda — mede labels/inside mas não entra no ring.
    if (this.pendingInterval <= 0) return;

    const interval = this.pendingInterval;
    this.intervals[this.idx] = interval;
    this.insides[this.idx] = inside;

    // Frame longo? Atribui ao intervalo real (rAF→rAF) do slot atual.
    if (interval > this.longThresholdMs) {
      const outside = interval - inside;
      this.longFrames.push({
        frame: this.frameCount,
        interval,
        inside,
        outside,
        worstLabel: this.worstLabel,
        worstMs: this.worstMs,
      });
      if (this.longFrames.length > this.maxLongFrames) this.longFrames.shift();
    }

    this.idx = (this.idx + 1) % RING;
    if (this.filled < RING) this.filled++;
  }

  private stats(buf: Float64Array) {
    const n = this.filled;
    if (n === 0) return { avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
    // Copia só a parte preenchida e ordena (feito só sob demanda, não por frame).
    const arr = Array.from(buf.subarray(0, n)).sort((a, b) => a - b);
    const sum = arr.reduce((s, v) => s + v, 0);
    const pct = (p: number) => arr[Math.min(n - 1, Math.max(0, Math.ceil(n * p) - 1))];
    return { avg: sum / n, min: arr[0], max: arr[n - 1], p95: pct(0.95), p99: pct(0.99) };
  }

  getStats() {
    if (this.filled === 0) return null;
    const interval = this.stats(this.intervals);
    const inside = this.stats(this.insides);
    const labels: Record<string, LabelAgg & { avg: number }> = {};
    this.labels.forEach((a, label) => {
      labels[label] = { ...a, avg: a.count ? a.total / a.count : 0 };
    });
    return {
      frameCount: this.filled,
      interval, // rAF→rAF real — este é o "frame time" de verdade
      inside, // CPU dentro do animate()
      realFps: interval.avg > 0 ? 1000 / interval.avg : 0,
      longFrames: this.longFrames.slice(),
      labels,
    };
  }

  printStats() {
    const s = this.getStats();
    if (!s) {
      console.log("[Profiler] Sem dados coletados ainda");
      return;
    }
    console.group("[Profiler v2] Frame Stats");
    console.log(`Frames: ${s.frameCount}`);
    console.log(
      `Intervalo REAL rAF→rAF (ms): avg=${s.interval.avg.toFixed(2)} min=${s.interval.min.toFixed(2)} max=${s.interval.max.toFixed(2)} p95=${s.interval.p95.toFixed(2)} p99=${s.interval.p99.toFixed(2)}`
    );
    console.log(`FPS real: ${s.realFps.toFixed(1)}`);
    console.log(
      `CPU dentro do animate (ms): avg=${s.inside.avg.toFixed(2)} max=${s.inside.max.toFixed(2)} p99=${s.inside.p99.toFixed(2)}`
    );
    console.log(
      `Gap FORA do animate (avg): ${(s.interval.avg - s.inside.avg).toFixed(2)}ms — GC/paint/rede/recompilação`
    );

    const sorted = Object.entries(s.labels).sort(([, a], [, b]) => b.total - a.total);
    console.group("Labels (por total)");
    sorted.forEach(([label, a]) => {
      console.log(
        `${label}: avg=${a.avg.toFixed(3)} min=${a.min.toFixed(3)} max=${a.max.toFixed(3)} total=${a.total.toFixed(1)}ms (n=${a.count})`
      );
    });
    console.groupEnd();

    if (s.longFrames.length) {
      console.group(`Frames longos (interval > ${this.longThresholdMs}ms) — ${s.longFrames.length}`);
      s.longFrames.slice(-15).forEach((f) => {
        const kind = f.outside > f.inside ? "FORA (GC/paint/recompile)" : `DENTRO → ${f.worstLabel}`;
        console.log(
          `#${f.frame}: interval=${f.interval.toFixed(1)}ms inside=${f.inside.toFixed(1)}ms outside=${f.outside.toFixed(1)}ms → culpado: ${kind} (${f.worstMs.toFixed(1)}ms)`
        );
      });
      console.groupEnd();
    } else {
      console.log(`✅ Nenhum frame longo (> ${this.longThresholdMs}ms) capturado.`);
    }
    console.groupEnd();
  }

  exportJSON() {
    return JSON.stringify(this.getStats(), null, 2);
  }

  reset() {
    this.intervals.fill(0);
    this.insides.fill(0);
    this.idx = 0;
    this.filled = 0;
    this.labels.clear();
    this.longFrames = [];
    this.prevFrameStart = 0;
  }

  setLongThreshold(ms: number) {
    this.longThresholdMs = ms;
  }

  enable() {
    this.enabled = true;
  }
  disable() {
    this.enabled = false;
  }
}

export const profiler = new Profiler();

declare global {
  interface Window {
    profiler: Profiler;
  }
}
window.profiler = profiler;
