# Visão atual — resumo para recomeço (pós-backlog)

Snapshot da sessão de ideias de 2026-07-04 (PROMPT-0003). Leia isto quando terminar o backlog para retomar a visão de onde ela parou.

## O jogo, em uma frase
Arena web 3D top-down de partidas de 2–3 min num **campo aberto com zonas de risco**, onde você **lança objetos** para acertar outros jogadores, **cresce por XP em múltiplos atributos** dentro do round — e pode perder tudo ao morrer.

## Estado do código (fim da sessão 2)
Funciona e está verificado: servidor autoritativo 20Hz, mapa dinâmico ≥75×65 por seed, movimento com colisão, coletáveis (xp e speed boost), EffectSystem, câmera follow + fog, sinalização de inimigos + roster, bots com BFS, métricas por sessão, ping no HUD. **Não existe ainda:** disparo/combate, morte, XP real (nível ainda é +1 por coleta), zonas, props, touch.

## Direção definida (a executar via docs/BACKLOG.md, T-001..T-009)
Campo aberto com props e zonas safe/guerra → pré-modelos F2 → XP/atributos (força/velocidade/vitalidade) → coletáveis ricos (xp_orb, farm_event, coin_buff, box) → lançadores data-driven (tiro reto primeiro) → morte/perda de nível → debug F3 → bots de combate → balance.

## Ideias registradas mas NÃO decididas
- Box estilo "reset de MU" → exige decisão sobre progresso permanente (growth.md).
- Papel dos coins (growth.md).
- Regra de perda de nível na morte (LEAD_DESIGNER_NOTES).
- Aura (ADR-005) espera combate existir (M2).
- Guardian NPC e matchmaking inteligente (M3) · Observabilidade completa (M4) · VPS (M5).

## Processo em vigor
1 prompt = 1 task do backlog. IA lê só o contexto da task. Tudo registrado em docs/prompts/. Reidratação de sessão nova: ver instrucoes/COMO_CONTINUAR.md.
