# QA — o que é garantido automaticamente

> Mapa de cobertura de testes e checklist antes de merge. **Não substitui** o veredito do CD em fluxos de combate/UI.  
> Atualizar quando nascer teste novo, bot behavior ou fluxo crítico.

---

## Gates automáticos (rodar antes de merge)

```bash
npm run test                              # vitest @aop/shared
cd packages/server && npx tsc --noEmit
cd packages/client && npx tsc --noEmit
cd packages/bots && npx tsc --noEmit
npm run bots -- 3 30                      # smoke headless

# Guarda (T-011, PROMPT-0016): nenhum .js compilado deve existir do lado de um .ts em src/ —
# Vite resolve import sem extensão preferindo .js, e um .js órfão vence o .ts real em silêncio.
find packages/*/src -name "*.ts" ! -name "*.d.ts" | sed 's/\.ts$/.js/' | xargs -I{} sh -c '[ -f "{}" ] && echo "STALE JS: {}"'
```

| Gate | Cobre | Não cobre |
|---|---|---|
| `npm run test` | Curva XP (`xpToNext`), `pickWeighted` de spawn | Combate, reroll, morte, rede |
| `tsc --noEmit` | Compilação server/client/bots | Comportamento runtime |
| Bots headless | Movimento, colisão, coleta, sync, métricas JSONL | Tiro, kill, respawn, reroll |

**CI:** ainda não existe no repositório — gates são locais até GitHub Action ser adicionada.

---

## Matriz: feature → como validar

| Feature | Automático | Manual recomendado |
|---|---|---|
| Mapa / zonas / props | Bots coletam | Olhar chão colorido no client |
| XP / level-up | Teste curva XP | HUD mostra nível subindo |
| Atributos | — | F3 ou state sync |
| Coletáveis por zona | Bots + métricas por kind | farm_event no HUD |
| Reroll (R) | — | Acumular 15+ coins, pressionar R, ver stats mudarem |
| Tiro / dano | — | **2 abas** no browser |
| Morte / respawn / perda nível | — | **2 abas** + F3 (`death`, `respawn`, `hit`, `safe_block`) |
| Debug F3 | — | F3 + `/debug/rooms` |
| Persistência box (scaffold) | — | Mesmo token reconecta; log servidor |

---

## Checklist de merge para `main`

### Obrigatório

- [ ] `npm run test` — 5/5
- [ ] Typecheck limpo (3 packages)
- [ ] `npm run bots -- 3 30` — sem crash
- [ ] Guarda de `.js` órfão (ver Gates automáticos) — sem saída
- [ ] Working tree limpa; commits coerentes
- [ ] `docs/SESSAO_ATUAL.md` reflete o merge
- [ ] Task correspondente ✅ no `BACKLOG.md`

### Manual (M1 — combate presente)

- [ ] Duas abas: kill → respawn → tiro funciona fora da safe zone
- [ ] F3 mostra `safe_block` quando alvo protegido
- [ ] Sem regressão óbvia de movimento/coleta

### Não bloqueia merge deste pacote

- T-008 bots atiram
- Balance TTK formal
- Touch / arte / deploy

---

## Veredito do Creative Director

Ao testar no browser, registrar no `PROMPT-NNNN.md` da leva:

```md
## Veredito CD
- Testado em: AAAA-MM-DD
- Fluxos: [ ] movimento [ ] coleta [ ] combate 2 abas [ ] F3 [ ] reroll
- Resultado: aprovado / ajustes pedidos
- Observações: ...
```

Se o veredito mudar o entendimento do jogo, atualizar também `docs/mechanics/PLAYER_LOOP.md`.

---

## Dívida conhecida (não esconder)

| Dívida | Impacto | Mitigação atual |
|---|---|---|
| Poucos testes unitários | Regressão em fórmulas/combate | vitest em curva XP + spawn weights |
| Bots não combatem | Kill/death não exercitados em CI | Smoke manual 2 abas |
| Sem CI | Merge depende de disciplina local | Este checklist |
| Números só no código | Docs podem envelhecer | PLAYER_LOOP aponta para constants.ts |

Próximas melhorias naturais: bots T-008 no smoke, testes de `lossFraction`/`rerollAttrPoints`, GitHub Action mínima.
