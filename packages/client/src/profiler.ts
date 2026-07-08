/**
 * Profiler de performance do client
 * Mede frame time, tempo de cada função e identifica gargalos
 */

interface ProfilerFrame {
  frameTime: number;
  marks: Map<string, { start: number; end: number; duration: number }>;
  timestamp: number;
}

class Profiler {
  private frames: ProfilerFrame[] = [];
  private currentFrame: ProfilerFrame | null = null;
  private maxFrames = 300; // Mantém últimos 300 frames (~5s em 60fps)
  private enabled = true;
  private frameStartTime = 0;

  start(frameNumber: number) {
    if (!this.enabled) return;

    this.frameStartTime = performance.now();
    this.currentFrame = {
      frameTime: 0,
      marks: new Map(),
      timestamp: frameNumber,
    };
  }

  mark(label: string) {
    if (!this.enabled || !this.currentFrame) return;

    const now = performance.now();
    if (!this.currentFrame.marks.has(label)) {
      this.currentFrame.marks.set(label, {
        start: now,
        end: now,
        duration: 0,
      });
    } else {
      const mark = this.currentFrame.marks.get(label)!;
      mark.end = now;
      mark.duration = mark.end - mark.start;
    }
  }

  measure(label: string, fn: () => void) {
    if (!this.enabled) {
      fn();
      return;
    }

    this.mark(`${label}:start`);
    fn();
    this.mark(`${label}:end`);
  }

  async measureAsync(label: string, fn: () => Promise<void>) {
    if (!this.enabled) {
      await fn();
      return;
    }

    this.mark(`${label}:start`);
    await fn();
    this.mark(`${label}:end`);
  }

  end() {
    if (!this.enabled || !this.currentFrame) return;

    const now = performance.now();
    this.currentFrame.frameTime = now - this.frameStartTime;

    this.frames.push(this.currentFrame);
    if (this.frames.length > this.maxFrames) {
      this.frames.shift();
    }

    this.currentFrame = null;
  }

  getStats() {
    if (this.frames.length === 0) return null;

    const frameTimes = this.frames.map((f) => f.frameTime);
    const totalTime = frameTimes.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / frameTimes.length;
    const minTime = Math.min(...frameTimes);
    const maxTime = Math.max(...frameTimes);
    const p95Time = this.percentile(frameTimes, 0.95);
    const p99Time = this.percentile(frameTimes, 0.99);

    // Agrupa medidas por label
    const labelStats = new Map<
      string,
      { count: number; total: number; avg: number; min: number; max: number }
    >();

    this.frames.forEach((frame) => {
      frame.marks.forEach((mark, label) => {
        if (!labelStats.has(label)) {
          labelStats.set(label, {
            count: 0,
            total: 0,
            avg: 0,
            min: Infinity,
            max: -Infinity,
          });
        }
        const stat = labelStats.get(label)!;
        stat.count++;
        stat.total += mark.duration;
        stat.min = Math.min(stat.min, mark.duration);
        stat.max = Math.max(stat.max, mark.duration);
        stat.avg = stat.total / stat.count;
      });
    });

    return {
      frameCount: this.frames.length,
      frameTimes: {
        avg: avgTime,
        min: minTime,
        max: maxTime,
        p95: p95Time,
        p99: p99Time,
      },
      fps: 1000 / avgTime,
      labels: Object.fromEntries(labelStats),
    };
  }

  printStats() {
    const stats = this.getStats();
    if (!stats) {
      console.log("[Profiler] Sem dados coletados ainda");
      return;
    }

    console.group("[Profiler] Frame Stats");
    console.log(`Frames: ${stats.frameCount}`);
    console.log(
      `Frame Time (ms): avg=${stats.frameTimes.avg.toFixed(2)}, min=${stats.frameTimes.min.toFixed(2)}, max=${stats.frameTimes.max.toFixed(2)}, p95=${stats.frameTimes.p95.toFixed(2)}, p99=${stats.frameTimes.p99.toFixed(2)}`
    );
    console.log(`FPS: ${stats.fps.toFixed(1)}`);

    if (Object.keys(stats.labels).length > 0) {
      console.group("Label Timings");
      const sortedLabels = Object.entries(stats.labels).sort(
        ([, a], [, b]) => b.total - a.total
      );
      sortedLabels.forEach(([label, stat]) => {
        console.log(
          `${label}: avg=${stat.avg.toFixed(3)}ms, min=${stat.min.toFixed(3)}ms, max=${stat.max.toFixed(3)}ms, total=${stat.total.toFixed(1)}ms (n=${stat.count})`
        );
      });
      console.groupEnd();
    }
    console.groupEnd();
  }

  exportJSON() {
    return JSON.stringify(this.getStats(), null, 2);
  }

  reset() {
    this.frames = [];
    this.currentFrame = null;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

export const profiler = new Profiler();

// Expõe globalmente para acessar do DevTools
declare global {
  interface Window {
    profiler: Profiler;
  }
}
window.profiler = profiler;
