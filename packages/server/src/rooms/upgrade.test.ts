import { describe, it, expect } from "vitest";
import { ArenaRoom } from "./ArenaRoom";
import { Player } from "../state/ArenaState";
import { UPGRADE_AUTO_PICK, UpgradeCard } from "@aop/shared";

/**
 * Bug reportado pelo CD (2026-07-07): oferta de card no timeout ("auto-pick") aplicava
 * sempre `UPGRADE_AUTO_PICK` ("equilibrado") direto, ignorando `pending.cards` — a oferta
 * REAL mandada pro cliente. Isso ficou visível quando a oferta virou sorteio (constants.ts,
 * `upgradeCardsForLevel`): "equilibrado" nem sempre é uma das 3 cartas sorteadas, então o
 * timeout aplicava uma carta que o jogador nunca viu na tela (ou aplicava sempre a mesma,
 * já que era um valor fixo). Harness sem transporte Colyseus, como em classes.test.ts.
 */
function makeRoom(): any {
  const room: any = new ArenaRoom();
  room.clients = [];
  room.onCreate({ flagEnabled: false });
  return room;
}

function addPlayer(room: any, id: string): Player {
  const p = new Player();
  p.x = 5;
  p.z = 5;
  p.hp = 100;
  p.maxHp = 100;
  p.level = 1;
  room.state.players.set(id, p);
  return p;
}

function lastUpgradeEvent(room: any) {
  const evs = room.debugEvents.filter((e: any) => e.type === "upgrade");
  return evs[evs.length - 1]?.payload ?? null;
}

/** Monta uma oferta pendente e expirada, sem passar pelo sorteio real (controle total do teste). */
function forceExpiredOffer(room: any, id: string, cards: UpgradeCard[]) {
  room.pendingUpgrade.set(id, { levels: [2], cards, expiresAt: Date.now() - 1 });
}

describe("auto-pick no timeout da oferta de level-up (bug de card fora da lista)", () => {
  it("aplica 'equilibrado' quando ele está entre as cartas realmente oferecidas", () => {
    const room = makeRoom();
    const p = addPlayer(room, "A");
    const cards: UpgradeCard[] = [
      { id: "forca_bruta", label: "+6 Força", points: { forca: 6 } },
      UPGRADE_AUTO_PICK,
      { id: "pes_ligeiros", label: "+6 Agilidade", points: { agilidade: 6 } },
    ];
    forceExpiredOffer(room, "A", cards);

    room.update(0.05);

    const ev = lastUpgradeEvent(room);
    expect(ev).not.toBeNull();
    expect(ev.auto).toBe(true);
    expect(ev.cardId).toBe("equilibrado");
    expect(p.pendingUpgrades).toBe(0);
  });

  it("NUNCA aplica uma carta fora da oferta quando 'equilibrado' não foi sorteado", () => {
    const room = makeRoom();
    const p = addPlayer(room, "B");
    const cards: UpgradeCard[] = [
      { id: "forca_bruta", label: "+6 Força", points: { forca: 6 } },
      { id: "rajada", label: "+6 Cadência", points: { cadencia: 6 } },
      { id: "mira_longa", label: "+6 Alcance", points: { alcance: 6 } },
    ];
    forceExpiredOffer(room, "B", cards);

    room.update(0.05);

    const ev = lastUpgradeEvent(room);
    expect(ev).not.toBeNull();
    expect(ev.auto).toBe(true);
    expect(cards.map((c) => c.id)).toContain(ev.cardId);
    expect(p.pendingUpgrades).toBe(0);
  });

  it("mesma oferta (sem equilibrado) sorteada muitas vezes cobre mais de uma carta — não trava sempre na mesma", () => {
    const cards: UpgradeCard[] = [
      { id: "forca_bruta", label: "+6 Força", points: { forca: 6 } },
      { id: "rajada", label: "+6 Cadência", points: { cadencia: 6 } },
      { id: "mira_longa", label: "+6 Alcance", points: { alcance: 6 } },
    ];
    const picked = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const room = makeRoom();
      addPlayer(room, "C");
      forceExpiredOffer(room, "C", cards.map((c) => ({ ...c })));
      room.update(0.05);
      picked.add(lastUpgradeEvent(room).cardId);
    }
    expect(picked.size).toBeGreaterThan(1);
    for (const id of picked) expect(cards.map((c) => c.id)).toContain(id);
  });
});
