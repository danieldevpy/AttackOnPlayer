# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-04
**Branch:** `evolução` — contém SPEC-0003 (herdada), **SPEC-0004** (T-014..T-018) **e agora SPEC-0005** (ajustes pós-teste do CD).
**Marco:** M1.5 (escala de poder & builds) + ajustes de ritmo — **código completo e testado**, aguardando veredito do CD.

---

## Onde paramos

**SPEC-0005 executada** (6 ajustes pedidos pelo CD após jogar com bots — ADR-014, PROMPT-0025):

1. **XP passivo:** todo player vivo ganha **+1 XP/s** (`XP_PER_SECOND`) — o mapa não "esfria".
2. **Morte zera o nível:** morrer volta ao **nível 1** (aposenta `lossFraction` do loop).
3. **Reroll (R) dá XP:** +20 XP (`REROLL_XP_REWARD`) além de redistribuir atributos.
4. **Zonas safe removidas** do mapa (só guerra/campo agora).
5. **Invulnerabilidade de nascimento:** 3s imune ao nascer/renascer (`SPAWN_PROTECTION_MS`); **cai ao atirar**. Bolha azul no cliente + contador `escudo` no F3. Novo evento debug `shield_block`.
6. **Facing pelo movimento:** a direção/visão do player vem do **movimento** (WASD), calculada no servidor — o **mouse não controla o facing** (correção de 2026-07-05; a 1ª versão pôs sob o mouse). Cliente do player não envia mais `aim`; o campo fica só para os bots.

**Correção 2026-07-05 (PROMPT-0026):** além do item 6 acima, o **XP passivo agora entra inteiro** (acumulador de tempo no servidor, `xpAccum`) — o HUD não mostra mais XP fracionado tipo `1.478/88`.

**Gates rodados nesta sessão:** shared 13/13 · server **19/19** (2 testes novos de invuln de nascimento) · `tsc --noEmit` limpo (server/client/bots) · guarda `.js` órfão limpa · smoke com 3 bots (level-up por presença sem kill; combate ok) · scripts de verificação (escudo bloqueia dano / cai ao atirar; 0 tiles safe gerados).

## Próximo passo sugerido

1. **Veredito do CD no browser** — checklist novo na matriz do `QA.md` (linhas SPEC-0005: XP passivo, nível zera na morte, escudo de 3s + bolha, facing por movimento, reroll dando XP). Duas abas para PvP.
2. **Re-medir pacing** — XP passivo × morte-zera-nível pode acelerar/achatar demais a curva; rodar bots e olhar `docs/ai/balance-T014-ttk.md`.
3. **`Executar T-008b do docs/BACKLOG.md`** — perfis de build de bot (bruto/tanque/caçador) + boss.
4. **Merge `evolução` → `main`** — checklist do `QA.md` (gates automáticos limpos; falta o manual do CD).

Prompt típico: `Testar tudo no browser e dar veredito` ou `Executar T-008b do docs/BACKLOG.md`

## Veredito do Creative Director

| Fluxo | Status | Notas |
|---|---|---|
| SPEC-0005 (6 ajustes de gameplay) | ⬜ pendente teste do CD | verificado por IA: testes + scripts + smoke |
| XP passivo / reroll dá XP | ⬜ pendente teste do CD | bot sobe de nível sem kill (smoke) |
| Morte zera o nível | ⬜ pendente teste do CD | `respawn` com `levelAfter:1` |
| Invuln de nascimento (3s, bolha, cai ao atirar) | ⬜ pendente teste do CD | verificado por IA: 2 testes server + script |
| Facing pelo movimento (mouse não mira) | ⬜ pendente teste do CD | só verificável no browser |
| SPEC-0004 (cards/skills/juice/TTK) | ⬜ pendente teste do CD | verificado por IA na sessão 7 |
| SPEC-0003 (facing/mira/gatilhos, herdada) | ⬜ pendente teste do CD | desde a sessão 5 |
| Merge para `main` | ⬜ pendente | gates automáticos limpos nesta sessão |

## Comandos úteis agora

```bash
npm run test                          # shared 13/13
cd packages/server && npx vitest run  # 19/19 (inclui invuln de nascimento, SPEC-0005)
npm run dev:server && npm run dev:client  # testar no browser (facing por movimento, escudo, XP passivo)
npm run bots -- 4 30                  # bots: presença sobe nível; morte zera; sem safe
```

## Leituras se a sessão nova for só conversa

- Ajustes implementados → `specs/SPEC-0005-presenca-viva-morte-dura-mira-continua.md`
- Decisão → `docs/DECISION_LOG.md` ADR-014
- Números jogáveis → `docs/mechanics/PLAYER_LOOP.md` (XP passivo, reroll+XP, morte zera, escudo, facing por movimento)
- Detalhe do pedido → `docs/prompts/PROMPT-0025.md`
- Próxima task → T-008b no `docs/BACKLOG.md`
