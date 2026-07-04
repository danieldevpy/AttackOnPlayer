# PROMPT-0004 — T-001: pivô para campo aberto com props e zonas · 2026-07-04

## Pedido (resumo fiel do CD)
"Executar T-001 do docs/BACKLOG.md" — pivotar o gerador de mapa do labirinto estilo Bomberman (ADR anterior) para campo aberto com props esparsos e zonas safe/guerra/campo, conforme ADR-010 (docs/mechanics/world.md).

## Decisões tomadas
- IA: só a borda do mapa colide agora; os antigos "pilares" em coordenadas pares saíram. Props (~4% dos tiles, 1×1 pedra/árvore/caixa, 2×1 muro) nascem isolados — nenhum vizinho (incl. diagonais) pode já estar ocupado — o que garante corredores de respiro sem precisar de checagem de conectividade separada.
- Zonas (safe por spawn r=6, guerra central r=10, +1 guerra extra se o mapa cresceu além do mínimo 5×) derivam do mesmo seed; cliente reconstrói e pinta o chão — nada trafega na rede além de mapW/mapH/mapSeed (já existia).
- `GameMap` ganhou `props: Prop[]` e `zones: Zone[]`; nova função `zoneAt(map, x, z)` com prioridade safe > guerra > campo.
- Cliente: props viram InstancedMesh por tipo (cor placeholder — pré-modelos reais são T-002); zonas viram overlays semi-transparentes (azul/vermelho) sobre o chão.
- `PROP_DENSITY`, `SAFE_ZONE_RADIUS`, `WAR_ZONE_RADIUS` movidos para `constants.ts` (T-004 vai reusar para pesos de spawn por zona).

## Resultado verificado
- `tsc --noEmit` limpo em client e server (erro pré-existente isolado em bots/src/bot.ts, confirmado via `git stash` que já existia antes desta mudança).
- Script de validação (4 seeds, mapa 75×65): props sempre ~184 (4% exato), **0 tiles fechados** (flood fill a partir do spawn alcança 100% da área livre), **0 props a menos de 6 tiles de qualquer spawn**, 9 zonas (8 safe + 1 guerra).
- 3 bots headless por 15s: seguem coletando normalmente (níveis 2→5, speed_up ×1.5 aplicado) — BFS não regrediu com o novo grid.

## Regras que nascem daqui
- Geração de mapa vive só em `buildMap`; qualquer novo tipo de zona ou prop entra ali + em `constants.ts`, nunca hardcoded em ArenaRoom ou main.ts.
- Isolamento de props (sem vizinho ocupado) é a técnica oficial para "nenhuma região fechada" — não precisa de BFS de verificação em runtime.
- Visual de prop em `main.ts` é placeholder por cor; T-002 substitui por primitivas compostas em `visuals.ts` sem tocar geração/colisão.

## Pendências para o próximo prompt
T-002 (pré-modelos de props em visuals.ts) — depende só do que foi feito aqui.
