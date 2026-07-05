# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `evolução` — SPEC-0003/0004/0005 implementadas e commitadas; **PROPOSAL-0002 (plano da V1) escrita e aguardando aprovação do CD**.
**Marco:** M1.5 fechado em código · **V1 (lançamento) planejada** em 6 fases.

---

## Onde paramos

**Sessão de design (sem código de jogo).** O CD jogou a build, trouxe 9 percepções de jogador/analista e pediu o plano completo até a primeira versão pública. Produzido:

- **`docs/proposals/PROPOSAL-0002-v1-lancamento.md`** — o plano: estado atual alinhado com todas as sessões, análise ponto a ponto (com acréscimos da IA), arquitetura alvo (Node/Colyseus = tempo real · Django = plataforma/admin · Postgres · docker compose dev/prod + scripts), guardrails da constituição, 6 fases e 14 tasks novas.
- **BACKLOG** — seção "V1 — Rumo ao lançamento" (T-019..T-032; T-032 = 🚀 deploy na VPS + divulgação).
- **ROADMAP** — V1 substitui M4/M5; Aura/Guardian viram pós-V1.

**Destaques do plano que precisam do OK do CD:**
- **T-019 reverte a ADR-014.6:** mira volta ao mouse, agora estilo **CS-2D** (crosshair 360° + strafe). É a 3ª iteração de mira — todas testadas em jogo, decisão registrada como ADR-015 na aprovação.
- **Django entra na V1** (contas/admin/gameops) com fronteira dura: nunca decide gameplay em tempo real; conta nunca dá poder in-round.
- **5 questões abertas** no §7 da proposal (bônus da bandeira, tempo do reveal, skins placeholder, confirmação do Django, canal de divulgação).

## Próximo passo sugerido

1. **CD lê a PROPOSAL-0002** e responde as 5 questões abertas (§7) — aprovar/ajustar.
2. Na aprovação: IA converte F1+F2 → SPEC-0006, F3 → SPEC-0007, F4 → SPEC-0008, F5+F6 → SPEC-0009 (+ ADR-015/016) e começa `Executar T-019 do docs/BACKLOG.md`.
3. **Herdado (continua valendo):** veredito no browser das SPECs 3/4/5 (checklists no QA.md) e merge `evolução` → `main` — recomendo fazer antes do código da V1 começar.

Prompt típico: `Aprovo a PROPOSAL-0002 com os ajustes X e Y — gere as specs e execute a F1`

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| PROPOSAL-0002 (plano da V1) | ⬜ aguardando leitura/aprovação | 5 questões abertas no §7 |
| SPEC-0005 (XP passivo, morte zera, escudo, facing) | ⬜ pendente teste no browser | 19/19 no server |
| SPEC-0004 (cards/skills/juice/TTK) | ⬜ pendente teste no browser | 30 testes verdes |
| SPEC-0003 (facing/mira/gatilhos) | ⬜ pendente teste no browser | herdada |
| Merge `evolução` → `main` | ⬜ pendente | gates automáticos limpos |

## Comandos úteis agora

```bash
npm run test                          # shared 13/13
cd packages/server && npx vitest run  # 19/19
npm run dev:server && npm run dev:client  # testar SPECs 3/4/5 no browser
npm run bots -- 4 30
```

## Leituras se a sessão nova for só conversa

- **O plano da V1** → `docs/proposals/PROPOSAL-0002-v1-lancamento.md`
- Tasks da V1 → seção "V1" no `docs/BACKLOG.md` (T-019..T-032)
- Estado jogável atual → `docs/mechanics/PLAYER_LOOP.md`
- Últimas mudanças de gameplay → `specs/SPEC-0005-*.md` (ADR-014)
