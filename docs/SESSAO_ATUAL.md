# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-06
**Branch:** `evolução`. **Marco:** V1.
**Sessão 40 (agente worker, Frente L): T-057 (SPEC-0015) — Janela pré-sala (lobby)** entregue:
`packages/client/src/lobby.ts` novo (`showLobby()` → `Promise<LobbySelection>`), integrado em
`main.ts` antes do `connect()`. Card completo: identidade (guest/conta, nick editável), seleção
de classe (archer) + preview 3D girando (`createCharacterVisual`), settings (perfil, volumes,
fullscreen), botão Jogar (1 clique). tsc ×3 limpo · vite build OK · shared 39/39 · server 89/89
· bots 35/35 · verificação funcional: card apareceu, 1 clique removeu overlay e iniciou o jogo.
Ver `docs/DEVLOG.md` (Sessão 40) e `docs/prompts/PROMPT-0057.md`.

**Sessão 39 (agente worker, Frente B): T-029 — ADR-012 liga na conta** entregue:
`PlayerStats` ganha `forca`/`agilidade`/`vitalidade` (migração `0004`); pickup de "box" em
`ArenaRoom.ts` reporta o delta pro Django via `platformClient.reportProgress()` quando
`PLATFORM_ENABLED=1` e o player tem `accountId`. Ver `docs/DEVLOG.md` (Sessão 39) e
`docs/prompts/PROMPT-0056.md`.

**Sessão 38 (agente worker, Frente B): T-061 — Auditoria + fechamento do admin** entregue.
Ver `docs/DEVLOG.md` (Sessão 38) e `docs/prompts/PROMPT-0055.md`.

**Sessão 37 (agente worker, Frente B): T-060 — KDA + ranking** entregue.
Ver `docs/DEVLOG.md` (Sessão 37) e `docs/prompts/PROMPT-0054.md`.

**Sessão 36 (agente worker, Frente C): T-056 — Skins por paleta** entregue.
Ver `docs/DEVLOG.md` (Sessão 36) e `docs/prompts/PROMPT-0053.md`.

---

## Estado das frentes V1

| Frente | Tasks | Status |
|---|---|---|
| S — Som (SPEC-0013) | T-049 ✅ T-050 ✅ T-051 ✅ | **Fechada** |
| C — Personagem (SPEC-0014) | T-052 ✅ T-053 ✅ T-054 ✅ T-055 ✅ T-056 ✅ | **Fechada** |
| B — Backend/Admin (SPEC-0008) | T-060 ✅ T-061 ✅ T-029 ✅ | **Fechada** |
| L — Lobby (SPEC-0015) | T-057 ✅ T-058 🔜 T-059 🔜 T-062 🔜 | **Em progresso** |

---

## Próximas tasks (Frente L)

- **T-058** 〔M〕 — Persistência de settings + nick: localStorage completo + sync Django
  (endpoint `PUT /api/v1/accounts/settings` da T-061). Depende de T-057 ✅.
- **T-059** 〔M〕⚠schema — Seleção no join: join envia `{nick, classId, skinId, profile}`;
  servidor valida e reflete; bots ganham classe default. Depende de T-057 ✅, T-052 ✅.
- **T-062** 〔P〕 — Aba ranking no card. Depende de T-057 ✅, T-060 ✅.

---

## Avisos operacionais

> **Preview oculto / screenshot timeout:** o WebGL renderer (e o rAF do preview 3D do lobby)
> bloqueiam a captura de screenshot via ferramenta de preview. Validar pelo DOM (snapshot) ou
> console em vez de screenshot. Este aviso se aplica a todas as sessões com Three.js ativo.

> **Banco de dev:** pytest verde não implica banco de dev migrado. Rodar
> `python manage.py migrate` antes de testar contra o Django real.

> **Google OAuth:** adiado pós-V1 (ADR-020). Plugar no mesmo endpoint de JWT (T-028a).

---

## Comandos úteis agora

```bash
npm run test -w @aop/shared && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)
for p in server client bots; do (cd packages/$p && npx tsc --noEmit) && echo "$p ok"; done
npm run build -w @aop/client
npm run aci -- doctor
npm run aci -- search <query>

# Backend Django
cd backend && ./dev.sh
python -m pytest
python manage.py makemigrations --check --dry-run
ruff check .
```

## Leituras se a sessão nova for só conversa

- Sessão atual → `docs/DEVLOG.md` (Sessão 40) e `docs/prompts/PROMPT-0057.md`
- Lobby spec → `specs/SPEC-0015-lobby-pre-sala.md`
- Próxima task T-058 → `docs/BACKLOG.md` linha T-058
- Backend Django → `backend/README.md`
- Frente C encerrada → `docs/DEVLOG.md` Sessões 30–36
