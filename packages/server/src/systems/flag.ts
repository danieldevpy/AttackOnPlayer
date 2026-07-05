// T-021 (SPEC-0006): bandeira "rei do mapa". Servidor autoritativo — pickup por distância,
// segue o portador, derruba no local (morte ou desconexão) e volta ao centro se abandonada.
import { Flag, Player } from "../state/ArenaState";
import { FLAG_ABANDON_RETURN_MS } from "@aop/shared";

export class FlagSystem {
  private droppedAt: number | null = null;

  /** Posiciona a bandeira (nascimento da sala ou volta ao centro). */
  initAt(flag: Flag, x: number, z: number) {
    flag.x = x;
    flag.z = z;
    flag.carrierId = "";
    this.droppedAt = null;
  }

  pickup(flag: Flag, carrierId: string) {
    flag.carrierId = carrierId;
    this.droppedAt = null;
  }

  /** Derruba no local (morte do portador ou desaparecimento sem passar pela morte). */
  drop(flag: Flag, x: number, z: number, now: number) {
    flag.carrierId = "";
    flag.x = x;
    flag.z = z;
    this.droppedAt = now;
  }

  /**
   * Chamar todo tick: com portador vivo, a bandeira segue sua posição; sem portador
   * (inclusive se ele desconectou sem passar pelo fluxo de morte), conta o abandono e
   * volta ao centro após `FLAG_ABANDON_RETURN_MS`.
   */
  tick(flag: Flag, players: { get(id: string): Player | undefined }, center: { x: number; z: number }, now: number) {
    if (flag.carrierId) {
      const carrier = players.get(flag.carrierId);
      if (carrier && carrier.hp > 0) {
        flag.x = carrier.x;
        flag.z = carrier.z;
        return;
      }
      this.drop(flag, flag.x, flag.z, now);
    }
    if (this.droppedAt !== null && now - this.droppedAt >= FLAG_ABANDON_RETURN_MS) {
      flag.x = center.x;
      flag.z = center.z;
      this.droppedAt = null;
    }
  }
}
