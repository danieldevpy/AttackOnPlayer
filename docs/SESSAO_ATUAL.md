# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-05
**Branch:** `evolução` — working directory original.
**Marco:** V1 (lançamento público) — PROPOSAL-0002 aprovada; **fase F2 completa** (T-019..T-023); **F3 iniciada** com T-024 (registry de objetos + mapa v1) entregue. Fila segue para T-025 (CLI de mapas).

---

## ⚠️ Sessão concorrente conhecida

Existe (ou existiu) uma sessão paralela na branch `aci` (`.claude/worktrees/aci`, scaffold de `packages/aci`/PROPOSAL-0003 — módulo isolado, sem relação com a V1). Há também uma pasta `packages/aci/` **não versionada** na working directory original + um `snapshot-test.sh` solto — resíduos de outra esteira; **não mexer neles**. Antes de qualquer limpeza, checar se a sessão `aci` ainda está ativa (`git branch -a`, `git worktree list`).

**Novo nesta sessão:** existem OUTROS projetos totalmente não relacionados rodando processos na mesma máquina — `/home/daniel/Desenvolvimento/particulas`, `/home/daniel/Desenvolvimento/AtakkTeste` e `/home/daniel/Desenvolvimento/AttakOnPlayer-teste` (note o nome quase idêntico ao deste repo!). Ao usar `ps aux`/`kill`, sempre confirmar o `cwd` do processo (`/proc/<pid>/cwd` ou o caminho no próprio comando) antes de matar — nunca assumir pelo nome do processo (`bot.ts`, `tsx`, etc.) sozinho.

## Onde paramos

**Concluído na Sessão 16 (T-024, PROMPT-0036):**
- **Registry de objetos** (`packages/shared/src/objects.ts`, `ObjectDef{id,footprint,collidable}`) para `pedra`/`arvore`/`caixa`/`muro`/`bandeira`.
- **Formato de mapa v1** (`packages/shared/src/mapFile.ts`, `MapFileV1`) + `validateMapFile` (objectId desconhecido, fora dos limites, flood-fill via novo `floodFillReachable` em `map.ts`) + `mapFileToGameMap` (produz a MESMA `GameMap` do gerador por seed — zero mudança em colisão/zonas/bots/render).
- **Loader só de servidor** (`packages/server/src/mapLoader.ts`, lê `maps/<id>.map.json`) + `ArenaRoom` aceita `mapId` opcional (`ArenaState.mapId`, vazio = seed como sempre); mapa curado manda o JSON por mensagem `map_data` no join (cliente/bots não leem disco do servidor). `BOT_MAP_ID` (env var) permite QA sem esperar a CLI.
- Fixture de exemplo `maps/arena-teste.map.json` provou o pipeline ponta a ponta: smoke real com 3 bots + 1 humano na mesma sala curada, combate/pathfinding/zona de guerra funcionando, screenshot confirmando o mapa 15×13 renderizado corretamente.
- shared 20/20 (7 novos testes) · server 25/25 · bots 24/24 · tsc limpo em todos os pacotes.

**Sessões anteriores:** HUD dev/prod + reveal-on-hit + toasts (Sessão 15/PROMPT-0035, fecha a F2), VFX nomeados (Sessão 14/PROMPT-0034) — ver `DEVLOG.md` para o histórico completo (Sessões 10-15).

## Próximo passo

1. **Executar T-025** — CLI de mapas: `npm run map -- gen|save|save-current|update|list|preview`. `save-current` serializa o mapa da sala em execução (provavelmente via um endpoint/mensagem de debug que devolve o `GameMap` atual do servidor + zonas/spawns/bandeira, convertido para `MapFileV1`); `preview` é ASCII no terminal para curadoria. Depende de T-024 (pronto): `validateMapFile`/`mapFileToGameMap`/`loadMapFile` já existem para a CLI consumir. Contexto: `specs/SPEC-0007-mapas-e-objetos.md`, `docs/BACKLOG.md` linha ~119.
2. T-025 fecha os critérios de aceite da SPEC-0007 que dependem de salvar/reajustar um mapa real ("2 mapas curados distintos", fluxo editar-JSON-e-jogar completo).
3. **Calibração pendente (não bloqueia):** nenhuma nova nesta sessão — T-024 é puramente estrutural (formato de dados), sem números de balance para o CD calibrar.

## Pendências reais do lado do CD (não bloqueiam a esteira, só ele resolve)

| Item | Status | Notas |
|---|---|---|
| Touch em dispositivo real | ⬜ pendente | bots não cobrem; smoke só simula mouse/keyboard/servidor |
| Sessão mais longa com vários humanos | ⬜ pendente | tudo testado até aqui foi CD sozinho + bots, ou smokes headless/preview solo |
| Veredito dos novos números de progressão (Sessão 13) numa sessão de verdade | ⬜ pendente | aprovado por lógica/smoke; falta "sentir" jogando período longo |
| Veredito visual dos VFX (Sessão 14) — cores/intensidade/timing | ⬜ pendente | implementado e visto renderizar em screenshot; falta o CD jogar e dar veredito de "sensação" |
| Veredito do reveal-on-hit/toasts (Sessão 15) — timing de 4s/2.6s | ⬜ pendente | implementado e verificado em build de prod real; falta o CD jogar e sentir o ritmo |

## Veredito do Creative Director

| Item | Status | Notas |
|---|---|---|
| PROPOSAL-0002 + ajustes §9 | ✅ aprovada (2026-07-05) | specs SPEC-0006..0009 derivadas |
| T-019 / T-019b (perfis de controle) | ✅ testado manualmente | PROMPT-0027/0028/0032 |
| T-020 + T-008b (IA/perfis dos bots) | ✅ testado manualmente | PROMPT-0029/0030/0032 |
| T-021 (bandeira "rei do mapa") | ✅ testado manualmente | PROMPT-0031/0032 |
| Progressão de skill/atributo + bugfix menu (Sessão 13) | ✅ implementado, verificado por smoke real | PROMPT-0033 — pendente sensação de sessão longa |
| T-022 (VFX nomeados) | ✅ implementado, verificado por smoke real + screenshot | PROMPT-0034 — pendente veredito visual do CD |
| T-023 (HUD dev/prod + reveal-on-hit + toasts) | ✅ implementado, verificado em build dev+prod real + screenshots | PROMPT-0035 — pendente veredito de timing do CD |
| T-024 (registry de objetos + mapa v1 + loader) | ✅ implementado, verificado por smoke real (mapa curado) + screenshot | PROMPT-0036 — sem veredito pendente (estrutural, sem balance) |
| Touch em dispositivo real | ⬜ pendente | bots não cobrem |

## Comandos úteis agora

```bash
npm run test -w @aop/shared && (cd packages/server && npx vitest run) && (cd packages/bots && npx vitest run)  # 20/20 + 25/25 + 24/24
npm run dev:server && npm run dev:client
npm run bots -- 10 0                                  # 10 bots para sempre, MESMA sala, dosagem no log
BOT_BOSS=1 BOT_VERBOSE=1 npm run bots -- 4 20         # bot-0 vira boss (nível 6-8)
BOT_MAP_ID=arena-teste BOT_VERBOSE=1 npm run bots -- 3 0  # sala nasce com o mapa curado de exemplo (T-024)
```

## Leituras se a sessão nova for só conversa

- Plano-mãe → `docs/proposals/PROPOSAL-0002-v1-lancamento.md` (§9 = ajustes finais do CD)
- Specs executáveis → `specs/SPEC-0006-sensacao-e-leitura.md` (F1+F2, completa) + `SPEC-0007-mapas-e-objetos.md` (F3, T-024 entregue/T-025 em aberto) + `SPEC-0008..0009`
- Mapas: registry `packages/shared/src/objects.ts` + formato `packages/shared/src/mapFile.ts` + loader `packages/server/src/mapLoader.ts` + exemplo `maps/arena-teste.map.json`
- VFX: registry em `packages/client/src/vfx.ts` + backlog vivo `docs/mechanics/vfx-juice-backlog.md` (todos os itens iniciais ✔ entregues)
- Teoria + implementação dos bots → `docs/ai/bot-architecture.md` + `docs/ai/bots.md`
- Feedback do CD → `docs/CREATIVE_DIRECTOR_NOTES.md` + `docs/prompts/PROMPT-0032.md` a `PROMPT-0036.md`
- Tasks → seção V1 do `docs/BACKLOG.md` (T-019..T-024 ✅, T-025..T-032 pendentes)
