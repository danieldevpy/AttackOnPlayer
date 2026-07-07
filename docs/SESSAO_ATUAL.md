# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-06
**Branch:** `evolução`. **Marco:** V1.
**Sessão 41 (agente worker, Frente L): T-058 (SPEC-0015) — Persistência de settings + nick** entregue:
`packages/client/src/lobby.ts` recebeu bloco T-058: `fetchDjangoSettings()` / `saveDjangoSettings()` (best-effort).
GET ao abrir card sincroniza nick/perfil/volumes/fullscreen do Django com o card aberto.
PUT ao clicar Jogar envia payload completo; servidor sanitiza nick malicioso (fallback server-side).
tsc ×3 limpo · vite build OK · shared 39/39 · server 89/89 · bots 35/35 · pytest 112/112 · ruff OK.
Validação funcional curl: settings persistem; nick XSS → fallback confirmado.
Ver `docs/DEVLOG.md` (Sessão 41) e `docs/prompts/PROMPT-0058.md`.

**Sessão 40 (agente worker, Frente L): T-057 (SPEC-0015) — Janela pré-sala (lobby)** entregue.
Ver `docs/DEVLOG.md` (Sessão 40) e `docs/prompts/PROMPT-0057.md`.

**Sessão 39 (agente worker, Frente B): T-029 — ADR-012 liga na conta** entregue.
Ver `docs/DEVLOG.md` (Sessão 39) e `docs/prompts/PROMPT-0056.md`.

**Sessão 38 (agente worker, Frente B): T-061 — Auditoria + fechamento do admin** entregue.
Ver `docs/DEVLOG.md` (Sessão 38) e `docs/prompts/PROMPT-0055.md`.

---

## Estado das frentes V1

| Frente | Tasks | Status |
|---|---|---|
| S — Som (SPEC-0013) | T-049 ✅ T-050 ✅ T-051 ✅ | **Fechada** |
| C — Personagem (SPEC-0014) | T-052 ✅ T-053 ✅ T-054 ✅ T-055 ✅ T-056 ✅ | **Fechada** |
| B — Backend/Admin (SPEC-0008) | T-060 ✅ T-061 ✅ T-029 ✅ | **Fechada** |
| L — Lobby (SPEC-0015) | T-057 ✅ T-058 ✅ T-059 🔜 T-062 🔜 | **Em progresso** |

---

## Próximas tasks (Frente L)

- **T-059** 〔M〕⚠schema — Seleção no join: join envia `{nick, classId, skinId, profile}`;
  servidor valida contra `CLASS_REGISTRY` e reflete no estado; bots ganham classe default.
  Depende de T-057 ✅, T-058 ✅.
- **T-062** 〔P〕 — Aba ranking no card. Depende de T-057 ✅, T-060 ✅.

---

## Avisos operacionais

> **Preview oculto / screenshot timeout:** o WebGL renderer (e o rAF do preview 3D do lobby)
> bloqueiam a captura de screenshot via ferramenta de preview. Validar pelo DOM (snapshot) ou
> console em vez de screenshot. Este aviso se aplica a todas as sessões com Three.js ativo.

> **Banco de dev:** pytest verde não implica banco de dev migrado. Rodar
> `python manage.py migrate` antes de testar contra o Django real.

> **Google OAuth:** adiado pós-V1 (ADR-020). Plugar no mesmo endpoint de JWT (T-028a).

> **T-058 sync timing:** o GET Django ao abrir o card é async/best-effort — os elementos
> DOM já existem quando a promise resolve (card foi appended antes de disparar o fetch).
> O PUT ao clicar Jogar é fire-and-forget; selection.nick pode ser atualizado pela promise
> após o overlay ser removido — o join (T-059) usa o objeto `selection` que pode ter o nick
> sanitizado chegando depois. Mitigação em T-059: aguardar a promise antes do join, ou usar
> o nick do localStorage (que é atualizado pelo `saveDjangoSettings`).

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
source .venv/bin/activate && python -m pytest
python manage.py makemigrations --check --dry-run
ruff check .
```

## Leituras se a sessão nova for só conversa

- Sessão atual → `docs/DEVLOG.md` (Sessão 41) e `docs/prompts/PROMPT-0058.md`
- Lobby spec → `specs/SPEC-0015-lobby-pre-sala.md`
- Próxima task T-059 → `docs/BACKLOG.md` linha T-059
- Backend Django → `backend/README.md`
