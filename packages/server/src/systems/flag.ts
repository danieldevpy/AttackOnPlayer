// T-021 (SPEC-0006): bandeira "rei do mapa". Servidor autoritativo — pickup por distância,
// segue o portador, derruba no local (morte ou desconexão) e, abandonada, volta ao centro.
// SPEC-0011 (T-040): toda posição em que a bandeira ASSENTA passa por `settle` (célula
// walkable alcançável mais próxima — nunca dentro de prop nem em bolsão fechado).
// SPEC-0011 (T-042): abandonada por FLAG_ABANDON_RETURN_MS, em vez de voltar direto ao
// centro, entra em COOLDOWN por FLAG_COOLDOWN_MS (fora do jogo, sem pickup); ao fim renasce
// no centro, acesa.
import { Flag, Player } from "../state/ArenaState";
import { FLAG_ABANDON_RETURN_MS, FLAG_COOLDOWN_MS } from "@aop/shared";

/** Ajusta uma posição de assentamento para a célula walkable alcançável mais próxima (T-040). */
export type SettleFn = (x: number, z: number) => { x: number; z: number };

/** Transição de estado da bandeira num tick — o ArenaRoom usa pra emitir debug_event/toast. */
export type FlagTickEvent = "flag_cooldown_start" | "flag_respawn" | null;

/** `settle` identidade — usado nos testes que não exercem a T-040 (posições já livres). */
const IDENTITY_SETTLE: SettleFn = (x, z) => ({ x, z });

export class FlagSystem {
  private droppedAt: number | null = null;
  // SPEC-0011 (T-042): timestamp em que o cooldown termina; null = bandeira ativa (no jogo).
  private cooldownUntil: number | null = null;
  private settle: SettleFn;

  /** `settle` (T-040) é injetado pelo ArenaRoom (fecha sobre o mapa/reachable); default identidade. */
  constructor(settle: SettleFn = IDENTITY_SETTLE) {
    this.settle = settle;
  }

  /** Troca a função de assentamento (o ArenaRoom só conhece o mapa depois do onCreate). */
  setSettle(settle: SettleFn) {
    this.settle = settle;
  }

  /** Posiciona a bandeira (nascimento da sala ou volta ao centro), assentando em célula válida. */
  initAt(flag: Flag, x: number, z: number) {
    const pos = this.settle(x, z);
    flag.x = pos.x;
    flag.z = pos.z;
    flag.carrierId = "";
    flag.state = "active";
    this.droppedAt = null;
    this.cooldownUntil = null;
  }

  pickup(flag: Flag, carrierId: string) {
    // T-042: bandeira em cooldown está fora do jogo — pickup impossível.
    if (flag.state === "cooldown") return;
    flag.carrierId = carrierId;
    this.droppedAt = null;
  }

  /** Derruba no local (morte do portador ou desaparecimento), assentando em célula válida. */
  drop(flag: Flag, x: number, z: number, now: number) {
    const pos = this.settle(x, z);
    flag.carrierId = "";
    flag.x = pos.x;
    flag.z = pos.z;
    this.droppedAt = now;
  }

  /**
   * Chamar todo tick. Com portador vivo, a bandeira segue sua posição; sem portador conta o
   * abandono. Após FLAG_ABANDON_RETURN_MS abandonada, entra em cooldown (fora do jogo); após
   * FLAG_COOLDOWN_MS renasce no centro (assentado pela T-040). Devolve a transição do tick,
   * se houver, pra o ArenaRoom emitir o evento correspondente.
   */
  tick(
    flag: Flag,
    players: { get(id: string): Player | undefined },
    center: { x: number; z: number },
    now: number
  ): FlagTickEvent {
    // T-042: em cooldown, a bandeira não interage — só espera o fim pra renascer no centro.
    if (this.cooldownUntil !== null) {
      if (now >= this.cooldownUntil) {
        const pos = this.settle(center.x, center.z);
        flag.x = pos.x;
        flag.z = pos.z;
        flag.carrierId = "";
        flag.state = "active";
        this.cooldownUntil = null;
        this.droppedAt = null;
        return "flag_respawn";
      }
      return null;
    }

    if (flag.carrierId) {
      const carrier = players.get(flag.carrierId);
      if (carrier && carrier.hp > 0) {
        flag.x = carrier.x;
        flag.z = carrier.z;
        return null;
      }
      this.drop(flag, flag.x, flag.z, now);
    }
    if (this.droppedAt !== null && now - this.droppedAt >= FLAG_ABANDON_RETURN_MS) {
      // T-042: em vez de voltar ao centro na hora, sai do jogo por FLAG_COOLDOWN_MS.
      flag.state = "cooldown";
      flag.carrierId = "";
      this.cooldownUntil = now + FLAG_COOLDOWN_MS;
      this.droppedAt = null;
      return "flag_cooldown_start";
    }
    return null;
  }
}
