# PROMPT-0002 — Mapa grande, velocidade, inimigos, roster, instruções · 2026-07-04

## Pedido (resumo fiel do CD)
Feedback do teste: começa estilo Bomberman com 2 players; bot parado; obstáculo (cubo) com colisão ok. Pedidos: (1) coletável de aumento de velocidade; (2) bot categorizado como inimigo, todos players/bots com sinalização de inimigo não invasiva; (3) lista de players com design neutro no tema; (4) fases de desenvolvimento visual — objeto simples → "sprites em 3D" — com documento de como fazer; (5) mapa base ≥ 5× maior, com sensação de "ir longe", tamanho podendo depender de players online, suavizado; (6) arquitetura pronta para skills, tudo claro; (7) pasta de instruções + continuar na mesma sessão + arquivos vivos + cada prompt vira documento e regra.

## Decisões tomadas
- CD: tudo acima.
- IA: mapa mínimo 75×65 decidido na criação da sala, NUNCA redimensiona mid-round (ADR-007); coletáveis escalam com a área para o mapa não virar deserto; sinalização = anel no chão (vermelho inimigos / azul você) + roster; efeitos com teto de 2× velocidade (anti-snowball); fases visuais centralizadas em `visuals.ts` (ADR-008); skills via EffectSystem servidor-autoritativo (ADR-009).
- Nota sobre "bot parado": os bots NÃO nascem sozinhos — precisam de `npm run bots -- 3 0` num terminal (0 = ficam para sempre). Bot automático na sala é o Guardian (M3).

## Resultado verificado
3 bots com BFS no mapa 75×65 (seed reconstruído idêntico): 3.7 coletas/bot em 15s, speed_up aplicando ×1.5 e expirando, distância média 71u. Cliente compila. Extra: bots ganharam pathfinding BFS — sem isso, 0 coletas no mapa grande (corredores + sem navegação = bots inúteis como testers).

## Regras que nascem daqui
- Todo prompt de desenvolvimento gera `docs/prompts/PROMPT-NNNN.md` (regra bilateral, ver instrucoes/REGRAS_DE_PROMPT.md).
- Evolução visual segue as 4 fases de instrucoes/FASES_VISUAIS.md; troca de fase só em `visuals.ts`.
- Mapa muda de tamanho apenas entre rounds.
- Novo atributo/skill = novo `EffectKind` no EffectSystem — nunca lógica solta no Room.

## Pendências para o próximo prompt
Combate (SPEC-0003?), regra de perda de nível, bot que persegue jogador (comportamento de inimigo de fato), joystick touch.
