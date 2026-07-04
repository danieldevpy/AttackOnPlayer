# Bots

## Bots de debug (M0 — feito)
- Headless, conectam via colyseus.js como jogadores reais (mesmo protocolo, zero código especial no servidor).
- Comportamento: caça o coletável mais próximo; sem alvo, vagueia evitando paredes.
- Uso: `npm run bots -- <qtd> <segundos>`. Servem para testar sync, colisão, spawner e métricas.

## Bots de combate (M1 — T-008, mínimo do aceite)
Mesma base headless; ganham camada de combate sobre a caça a coletáveis:
- **Skill parametrizável** `fraco | medio | forte` (env `BOT_SKILL`; se ausente, sorteada por bot). A skill controla: erro de mira (spread em rad), alcance de engajamento, limiar de fuga (fração de HP) e agressividade.
- **Mirar e atirar (T-013 — protocolo `{x, z, aimX?, aimZ?, fire?}`):** escolhem o inimigo lutável mais próximo dentro do raio de engajamento e miram nele continuamente (`aimX/aimZ`, com chumbo/lead e erro proporcional à skill) mesmo fora do alcance do launcher — só o gatilho (`fire: true`) liga quando de fato dentro de `LAUNCHERS[launcher].projectile.range`, respeitando o cooldown (controlado pelo servidor). A direção real do tiro sai do facing (`dir`) que o servidor resolve a partir dessa mira — o bot não manda mais direção de tiro direto. Não atiram de dentro de zona safe nem contra alvo em safe (o servidor bloquearia — evita desperdício).
- **Fugir:** com HP abaixo do limiar, param de atirar e se afastam do inimigo mais próximo; evitam permanecer em zona de guerra (`zoneAt`) quando feridos.
- **Default:** sem inimigo no alcance, mantêm o comportamento de coleta por BFS (M0).
- Fonte única de números de combate: `packages/shared/src/launchers.ts`. Zona: `zoneAt` de `packages/shared/src/map.ts`.

**Gancho para T-008b:** a estrutura de skill é o ponto de extensão para personalidade/atributos sorteados e para o modo "boss" (skill alta + HP/atributos elevados). Proibido lógica de combate hardcoded fora dessa camada.

## Guardian (M3)
Um único NPC de elite (não vários genéricos):
- Entra quando falta jogador; sai quando sala enche.
- Alvo: melhor que ~90% dos players → treino, desafio, coop, evento.
- Economia de tokens/CPU: decide sobre **observações compactas** (posições, cooldowns, itens próximos), responde ações discretas (mover/atacar/desviar/coletar). O jogo executa; o cérebro só decide.
- Implementação inicial: máquina de estados + utility AI (sem LLM). LLM só se comportamento emergente valer o custo.
