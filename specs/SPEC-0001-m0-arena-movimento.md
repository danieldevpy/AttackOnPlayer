# SPEC-0001 — M0: Arena, movimento, coletáveis, bots

**Status:** implementada · **Marco:** M0 · **Data:** 2026-07-04

## Problema / objetivo
Fundação jogável e testável por agentes: entrar numa sala, andar num campo estilo Bomberman, disputar coletáveis, com servidor autoritativo e ping visível.

## Comportamento esperado
- Arena 15×13: bordas sólidas + pilares fixos (padrão Bomberman). Spawn nos cantos.
- Movimento contínuo (não travado no grid), 8 direções, colisão com paredes resolvida no servidor (20 ticks/s).
- Coletáveis aparecem apenas em células livres a ≥ 4 tiles de qualquer jogador; máx. 5 simultâneos.
- Coletar = +1 nível (placeholder de progressão) e some; novo spawn em alguns segundos.
- HUD: ping (medido a cada 2s), nível, jogadores online.
- Bots headless conectam como jogadores reais e caçam o coletável mais próximo.
- Métricas por sessão de jogador: tempo, distância, coletas, nível inicial/final → JSONL.

## Fora de escopo
Combate, dano, morte, aura, matchmaking multi-sala, touch, arte.

## Critérios de aceite
- [x] Servidor sobe e aceita conexões.
- [x] 2+ bots se movem e coletam (validado headless).
- [x] Coletável nunca spawna a < 4 tiles de um jogador.
- [x] `logs/sessions.jsonl` recebe registro ao sair da sala.

## Decisão do Creative Director
Aprovada (escopo M0 conforme concepção).

## Notas da IA
Movimento contínuo (floats) em vez de grid-locked: mais fluido em 3D e não impede leitura tática do grid. Interpolação no cliente; predição adiada (ver LEAD_DESIGNER_NOTES).
