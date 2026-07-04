# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-04
**Branch:** `evolução` — contém a SPEC-0003 (herdada, ainda sem merge) **e a SPEC-0004 implementada** (commits por task: docs → T-014 → T-015 → T-016 → T-017 → T-018 → fechamento).
**Marco:** M1.5 (escala de poder & builds) — **código completo e testado**, aguardando veredito do CD.

---

## Onde paramos

**SPEC-0004 executada por inteiro** (T-014..T-018, PROMPT-0020..0024). O jogo agora tem:

- **TTK alvo:** dano base 20 (5 tiros entre iguais; especialista em Força mata em 3). Medido com bots: kills/sessão ~2.8× o histórico (`docs/ai/balance-T014-ttk.md`).
- **5 atributos data-driven** (`ATTR_DEFS`): Força/Vitalidade/Agilidade + **Cadência** (cooldown) e **Alcance** (range), cada um com valor/pt e teto próprios. Reroll (R) redistribui entre os 5.
- **Cards de level-up:** 3 opções por nível (teclas 1/2/3), determinísticas, timeout 5s → auto-pick equilibrado; fila para múltiplos level-ups; servidor valida tudo.
- **Skills de projétil** nos marcos 4/8/12 (card ★, 1 de 2): Tiro Duplo, Leque, Perfurante, Fôlego, Impulso. Box também sorteia skill. Morte apaga build + skills.
- **Juice:** aro de poder por faixa de nível (4+/8+ pulsante), números de dano flutuantes (escalam com o dano), kill streak no HUD.
- Bots participam de tudo (auto-pick equilibrado; skill via card ★/box) — política por perfil fica na T-008b.

**Gates rodados nesta sessão:** shared 13/13 · server 17/17 · `tsc --noEmit` limpo (server/client/bots) · guarda `.js` órfão limpa · smoke headless com kills, level-up via card (hp 104 = card aplicado) e respawn.

## Próximo passo sugerido

1. **Veredito do CD no browser** — checklist novo na matriz do `QA.md`: cards no level-up (1/2/3 + timeout), F3 mostrando cadência/alcance, card ★ no nível 4, aro de poder, números de dano, streak, box dando skill. Duas abas para PvP.
2. **`Executar T-008b do docs/BACKLOG.md`** — perfis de build de bot (bruto/tanque/caçador) + boss (a espinha já está pronta: bots já recebem e escolhem cards).
3. **Merge `evolução` → `main`** — checklist do `QA.md` (gates automáticos já limpos; falta o manual do CD).
4. Depois: T-OPTIONAL 1 completo (re-medir TTK com builds variadas) e M2 (Aura).

Prompt típico: `Testar tudo no browser e dar veredito` ou `Executar T-008b do docs/BACKLOG.md`

## Veredito do Creative Director

| Fluxo | Status | Notas |
|---|---|---|
| SPEC-0004 design (PROPOSAL-0001) | ✅ aprovado (2026-07-04) | |
| Cards de level-up (1/2/3, timeout, fila) | ⬜ pendente teste do CD | verificado por IA: testes + bots headless |
| Cadência/Alcance no F3 e no jogo | ⬜ pendente teste do CD | verificado por IA: testes unitários |
| Card ★ de skill no marco (nível 4) | ⬜ pendente teste do CD | verificado por IA: testes + estática |
| Multishot/pierce em combate real | ⬜ pendente teste do CD | verificado por IA: testes unitários |
| Aro de poder / números de dano / streak | ⬜ pendente teste do CD | precisa de screenshot (faixas 1/5/9) |
| SPEC-0003 (facing/mira/gatilhos, herdada) | ⬜ pendente teste do CD | desde a sessão 5 |
| Merge para `main` | ⬜ pendente | gates automáticos limpos nesta sessão |

## Comandos úteis agora

```bash
npm run test                        # shared 13/13
cd packages/server && npx vitest run  # 17/17 (guardas de balance da SPEC-0004)
npm run dev:server && npm run dev:client  # testar cards/skills/juice no browser
npm run bots -- 4 30                # bots escolhem cards e disputam com o TTK novo
```

## Leituras se a sessão nova for só conversa

- Spec implementada → `specs/SPEC-0004-skills-atributos-escala.md` (status/desvios registrados)
- Números jogáveis → `docs/mechanics/PLAYER_LOOP.md` (atualizado: 5 atributos, cards, skills)
- Balance medido → `docs/ai/balance-T014-ttk.md`
- Detalhe por task → `docs/prompts/PROMPT-0020.md` a `PROMPT-0024.md`
- Próxima task → T-008b no `docs/BACKLOG.md`
