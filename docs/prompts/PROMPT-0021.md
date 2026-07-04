# PROMPT-0021 — T-015: ATTR_DEFS — tabela de atributos + Cadência e Alcance · 2026-07-04

## Pedido (resumo fiel do CD)
Continuação da execução da SPEC-0004 (leva iniciada no PROMPT-0020). Esta leva: T-015.

## Decisões tomadas (e por quem)
- CD (via SPEC-0004): 5 atributos com escala assimétrica e tetos próprios.
- IA: `ATTR_POINT_VALUE` (4% único) **substituído** pela tabela `ATTR_DEFS` em `shared/constants.ts` — cada atributo com `perPoint`, `min` e `max`. Helper `attrMult(key, points)` centraliza o clamp. Atributo novo = 1 linha na tabela.
- IA: `velocidade` **renomeada para `agilidade`** em todo o pipeline de pontos (EffectSystem, ArenaRoom, scaffold ADR-012). Sem migração de dados: o memDB do scaffold é volátil (memória).
- IA: `Player` ganhou 2 campos sincronizados: `attackSpeed` (multiplicador de cooldown, cadência) e `reach` (multiplicador de range, alcance). Cliente só exibe (F3 + linha de atributos do HUD).
- IA: `ProjectileSystem` — cooldown efetivo = `cooldownMs × attackSpeed`; range efetivo **congelado no disparo** (`proj.maxRange = range × reach`) para reroll/morte no meio do voo não alterarem projéteis já lançados.
- IA: preset equilibrado (level-up automático e `resetAttrToLevel`) continua distribuindo só nos 3 atributos-base (`BASE_ATTRS`) — cadência/alcance entram por escolha (T-016), reroll ou box. Mantém 3 pts/nível como hoje.
- IA: `rerollAttrPoints` redistribui entre os 5; reescrito com piso+resto porque o `Math.round` por fatia podia estourar o total e gerar fatia negativa (bug latente encontrado ao escrever o teste de soma).
- IA: `EffectSystem.attrPointsFor()` exposto para testes/F3 — proibido usar em lógica de jogo no Room.

## Resultado verificado
- Testes novos em `packages/server/src/systems/effects.test.ts`: valores por ponto, pisos/tetos, **guarda da spec** (full-Força n8 mata equilibrado n8 em 3 tiros; equilibrado vs equilibrado segue 5), recompute dos 5 atributos, soma preservada no reroll (20 iterações), reset na morte zera cadência/alcance, cadência muda o intervalo real de tiro no servidor (479ms não dispara, 480ms dispara), alcance estende a vida do projétil (18–22 ticks vs ~14).
- ⚠️ Execução dos gates pendente de runtime Node no sandbox (mesma limitação do PROMPT-0020) — verificação estática linha a linha feita; imports conferidos (`attrMult`/`AttrKey` exportados no barrel? ver Pendências).

## Regras que nascem daqui
- Range/atributos de projétil são **congelados no momento do disparo** — mudança de build nunca afeta projéteis em voo (evita casos retroativos indetectáveis).
- Todo atributo novo nasce na tabela `ATTR_DEFS` com piso e teto explícitos — sem teto, sem merge (anti-snowball é contrato, ADR-013).

## Pendências para o próximo prompt
- ~~Conferir barrel do shared~~ — verificado: `index.ts` faz `export * from "./constants"`, tudo exportado.
- Rodar gates quando houver runtime.
