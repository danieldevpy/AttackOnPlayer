# SPEC-0002 — M0.5: Mapa grande, atributo de velocidade, inimigos e roster

**Status:** implementada · **Marco:** M0.5 · **Data:** 2026-07-04

## Problema / objetivo
Sair da "caixa de sapato": mapa que dá sensação de distância, primeiro atributo real (velocidade), leitura clara de quem é inimigo e quem está na sessão. Preparar arquitetura de skills.

## Comportamento esperado
- **Mapa dinâmico:** mínimo 5× o base (15×13 → 75×65), cresce com jogadores esperados, gerado por seed na criação da sala e sincronizado (cliente reconstrói o mesmo mapa). Obstáculos extras aleatórios sem quebrar conectividade. Nunca redimensiona no meio do round.
- **Sensação de "ir longe":** câmera segue o jogador suavemente; fog esconde a distância; grid no chão dá referência de movimento.
- **Coletável de velocidade** (`speed_up`, ciano): +50% de velocidade por 8s; pegar de novo renova a duração; teto de 2× (anti-snowball). O de nível (`level_up`, dourado) continua.
- **Sinalização de inimigo (não invasiva):** anel vermelho discreto sob todos os outros players/bots; anel azul sob você. Todos são inimigos por enquanto (FFA).
- **Lista de players:** painel neutro no canto (nome, nível, tag BOT, ⚡ quando com boost), design placeholder que respeita o tema escuro.
- **Arquitetura de skills:** atributos derivados = base × efeitos ativos, calculados no servidor (`EffectSystem`); lista de efeitos sincronizada para o HUD. Nova skill = novo `EffectKind`.

## Fora de escopo
Combate, aura, redimensionar mapa mid-round, pathfinding de bot, sprites 3D (documentado, não implementado).

## Critérios de aceite
- [ ] Bots coletam `speed_up` e a velocidade muda de fato (distância percorrida maior).
- [ ] Cliente e servidor geram mapa idêntico a partir do seed.
- [ ] Roster lista todos, marcando você vs inimigos.
- [ ] Efeito expira após 8s (speed volta a 1).

## Decisão do Creative Director
Aprovada (prompt de 2026-07-04, ver docs/prompts/PROMPT-0002.md).

## Notas da IA
Mapa 25× a área com 2 players arrisca sensação de deserto — mitigado escalando o número de coletáveis com a área (~1 a cada 160 tiles). Obstáculos aleatórios só em cruzamentos (coordenadas ímpares) e nunca adjacentes: preserva conectividade sem pathfinding/floodfill.
