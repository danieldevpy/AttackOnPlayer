# Matchmaking inteligente (M3)

O matchmaking é um gerente, não um buscador de salas. A cada ciclo (ex. 2s) responde:

- Existe sala quase cheia do nível do jogador? → prioriza completá-la.
- Não existe sala do nível? → coloca com níveis abaixo (regra do CD).
- Jogador esperando > Ns sozinho? → cria sala + convoca **Guardian** (NPC).
- Duas salas esvaziando? → propõe fusão no fim do round (nunca no meio).
- Sala vazia por > Nmin? → fecha e libera recursos.

## Sinais monitorados
players online, distribuição de níveis, tempo de espera, ocupação por sala, ping médio por região.

## Filosofia
Sessão dura 2–3 min → esperar 30s é inaceitável. Melhor jogar já com bots/níveis diferentes do que esperar a sala perfeita.
