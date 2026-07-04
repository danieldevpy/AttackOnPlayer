# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-04
**Branch:** `movimento_e_direcao` (SPEC-0003 em execução, sobre o que já tinha T-001..T-008 mergeado). Merge para `main` continua pendente (checklist em `QA.md`).
**Marco:** M1 — combate base pronto (T-001..T-008); SPEC-0003 quase completa (falta só T-012).

---

## Onde paramos

Última entrega fechada:

- **T-013** — bots migrados para `{x, z, aimX?, aimZ?, fire?}`: miram continuamente no alvo engajado, gatilho só liga dentro do alcance do launcher. Confirmado ao vivo: tiros voltaram (200+ por bot em sessões de combate) e uma morte/respawn completa apareceu no log do servidor.
- Antes: **T-011** (facing visível + bugfix crítico do `.js` órfão que sombreava `.ts` no Vite — ver `PROMPT-0016.md`), **T-010** (gatilhos desacoplados) e **T-009** (`Player.dir` sincronizado).
- **Nenhum efeito colateral conhecido pendente agora** — bots voltaram a atirar/matar como antes da T-010.

Detalhe completo: `docs/prompts/PROMPT-0014.md` (T-009), `0015.md` (T-010), `0016.md` (T-011 + bugfix), `0017.md` (T-013).

## Próximo passo sugerido

Só falta uma task para fechar `specs/SPEC-0003-facing-mira-gatilhos.md` por completo:

- **T-012** — ganchos de mobilidade em `LauncherDef` (ex.: `movement: { selfSlowFactor?, selfSlowMs?, inheritVelocityFactor? }`, defaults neutros) aplicados pelo servidor via `EffectSystem` no momento do disparo. Lançador de teste atrás de flag/DEV para validar (critério de aceite 5: reduz velocidade ao disparar e expira sozinho; `basic_shot` inalterado). Depende de T-010 (pronta).

Depois de T-012: revisar os 6 critérios de aceite da spec inteira e pedir veredito geral do CD (browser + headless), então considerar merge para `main`.

Prompt típico: `Executar T-012 da SPEC-0003`

## Veredito do Creative Director

| Fluxo | Status | Notas |
|---|---|---|
| Facing por mouse/teclado/parado (T-009) | ⬜ pendente teste do CD | verificado por IA via preview no browser |
| Disparo por espaço/clique idênticos (T-010) | ⬜ pendente teste do CD | verificado por IA via preview no browser |
| Nariz visível girando (T-011) | ⬜ pendente teste do CD | verificado por IA via preview no browser |
| Bots atirando/matando de novo (T-013) | ✅ verificado (headless) | `bot-4 morreu` confirmado no log |
| Merge para `main` | ⬜ pendente | checklist em `QA.md`; aguardando T-012 |

## Comandos úteis agora

```bash
npm run test                        # 5/5
npm run dev:server                  # DEBUG=1 opcional (feed F3 e /debug/rooms)
npm run dev:client
BOT_SKILL=forte npm run bots -- 6 30   # combate completo (tiro/dano/morte) já volta a funcionar
```

## Leituras se a sessão nova for só conversa

- Spec ativa → `specs/SPEC-0003-facing-mira-gatilhos.md`
- Facing/movimento → `docs/mechanics/movement.md`
- Mira/gatilho/combate → `docs/mechanics/combat.md`
- Bots / combate → `docs/ai/bots.md`
- Testes / merge → `docs/QA.md` (tem a guarda contra `.js` órfão)
