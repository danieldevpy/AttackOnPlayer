// Registro de classes de personagem (T-052, SPEC-0014/PROPOSAL-0004 §4) — contrato
// data-driven: classe nova (guerreiro/mago) = 1 entrada aqui, sem tocar sistema. Só
// "archer" por enquanto — os launchers já existentes (basic_shot/heavy_shot/rapid_shot)
// viram os "projéteis da classe" via `launcherIds` (ADR-011: sem mudar dano/rede).

export interface ClassDef {
  id: string;
  launcherIds: string[]; // lançadores (launchers.ts) disponíveis pra esta classe
  baseTint: number; // cor base (hex 0xRRGGBB) do visual procedural (T-053); tint da skin default
  skinIds: string[]; // paletas alternativas; 1º item é a skin default da classe
  skinTints: Record<string, number>; // T-056: cor (hex) por skinId — a fábrica deriva a paleta a partir dela
}

export const CLASS_REGISTRY: Record<string, ClassDef> = {
  archer: {
    id: "archer",
    launcherIds: ["basic_shot", "heavy_shot", "rapid_shot"],
    baseTint: 0x6b4f2a, // couro/madeira — placeholder de gameplay-first (ADR-008) até arte final
    skinIds: ["default", "verde", "cinza"],
    skinTints: {
      default: 0x6b4f2a, // couro/madeira (== baseTint)
      verde: 0x3f5c3a, // couro esverdeado
      cinza: 0x5a5f66, // couro acinzentado/metálico
    },
  },
};

export const DEFAULT_CLASS_ID = "archer";

/** Classe válida = tem entrada no registro. */
export function isValidClassId(id: unknown): id is string {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(CLASS_REGISTRY, id);
}

/** Skin válida = existe na lista de skins DA classe informada (nunca cross-classe). */
export function isValidSkinId(classId: string, skinId: unknown): skinId is string {
  const def = CLASS_REGISTRY[classId];
  return !!def && typeof skinId === "string" && def.skinIds.includes(skinId);
}

/**
 * Resolve a escolha de classe/skin no join: inválido ou ausente cai pro default — join NUNCA
 * rejeita por causa de classId/skinId ruim (mesma regra de authToken opcional, T-028b).
 */
export function resolveClassSelection(
  classId?: unknown,
  skinId?: unknown
): { classId: string; skinId: string } {
  const resolvedClassId = isValidClassId(classId) ? classId : DEFAULT_CLASS_ID;
  const def = CLASS_REGISTRY[resolvedClassId];
  const resolvedSkinId = isValidSkinId(resolvedClassId, skinId) ? (skinId as string) : def.skinIds[0];
  return { classId: resolvedClassId, skinId: resolvedSkinId };
}

// T-059 (SPEC-0015): comprimento máximo do nick no join. Alinhado ao limite do lobby (20 chars
// visíveis, SPEC §Identidade) e ao teto do `sanitize_display_name` do Django (32). Usamos 20
// como corte autoritativo do servidor Colyseus.
export const NICK_MAX_LEN = 20;

/** Fallback usado quando o nick é ausente/malicioso — nunca rejeita o join, sempre entra. */
export const DEFAULT_NICK = "Guest";

// Charset permitido: letras (Unicode, inclui acentos), dígitos, underscore, espaço, hífen e ponto.
// Bloqueia HTML/script (`<`, `>`), caracteres de controle, emoji, RTL override etc. — mesma
// política do `sanitize_display_name` do Django (backend/accounts/services.py), agora aplicada
// também no servidor de jogo (autoridade dupla: cliente pode ter sido burlado).
const NICK_RE = /^[\p{L}\p{N}_ \-.]+$/u;

/**
 * Sanitiza um nick vindo do cliente no join. Fora do charset/tamanho permitido (ou vazio) => cai
 * pro `fallback` INTEIRO (nunca trunca/edita um nick malicioso — mesmo aceite da T-058/Django).
 * Nick válido só é truncado por comprimento (`NICK_MAX_LEN`). Servidor sempre vence o cliente.
 */
export function sanitizeDisplayName(raw?: unknown, fallback: string = DEFAULT_NICK): string {
  if (typeof raw !== "string") return fallback;
  const candidate = raw.trim();
  if (!candidate || !NICK_RE.test(candidate)) return fallback;
  return candidate.slice(0, NICK_MAX_LEN);
}
