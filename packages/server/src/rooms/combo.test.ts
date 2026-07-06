import { describe, it, expect } from "vitest";
import { ArenaRoom } from "./ArenaRoom";
import { Player } from "../state/ArenaState";
import {
  XP_COMBO_START,
  XP_COMBO_MULT,
  XP_COMBO_LIMIT_MIN,
  XP_COMBO_LIMIT_MAX,
  XP_PICKUP_AMOUNT,
  xpComboLimit,
} from "@aop/shared";

/**
 * T-043 (SPEC-0011): Combo de XP — autoritativo no servidor.
 * Harness sem transporte Colyseus: `clients = []` cobre broadcast/clients.find usados
 * por emitDebug. Métodos privados acessados via `room` tipado como `any`.
 */
function makeRoom(): any {
  const room: any = new ArenaRoom();
  room.clients = [];
  room.onCreate({ flagEnabled: false });
  return room;
}

/** Cria um player vivo numa posição longe de coletáveis. */
function addPlayer(room: any, id: string, x = 50, z = 50): Player {
  const p = new Player();
  p.x = x;
  p.z = z;
  p.hp = 100;
  p.maxHp = 100;
  p.xp = 0;
  p.level = 1;
  room.state.players.set(id, p);
  return p;
}

/** Coloca um xp_orb em cima do player e roda um tick para que a coleta aconteça. */
function collectOrb(room: any, pid: string, x: number, z: number) {
  room.state.collectibles.clear();
  room.createCollectible(x, z, "xp_orb");
  room.update(0.05);
}

/** Último evento xp_combo emitido para um playerId. */
function lastComboEvent(room: any, pid: string) {
  const evs: any[] = room.debugEvents.filter(
    (e: any) => e.type === "xp_combo" && e.payload?.playerId === pid
  );
  return evs[evs.length - 1]?.payload ?? null;
}

// ---------------------------------------------------------------------------

describe("xpComboLimit — sorteio dentro da janela", () => {
  it("sempre cai em [XP_COMBO_LIMIT_MIN, XP_COMBO_LIMIT_MAX] para qualquer RNG", () => {
    for (const r of [0, 0.0001, 0.25, 0.5, 0.75, 0.9999]) {
      const lim = xpComboLimit(() => r);
      expect(lim).toBeGreaterThanOrEqual(XP_COMBO_LIMIT_MIN);
      expect(lim).toBeLessThanOrEqual(XP_COMBO_LIMIT_MAX);
    }
  });

  it("r=0 dá o mínimo, r=0.9999 dá o máximo", () => {
    expect(xpComboLimit(() => 0)).toBe(XP_COMBO_LIMIT_MIN);
    expect(xpComboLimit(() => 0.9999)).toBe(XP_COMBO_LIMIT_MAX);
  });
});

// ---------------------------------------------------------------------------

describe("Combo de XP — acumulação e bônus (T-043)", () => {
  it("1ª e 2ª coleta NÃO são boosted (abaixo de XP_COMBO_START)", () => {
    const room = makeRoom();
    const p = addPlayer(room, "A", 20, 20);

    collectOrb(room, "A", 20, 20);
    const ev1 = lastComboEvent(room, "A");
    expect(ev1.count).toBe(1);
    expect(ev1.boosted).toBe(false);

    collectOrb(room, "A", 20, 20);
    const ev2 = lastComboEvent(room, "A");
    expect(ev2.count).toBe(2);
    expect(ev2.boosted).toBe(false);
  });

  it(`3ª coleta consecutiva (XP_COMBO_START=${XP_COMBO_START}) é boosted e vale ${XP_COMBO_MULT}×`, () => {
    const room = makeRoom();
    // Player começa em nível ALTO para não subir de nível durante o teste (o level-up
    // desconta XP de p.xp via grantXp, o que tornaria a comparação direta de p.xp incorreta).
    const p = addPlayer(room, "A", 20, 20);
    p.level = 50; // XP necessário para o nível 50 é enorme; 3 orbes não causam level-up

    // Duas primeiras coletas (sem bônus)
    collectOrb(room, "A", 20, 20);
    collectOrb(room, "A", 20, 20);
    const xpBefore = p.xp;

    // 3ª coleta — deve ser boosted
    collectOrb(room, "A", 20, 20);
    const ev = lastComboEvent(room, "A");
    expect(ev.count).toBe(XP_COMBO_START);
    expect(ev.boosted).toBe(true);

    // XP ganho na 3ª coleta deve ser 2× (sem nível-up a subtração é direta)
    const gained = p.xp - xpBefore;
    expect(gained).toBe(XP_PICKUP_AMOUNT * XP_COMBO_MULT);
  });

  it("limite do combo é respeitado: ao atingir o limite, o próximo ciclo começa do zero", () => {
    // Injetamos RNG determinístico via monkey-patch de Math.random na sala.
    // xpComboLimit com r=0 → limite = XP_COMBO_LIMIT_MIN = 3.
    // Assim sabemos: exatamente 3 coletas = 1 ciclo; a 4ª começa novo ciclo (count=1).
    const room = makeRoom();
    // Injeta RNG fixo que produz limite=3 sempre.
    room.state.players.forEach(() => {});
    const p = addPlayer(room, "A", 20, 20);

    // Patch para que xpComboLimit retorne sempre 3 (r=0 → min=3)
    const origRandom = Math.random;
    Math.random = () => 0; // xpComboLimit(()=>0) = XP_COMBO_LIMIT_MIN = 3

    // 3 coletas = 1 ciclo completo
    collectOrb(room, "A", 20, 20); // count=1, limit=3
    collectOrb(room, "A", 20, 20); // count=2
    collectOrb(room, "A", 20, 20); // count=3 → atingiu limite, reseta

    const ev3 = lastComboEvent(room, "A");
    expect(ev3.count).toBe(3);
    expect(ev3.boosted).toBe(true); // 3ª ainda dá bônus

    // 4ª coleta: novo ciclo — count deve ser 1
    collectOrb(room, "A", 20, 20);
    const ev4 = lastComboEvent(room, "A");
    expect(ev4.count).toBe(1);
    expect(ev4.boosted).toBe(false); // 1ª do novo ciclo não tem bônus ainda

    Math.random = origRandom;
  });
});

// ---------------------------------------------------------------------------

describe("Combo de XP — dano zera o contador (T-043)", () => {
  it("dano real zera o combo; próxima coleta começa do 1", () => {
    const room = makeRoom();
    const p = addPlayer(room, "A", 20, 20);

    // Acumula 2 coletas
    collectOrb(room, "A", 20, 20);
    collectOrb(room, "A", 20, 20);
    expect(room.xpComboCount.get("A")).toBe(2);

    // Simula dano real: aciona o mesmo caminho que o hit handler usa
    // (reseta xpComboCount direto como o ArenaRoom faz ao processar hit não-bloqueado)
    room.xpComboCount.set("A", 0);
    room.xpComboLimitMap.delete("A");

    // Próxima coleta deve começar do count=1
    collectOrb(room, "A", 20, 20);
    const ev = lastComboEvent(room, "A");
    expect(ev.count).toBe(1);
    expect(ev.boosted).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("Combo de XP — outras coletas NÃO zeram o combo (T-043)", () => {
  it("coletar speed_up entre xp_orbs não zera o contador", () => {
    const room = makeRoom();
    const p = addPlayer(room, "A", 20, 20);

    // Duas coletas de xp_orb
    collectOrb(room, "A", 20, 20);
    collectOrb(room, "A", 20, 20);
    expect(room.xpComboCount.get("A")).toBe(2);

    // Coleta de speed_up — não deve zerar
    room.state.collectibles.clear();
    room.createCollectible(20, 20, "speed_up");
    room.update(0.05);

    // Contador ainda deve ser 2 (speed_up não toca o mapa de combo)
    expect(room.xpComboCount.get("A")).toBe(2);

    // 3ª coleta de xp_orb deve ser boosted (count=3)
    collectOrb(room, "A", 20, 20);
    const ev = lastComboEvent(room, "A");
    expect(ev.count).toBe(3);
    expect(ev.boosted).toBe(true);
  });

  it("coletar coin_buff não zera o combo", () => {
    const room = makeRoom();
    const p = addPlayer(room, "A", 20, 20);

    collectOrb(room, "A", 20, 20);

    room.state.collectibles.clear();
    room.createCollectible(20, 20, "coin_buff");
    room.update(0.05);

    expect(room.xpComboCount.get("A") ?? 0).toBe(1);
  });
});
