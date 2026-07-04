# PROMPT-0007 — T-004: coletáveis expandidos + spawn por zona · 2026-07-04

## Pedido (resumo fiel do CD)
Continuação da sequência (mesmo prompt do PROMPT-0005/0006).

## Decisões tomadas
- IA: `xp_orb` substitui `level_up` (mesmo efeito, nome novo). `coin_buff` dá coins fixos; `farm_event` reusa o EffectSystem com um `EffectKind` novo (`xp_boost`, dobra o multiplicador de XP por 20s) em vez de virar um subsistema à parte; `box` dá bônus de atributo 3× maior que um level-up normal (persistência real fica para T-004b).
- Raridade de `farm_event`/`box` não precisou de nenhuma lógica nova: a zona de guerra já é pequena perto da área total do mapa (ADR-010), então amostragem uniforme + pool de pesos por zona já entrega a raridade certa de graça.
- Zona safe ganhou supressão de spawn (`SAFE_ZONE_SPAWN_CHANCE=0.3`) — não é só "kinds diferentes", é também "nasce menos" ali, como o world.md pedia.
- Coins compram reroll: `EffectSystem.rerollAttrPoints` redistribui o total de pontos já ganhos entre os 3 atributos (stick-breaking aleatório), sem precisar guardar histórico de "qual foi o último nível".
- Métricas passam a registrar pickups por kind (`pickupsByKind`), não só um contador binário de speed_up — era acceptance explícito da task.

## Resultado verificado
- `npm run test`: 5/5 (2 novos testes de `pickWeighted`).
- `tsc --noEmit` limpo em server e client.
- Bots (4 bots, 20s): `sessions.jsonl` mostra os 4 kinds de campo/guerra aparecendo naturalmente nas coletas — inclusive um `farm_event` (zona de guerra) pego por um bot. `box` não apareceu nesta rodada (é intencionalmente muito raro dentro do pool de guerra, 15%), consistente com o design.
- Aprendizado de sandbox: dois processos `tsx watch` concorrentes (um manual antigo + um do preview) brigaram pela porta 2567 e entraram em loop de crash (`EADDRINUSE`). Resolvido matando ambos e deixando só o gerenciado pelo preview — registrar como hábito: sempre conferir `pgrep -af "src/index.ts"` antes de reclamar de erro de conexão.

## Regras que nascem daqui
- Kind de coletável novo = 1 entrada no pool de pesos da zona certa (`constants.ts`) + 1 caso no `switch` de coleta do Room + 1 visual em `visuals.ts` — nunca lógica de spawn hardcoded fora desse pool.
- Efeito temporário novo (tipo farm_event) sempre entra como `EffectKind` no EffectSystem — reafirma a regra já registrada em T-003.
- Métricas de coletável sempre por kind (`pickupsByKind`), nunca contador binário solto.

## Pendências para o próximo prompt
T-004b (scaffold de progressão persistente, ADR-012) — já tem tudo decidido, só falta implementar o playerToken + PersistentProgress.
