# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `evolução` — working directory original.
**Marco:** V1 (lançamento público) — PROPOSAL-0002 aprovada; T-019..T-021 concluídas e aprovadas no 1º teste manual do CD (Sessão 12/PROMPT-0032); Sessão 13 resolveu 2 pontos de feedback extra (progressão de skill/atributo + bug do menu de level-up). **Pausa pedida pelo CD** para alinhar o estado atual do projeto antes de retomar a fila (T-022 em diante).

---

## ⚠️ Sessão concorrente conhecida

Existe (ou existiu) uma sessão paralela na branch `aci` (`.claude/worktrees/aci`, scaffold `packages/aci`/PROPOSAL-0003 — módulo isolado, sem relação com a V1). Há também uma pasta `packages/aci/` **não versionada** na working directory original + um `snapshot-test.sh` solto — resíduos de outra esteira; **não mexer neles**. Antes de qualquer limpeza, checar se a sessão `aci` ainda está ativa (`git branch -a`, `git worktree list`).

## Onde paramos

**Concluído na Sessão 13 (feedback de jogo do CD, sem task de backlog associada — PROMPT-0033):**
- **Progressão de skill/atributo:** `UPGRADE_CARD_POINTS` dobrou (3→6, `ATTR_POINTS_PER_LEVEL_EACH` acompanhou 1→2); `SKILL_MILESTONE_LEVELS` foi de 3 marcos esparsos (4/8/12) pra 5 (3/6/9/12/15, um por skill existente — antes era impossível fechar as 5 skills numa run); composição da oferta nos marcos inverteu para **2 atributo + 1 skill** (`SKILL_MILESTONE_SKILL`, skill fixa por marco).
- **Bugfix:** menu de level-up ficava travado na tela se o jogador morresse com a oferta aberta — servidor agora manda `upgrade_offer_closed` quando a morte cancela uma oferta pendente.
- Verificado com 2 smokes end-to-end reais contra servidor de verdade (economia de cards em runtime; morte forçada dentro da janela de 5s do menu). Todos os gates verdes.

**Sessões anteriores:** QA do 1º teste manual — tank controls + bots que simulam players (Sessão 12/PROMPT-0032), T-021 bandeira (Sessão 11), T-020/T-008b bots (Sessão 10), T-019/T-019b perfis (Sessão 10) — ver `DEVLOG.md`.

## Próximo passo

1. **Alinhamento pedido pelo CD antes de continuar:** revisar junto com ele o estado atual do projeto (o que está pronto/testado vs. o que só passou em gate automático) e o que falta da parte dele (testes manuais pendentes, vereditos de sensação) antes de abrir novas tasks.
2. Depois do alinhamento, retomar a fila: `Executar T-022` — VFX nomeados (registry de partículas data-driven + backlog vivo `docs/mechanics/vfx-juice-backlog.md`).
3. **Calibração pendente (não bloqueia):** ritmo novo dos marcos de skill (3/6/9/12/15) e valor dobrado dos cards são chute inicial validado por sensação nesta sessão — T-026/telemetria confirma com dados quando existir. Os knobs de bot da Sessão 12 (`1+objective`, `targetBias`, `SEPARATION_DIST`, `CORNERED_BORDER_DIST`) têm a mesma ressalva.

## Pendências reais do lado do CD (não bloqueiam a esteira, só ele resolve)

| Item | Status | Notas |
|---|---|---|
| Touch em dispositivo real | ⬜ pendente | bots não cobrem; smoke só simula mouse/keyboard/servidor |
| Sessão mais longa com vários humanos | ⬜ pendente | tudo testado até aqui foi CD sozinho + bots, ou smokes headless via colyseus.js |
| Veredito dos novos números (skill 3/6/9/12/15, cards ×2) numa sessão de verdade | ⬜ pendente | aprovado por lógica/smoke; falta "sentir" jogando período longo |

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| PROPOSAL-0002 + ajustes §9 | ✅ aprovada (2026-07-05) | specs SPEC-0006..0009 derivadas |
| T-019 / T-019b (perfis de controle) | ✅ testado manualmente — keyboard refeito como tank controls e aprovado | PROMPT-0027/0028/0032 |
| T-020 + T-008b (IA/perfis dos bots) | ✅ testado manualmente — aprovado após refinamentos ("simular players") | PROMPT-0029/0030/0032 |
| T-021 (bandeira "rei do mapa") | ✅ testado manualmente — disputa agora atira no portador; retorno 5s | PROMPT-0031/0032 |
| Progressão de skill/atributo (addendum SPEC-0004) | ✅ implementado e verificado por smoke real — pendente sensação de sessão longa | PROMPT-0033 |
| Menu de level-up fechando na morte | ✅ corrigido e verificado por smoke real | PROMPT-0033 |
| Touch em dispositivo real | ⬜ pendente | bots não cobrem |

## Comandos úteis agora

```bash
npm run test -w @aop/shared && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 13/13 + 25/25 + 24/24
npm run dev:server && npm run dev:client
npm run bots -- 10 0                          # 10 bots para sempre, MESMA sala, dosagem no log
BOT_BOSS=1 BOT_VERBOSE=1 npm run bots -- 4 20 # bot-0 vira boss (nível 6-8)
```

## Leituras se a sessão nova for só conversa

- Plano-mãe → `docs/proposals/PROPOSAL-0002-v1-lancamento.md` (§9 = ajustes finais do CD)
- Specs executáveis → `specs/SPEC-0006..0009` (SPEC-0004 tem addendum de 2026-07-05 sobre a progressão)
- Teoria + implementação dos bots → `docs/ai/bot-architecture.md` + `docs/ai/bots.md`
- Feedback do CD → `docs/CREATIVE_DIRECTOR_NOTES.md` (2 entradas em 2026-07-05) + `docs/prompts/PROMPT-0032.md` e `PROMPT-0033.md`
- Tasks → seção V1 do `docs/BACKLOG.md` (T-019..T-021 ✅, T-022..T-032 pendentes)
