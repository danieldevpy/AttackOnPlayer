// T-049/T-050/T-051 (SPEC-0013): registry de sons nomeados, procedurais via WebAudio —
// espelha o padrão do vfx.ts (T-022): "som novo" = 1 entrada em AUDIO_REGISTRY, nada ad-hoc
// solto no main.ts. Toda voz sai do MESMO AudioContext com teto fixo (MAX_VOICES), então N
// sons simultâneos não estouram o hardware nem disparam erro de autoplay (contexto só liga
// no primeiro gesto do usuário).

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
  /** T-051: som de leitura pessoal (combate/progresso do PRÓPRIO jogador) — "duck" o bus
   * ambiente por um instante pra não ficar mascarado por tiro/coleta de outros jogadores. */
  priority?: boolean;
  file?: string; // reservado: troca futura por sample gravado (fora do escopo desta task)
}

/**
 * T-050: mapeamento evento→som completo (tabela da SPEC-0013). Convenção de nomes:
 * - eventos pessoais (dado/recebido, kill, death_self, respawn_self, level-up, pickups,
 *   skill, streak) tocam SÓ pro jogador dono do evento — o jogo tem vários bots/players e
 *   sem esse filtro a partida vira ruído (aceite: "legível de olhos fechados").
 * - eventos ambientes/globais (fire por launcher, death_other, bandeira, farm_event) tocam
 *   pra todo mundo, com posição (T-051) quando fizer sentido espacialmente.
 */
export const AUDIO_REGISTRY: Record<string, SoundDef> = {
  // Fire por launcher (T-039 espelhado): basic/heavy/rapid soam diferente, como o VFX de muzzle.
  fire_basic: { wave: "square", freq: 880, freqEnd: 520, envelope: { attack: 2, decay: 70 }, gain: 0.14 },
  fire_heavy: { wave: "sawtooth", freq: 200, freqEnd: 120, envelope: { attack: 2, decay: 110 }, gain: 0.18 },
  fire_rapid: { wave: "square", freq: 1200, freqEnd: 900, envelope: { attack: 1, decay: 40 }, gain: 0.1 },

  // Combate — hit dado/recebido/kill são pessoais (regra acima); death_other é ambiente.
  hit_given: { wave: "triangle", freq: 520, envelope: { attack: 1, decay: 60 }, gain: 0.16, priority: true },
  hit_taken: { wave: "sawtooth", freq: 180, envelope: { attack: 1, decay: 120 }, gain: 0.24, priority: true },
  kill: { wave: "square", freq: 660, freqEnd: 990, envelope: { attack: 2, decay: 220 }, gain: 0.3, priority: true },
  death_self: { wave: "sawtooth", freq: 300, freqEnd: 60, envelope: { attack: 5, decay: 500 }, gain: 0.32, priority: true },
  death_other: { wave: "sawtooth", freq: 220, freqEnd: 70, envelope: { attack: 4, decay: 380 }, gain: 0.14 },
  respawn_self: { wave: "sine", freq: 300, freqEnd: 520, envelope: { attack: 60, decay: 220 }, gain: 0.2, priority: true },

  // Level-up + card escolhido (auto vs manual — mesma distinção do vfx level_up_auto/upgrade_chosen_aura).
  level_up_auto: { wave: "sine", freq: 440, freqEnd: 660, envelope: { attack: 10, decay: 260 }, gain: 0.22, priority: true },
  card_chosen: { wave: "square", freq: 520, freqEnd: 780, envelope: { attack: 5, decay: 200 }, gain: 0.24, priority: true },

  // Coleta por kind (T-050) — todas pessoais (só o coletor ouve, senão farm de XP vira ruído contínuo).
  pickup_xp: { wave: "sine", freq: 900, envelope: { attack: 1, decay: 70 }, gain: 0.12 },
  pickup_coin: { wave: "square", freq: 1046, envelope: { attack: 1, decay: 80 }, gain: 0.12 },
  pickup_hp: { wave: "sine", freq: 392, freqEnd: 523, envelope: { attack: 3, decay: 160 }, gain: 0.18 },
  pickup_shield: { wave: "sine", freq: 300, freqEnd: 500, envelope: { attack: 5, decay: 200 }, gain: 0.18 },
  pickup_weapon: { wave: "square", freq: 600, freqEnd: 800, envelope: { attack: 3, decay: 180 }, gain: 0.22, priority: true },
  pickup_box: { wave: "triangle", freq: 500, envelope: { attack: 2, decay: 130 }, gain: 0.16 },
  pickup_speed: { wave: "triangle", freq: 800, freqEnd: 1100, envelope: { attack: 1, decay: 90 }, gain: 0.14 },
  pickup_farm: { wave: "sine", freq: 660, freqEnd: 880, envelope: { attack: 2, decay: 140 }, gain: 0.16 },

  // xp_combo (boosted) + skill de box — pessoais, raros.
  xp_combo: { wave: "triangle", freq: 700, freqEnd: 900, envelope: { attack: 2, decay: 140 }, gain: 0.16 },
  skill_unlock: { wave: "square", freq: 500, freqEnd: 900, envelope: { attack: 4, decay: 260 }, gain: 0.26, priority: true },
  streak: { wave: "square", freq: 750, freqEnd: 1000, envelope: { attack: 2, decay: 180 }, gain: 0.2, priority: true },

  // Bandeira (pickup/drop/cooldown/respawn) — ambiente/tático, todo mundo ouve (só existe 1 no mapa).
  flag_pickup: { wave: "sine", freq: 660, envelope: { attack: 5, decay: 200 }, gain: 0.2 },
  flag_drop: { wave: "sine", freq: 330, envelope: { attack: 2, decay: 160 }, gain: 0.18 },
  flag_cooldown: { wave: "triangle", freq: 220, envelope: { attack: 10, decay: 300 }, gain: 0.16 },
  flag_respawn: { wave: "triangle", freq: 440, freqEnd: 660, envelope: { attack: 10, decay: 260 }, gain: 0.18 },

  // Evento de zona (2×XP na guerra) — broadcast pra sala inteira, sem posição própria.
  farm_event_announce: { wave: "sine", freq: 392, freqEnd: 523, envelope: { attack: 20, decay: 400 }, gain: 0.2 },
};

const MAX_VOICES = 12; // orçamento global fixo — custo não varia com o combate
const MAX_AUDIBLE_DIST = 26; // T-051: além disso, som posicional vira no-op (economiza voz)
const DUCK_GAIN = 0.45; // T-051: ducking simples — o bus ambiente cai pra isso quando um som prioritário toca
const DUCK_RECOVER_S = 0.35; // tempo (constante de suavização) até o bus ambiente voltar ao normal

const VOLUME_KEY = "aop_audio_volume"; // T-051: { master, sfx, muted } persistido

interface Voice {
  gain: GainNode;
  stop(): void;
}

export interface AudioSystem {
  /** Destrava o AudioContext no primeiro gesto do usuário (regra de autoplay dos browsers). */
  unlock(): void;
  /** Dispara o som nomeado. `x`/`z` opcionais = atenuação/pan por distância da câmera (T-051); omitidos = som "pessoal" (volume cheio, sem pan). Nome desconhecido ou contexto travado = no-op silencioso. */
  play(name: string, x?: number, z?: number): void;
  /** T-051: posição/orientação do ouvinte (câmera) — chamado 1×/frame por main.ts, mesmo padrão do vfx.update(now). */
  setListenerPosition(x: number, z: number): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  toggleMuted(): boolean;
  setMasterVolume(v: number): void;
  getMasterVolume(): number;
  setSfxVolume(v: number): void;
  getSfxVolume(): number;
}

interface StoredVolume {
  master: number;
  sfx: number;
  muted: boolean;
}

function loadStoredVolume(): StoredVolume {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (!raw) return { master: 1, sfx: 1, muted: false };
    const parsed = JSON.parse(raw);
    return {
      master: typeof parsed.master === "number" ? parsed.master : 1,
      sfx: typeof parsed.sfx === "number" ? parsed.sfx : 1,
      muted: parsed.muted === true,
    };
  } catch {
    return { master: 1, sfx: 1, muted: false }; // localStorage indisponível/corrompido: defaults seguros
  }
}

export function createAudioSystem(): AudioSystem {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null; // volume geral + mute
  let sfxBus: GainNode | null = null; // volume de efeitos (separado do master p/ T-058 expor os 2 sliders)
  let duckBus: GainNode | null = null; // T-051: sons NÃO prioritários passam por aqui (ducking)
  let noiseBuffer: AudioBuffer | null = null;
  const voices: Voice[] = [];
  const stored = loadStoredVolume();
  let muted = stored.muted;
  let masterVolume = stored.master;
  let sfxVolume = stored.sfx;
  let listenerX = 0;
  let listenerZ = 0;

  function persist(): void {
    try {
      localStorage.setItem(VOLUME_KEY, JSON.stringify({ master: masterVolume, sfx: sfxVolume, muted }));
    } catch {
      // storage indisponível (modo privado etc.) — configuração só não sobrevive ao reload
    }
  }

  function ensureContext(): void {
    if (ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return; // navegador sem WebAudio: áudio vira no-op, jogo segue jogável
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : masterVolume;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVolume;
    sfxBus.connect(master);
    duckBus = ctx.createGain();
    duckBus.gain.value = 1;
    duckBus.connect(sfxBus);
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

  function setListenerPosition(x: number, z: number): void {
    listenerX = x;
    listenerZ = z;
  }

  /** T-051: ducking simples — som prioritário abaixa o bus ambiente por um instante e devolve. */
  function duck(): void {
    if (!ctx || !duckBus) return;
    const now = ctx.currentTime;
    duckBus.gain.cancelScheduledValues(now);
    duckBus.gain.setValueAtTime(DUCK_GAIN, now);
    duckBus.gain.setTargetAtTime(1, now, DUCK_RECOVER_S);
  }

  function play(name: string, x?: number, z?: number): void {
    const def = AUDIO_REGISTRY[name];
    if (!def || !ctx || !master || !sfxBus || !duckBus || ctx.state === "suspended") return; // travado/desconhecido: silêncio, nunca derruba o frame

    // T-051: atenuação/pan por distância da câmera — só quando o chamador passa posição
    // (eventos pessoais tocam "na cabeça", sem posição, cheios e centrados).
    let distanceGain = 1;
    let pan = 0;
    if (x !== undefined && z !== undefined) {
      const dist = Math.hypot(x - listenerX, z - listenerZ);
      if (dist >= MAX_AUDIBLE_DIST) return; // longe demais: no-op, economiza voz do pool
      distanceGain = 1 - dist / MAX_AUDIBLE_DIST;
      pan = Math.max(-1, Math.min(1, (x - listenerX) / MAX_AUDIBLE_DIST));
    }

    if (voices.length >= MAX_VOICES) voices.shift()?.stop(); // pool saturado: rouba a voz mais antiga

    if (def.priority) duck();

    const now = ctx.currentTime;
    const durationS = (def.envelope.attack + def.envelope.decay) / 1000;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(def.gain * distanceGain, now + def.envelope.attack / 1000);
    gainNode.gain.linearRampToValueAtTime(0.0001, now + durationS);

    let output: AudioNode = gainNode;
    if (typeof ctx.createStereoPanner === "function" && pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      gainNode.connect(panner);
      output = panner;
    }
    output.connect(def.priority ? sfxBus : duckBus);

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
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : masterVolume, ctx.currentTime, 0.01);
    persist();
  }

  function isMuted(): boolean {
    return muted;
  }

  function toggleMuted(): boolean {
    setMuted(!muted);
    return muted;
  }

  function setMasterVolume(v: number): void {
    masterVolume = Math.max(0, Math.min(1, v));
    if (master && ctx && !muted) master.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.01);
    persist();
  }

  function getMasterVolume(): number {
    return masterVolume;
  }

  function setSfxVolume(v: number): void {
    sfxVolume = Math.max(0, Math.min(1, v));
    if (sfxBus && ctx) sfxBus.gain.setTargetAtTime(sfxVolume, ctx.currentTime, 0.01);
    persist();
  }

  function getSfxVolume(): number {
    return sfxVolume;
  }

  return {
    unlock,
    play,
    setListenerPosition,
    setMuted,
    isMuted,
    toggleMuted,
    setMasterVolume,
    getMasterVolume,
    setSfxVolume,
    getSfxVolume,
  };
}
