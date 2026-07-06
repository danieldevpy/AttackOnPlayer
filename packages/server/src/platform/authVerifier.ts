/**
 * T-028b (SPEC-0008): verifica o JWT de conta emitido pelo Django (accounts.jwt, T-027c) no join
 * do Colyseus, contra a chave pública exposta em `/auth/jwks.json`. `createRemoteJWKSet` cacheia
 * o JWKS internamente — não há round-trip por join, só na primeira verificação (ou quando o `kid`
 * muda). Token ausente/expirado/inválido cai para guest sem derrubar o join (nunca lança) — a
 * conta é só identidade/estatística, nunca poder in-round (Constituição/ADR-016).
 */
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AccountClaims {
  sub: string;
  isGuest: boolean;
  displayName: string;
}

function baseUrl(): string {
  return process.env.PLATFORM_URL || "http://localhost:8000";
}

function issuer(): string {
  return process.env.JWT_ISSUER || "aop-platform";
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksBaseUrl = "";

function getJwks() {
  const url = baseUrl();
  if (!jwks || jwksBaseUrl !== url) {
    jwks = createRemoteJWKSet(new URL(`${url}/api/v1/auth/jwks.json`));
    jwksBaseUrl = url;
  }
  return jwks;
}

/** Claims da conta se o token for válido, ou `null` (cai para guest) em qualquer falha. */
export async function verifyAccountToken(token: string): Promise<AccountClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      algorithms: ["RS256"],
      issuer: issuer(),
    });
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      isGuest: Boolean(payload.is_guest),
      displayName: typeof payload.display_name === "string" ? payload.display_name : "player",
    };
  } catch (e) {
    console.error("[auth] token inválido/expirado — caindo para guest:", (e as Error).message);
    return null;
  }
}

/** Só para testes — descarta o JWKS remoto cacheado entre casos. */
export function resetJwksCache() {
  jwks = null;
  jwksBaseUrl = "";
}
