# Bots

## Bots de debug (M0 — feito)
- Headless, conectam via colyseus.js como jogadores reais (mesmo protocolo, zero código especial no servidor).
- Comportamento: caça o coletável mais próximo; sem alvo, vagueia evitando paredes.
- Uso: `npm run bots -- <qtd> <segundos>`. Servem para testar sync, colisão, spawner e métricas.
- M1: bots atiram/esquivam com níveis de habilidade parametrizados (para testar TTK e balanceamento).

## Guardian (M3)
Um único NPC de elite (não vários genéricos):
- Entra quando falta jogador; sai quando sala enche.
- Alvo: melhor que ~90% dos players → treino, desafio, coop, evento.
- Economia de tokens/CPU: decide sobre **observações compactas** (posições, cooldowns, itens próximos), responde ações discretas (mover/atacar/desviar/coletar). O jogo executa; o cérebro só decide.
- Implementação inicial: máquina de estados + utility AI (sem LLM). LLM só se comportamento emergente valer o custo.
