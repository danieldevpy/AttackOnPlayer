import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { resetJwksCache, verifyAccountToken } from "./authVerifier";

const KEY_ID = "test-key-1";
const ISSUER = "aop-platform";

let privateKey: CryptoKey;
let jwk: Record<string, unknown>;

async function signClaims(overrides: Record<string, unknown> = {}, opts: { expired?: boolean } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: "acc-1",
    is_guest: false,
    display_name: "Jogador Real",
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: KEY_ID })
    .setIssuedAt(now)
    .setIssuer(overrides.iss as string | undefined ?? ISSUER)
    .setExpirationTime(opts.expired ? now - 60 : now + 3600)
    .sign(privateKey);
}

function jwksResponse() {
  return { ok: true, status: 200, json: async () => ({ keys: [jwk] }) } as Response;
}

describe("verifyAccountToken (T-028b)", () => {
  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    jwk = { ...(await exportJWK(pair.publicKey)), kid: KEY_ID, use: "sig", alg: "RS256" };
  });

  beforeEach(() => {
    resetJwksCache();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jwksResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retorna as claims para um token válido assinado pela chave do JWKS", async () => {
    const token = await signClaims();

    const claims = await verifyAccountToken(token);

    expect(claims).toEqual({ sub: "acc-1", isGuest: false, displayName: "Jogador Real" });
  });

  it("marca isGuest a partir da claim is_guest", async () => {
    const token = await signClaims({ is_guest: true });

    const claims = await verifyAccountToken(token);

    expect(claims?.isGuest).toBe(true);
  });

  it("cai para null (guest) em token expirado", async () => {
    const token = await signClaims({}, { expired: true });

    expect(await verifyAccountToken(token)).toBeNull();
  });

  it("cai para null (guest) com issuer diferente do esperado", async () => {
    const token = await signClaims({ iss: "outro-issuer" });

    expect(await verifyAccountToken(token)).toBeNull();
  });

  it("cai para null (guest) com token malformado", async () => {
    expect(await verifyAccountToken("nao-e-um-jwt")).toBeNull();
  });

  it("cai para null (guest) quando o JWKS do Django está fora do ar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const token = await signClaims();

    expect(await verifyAccountToken(token)).toBeNull();
  });
});
