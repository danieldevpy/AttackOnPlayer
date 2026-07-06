// T-049 (SPEC-0013): registry de sons nomeados, procedurais via WebAudio — espelha o
// padrão do vfx.ts (T-022): "efeito novo" = 1 entrada em AUDIO_REGISTRY, nada ad-hoc solto
// no main.ts. Toda voz sai do MESMO AudioContext com teto fixo (MAX_VOICES), então N sons
// simultâneos não estouram o hardware nem disparam erro de autoplay (contexto só liga no
// primeiro gesto do usuário).

export type SoundWave = "sine" | "square" | "sawtooth" | "triangle" | "noise";

interface SoundEnvelope {
  attack: number; // ms até o pico de volume
  decay: number; // ms do pico até silêncio
}

export interface SoundDef {
  wave: SoundWave;
  freq: number; // Hz base (ignorado quando wave === "noise")
  freqEnd?: number; // opcional: sweep linear de frequência até o fim do decay
  envelope: SoundEnvelope;
  gain: number; // volume relativo 0–1 (mixagem entre sons)
  file?: string; // reservado: troca futura por sample gravado (fora do escopo desta task)
}

/**
 * 3 sons de teste (T-049) plugados em eventos reais já emitidos pelo servidor — mapeamento
 * completo (xp/coin/hp/box/fire por launcher/kill/etc.) é a T-050, não esta.
 */
export const AUDIO_REGISTRY: Record<string, SoundDef> = {
  fire: { wave: "square", freq: 880, freqEnd: 520, envelope: { attack: 2, decay: 70 }, gain: 0.16 },
  hit: { wave: "noise", freq: 0, envelope: { attack: 1, decay: 90 }, gain: 0.2 },
  death: { wave: "sawtooth", freq: 220, freqEnd: 70, envelope: { attack: 4, decay: 380 }, gain: 0.26 },
};

const MAX_VOICES = 12; // orçamento global fixo — custo não varia com o combate

interface Voice {
  gain: GainNode;
  stop(): void;
}

export interface AudioSystem {
  /** Destrava o AudioContext no primeiro gesto do usuário (regra de autoplay dos browsers). */
  unlock(): void;
  /** Dispara o som nomeado. Nome desconhecido ou contexto ainda travado = no-op silencioso. */
  play(name: string): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  toggleMuted(): boolean;
}

export function createAudioSystem(): AudioSystem {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let muted = false;
  const voices: Voice[] = [];

  function ensureContext(): void {
    if (ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return; // navegador sem WebAudio: áudio vira no-op, jogo segue jogável
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }

  function unlock(): void {
    ensureContext();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  }

  // T-048 espelhado aqui: destrava no primeiro gesto (click/tecla/toque), depois some —
  // nunca cria o AudioContext antes disso (evita o warning de autoplay no console).
  const unlockOnce = () => {
    unlock();
    removeEventListener("pointerdown", unlockOnce);
    removeEventListener("keydown", unlockOnce);
    removeEventListener("touchstart", unlockOnce);
  };
  addEventListener("pointerdown", unlockOnce, { once: true });
  addEventListener("keydown", unlockOnce, { once: true });
  addEventListener("touchstart", unlockOnce, { once: true });

  function getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (noiseBuffer) return noiseBuffer;
    const length = Math.floor(context.sampleRate * 0.5);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buffer;
    return buffer;
  }

  function removeVoice(voice: Voice): void {
    const idx = voices.indexOf(voice);
    if (idx >= 0) voices.splice(idx, 1);
  }

  function play(name: string): void {
    const def = AUDIO_REGISTRY[name];
    if (!def || !ctx || !master || ctx.state === "suspended") return; // travado ou som desconhecido: silêncio, nunca derruba o frame

    if (voices.length >= MAX_VOICES) voices.shift()?.stop(); // pool saturado: rouba a voz mais antiga

    const now = ctx.currentTime;
    const durationS = (def.envelope.attack + def.envelope.decay) / 1000;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(def.gain, now + def.envelope.attack / 1000);
    gainNode.gain.linearRampToValueAtTime(0.0001, now + durationS);
    gainNode.connect(master);

    let source: OscillatorNode | AudioBufferSourceNode;
    if (def.wave === "noise") {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      source = src;
    } else {
      const osc = ctx.createOscillator();
      osc.type = def.wave;
      osc.frequency.setValueAtTime(def.freq, now);
      if (def.freqEnd !== undefined) osc.frequency.linearRampToValueAtTime(def.freqEnd, now + durationS);
      source = osc;
    }
    source.connect(gainNode);
    source.start(now);
    source.stop(now + durationS + 0.02);

    const voice: Voice = { gain: gainNode, stop: () => source.stop() };
    source.onended = () => removeVoice(voice);
    voices.push(voice);
  }

  function setMuted(next: boolean): void {
    muted = next;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.01);
  }

  function isMuted(): boolean {
    return muted;
  }

  function toggleMuted(): boolean {
    setMuted(!muted);
    return muted;
  }

  return { unlock, play, setMuted, isMuted, toggleMuted };
}
