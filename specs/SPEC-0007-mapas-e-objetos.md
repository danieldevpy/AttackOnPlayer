# SPEC-0007 — V1/F3: Mapas como conteúdo — formato, registry de objetos e CLI

**Status:** aprovada · **Marco:** V1 (F3) · **Data:** 2026-07-05
**Origem:** PROPOSAL-0002 (§3 P3 + §9 A3)

## Problema / objetivo
O mapa hoje é 100% derivado do seed em runtime: não dá para salvar o mapa atual, reajustar depois, nem cada room escolher seu mapa. Objetivo: mapa vira **dado versionado** que referencia **objetos registrados**, com CLI para o fluxo gerar → salvar → reajustar → jogar (IA ajuda a curar em sessão com o CD; nunca geração automática em produção).

## Comportamento esperado
- **Registry de objetos** (`shared/objects.ts`): `ObjectDef` por id (pedra/árvore/caixa/muro/bandeira hoje — footprint, colisão, visual F1/F2). Duas origens com a mesma interface: **código** (agora) e **salvos no sistema** (Django, SPEC-0008 — pós F4).
- **Formato de mapa v1** (`maps/<id>.map.json`): versão do schema, nome, autor, dimensões, instâncias `{objectId, x, z, rot?, scale?}`, zonas, spawns, posição da bandeira, seed de origem. Validação de schema no `shared` + flood-fill de sanidade (0 regiões fechadas) no load.
- **Room escolhe mapa:** option `mapId`; fallback = gerado por seed (comportamento atual). Cliente recebe o JSON no join (mapas pequenos).
- **CLI** `npm run map -- gen|save|save-current|update|list|preview`: gera por seed, **serializa o mapa da sala em execução** (`save-current`, via endpoint debug ou regeneração pelo seed), atualiza preservando id/autor, valida, e **preview ASCII** no terminal.

## Fora de escopo
Editor visual para players (pós-V1), objetos criados por players, temas/reskin (o formato semântico já prepara).

## Critérios de aceite
- [ ] Mapa gerado numa partida real salvo com `save-current` e rejogável por `mapId`.
- [ ] Editar o JSON (mover/adicionar objetos) e jogar a versão ajustada sem tocar em código.
- [ ] 2 mapas curados distintos no repositório, jogáveis por bots sem regressão.
- [ ] Mapa inválido (região fechada, objeto desconhecido, spawn fora) rejeitado com erro claro.
- [ ] `preview` ASCII legível o suficiente para revisar um mapa sem abrir o jogo.

## Decisão do Creative Director
Aprovada via PROPOSAL-0002 §9-A3 (2026-07-05): salvar/reajustar em vez de gerar automático; objetos por registry (código agora, sistema depois).

## Notas da IA
- O cliente hoje reconstrói o mapa pelo seed; com `mapId` o JSON viaja no join — manter os DOIS caminhos (seed para gerados, JSON para curados) para não quebrar bots/testes.
- Bandeira (SPEC-0006) lê a posição do mapa — ordem: T-021 usa centro por default até T-024 entregar o campo.

## Quebra em tasks
T-024 (registry + formato + loader) · T-025 (CLI completa, inclui `save-current`) — detalhes no BACKLOG.
