# PROMPT-0001 — Fundação do estúdio e M0 · 2026-07-04

## Pedido (resumo fiel do CD)
Recomeçar o projeto com orquestração completa: jogo arena 3D top-down estilo Bomberman, multiplayer web leve com controle de ping, modo debug com bots, framework de desenvolvimento agêntico (papéis, docs vivos, decisões registradas), agente de tendências, métricas por jogador e coletivas.

## Decisões tomadas
- CD: stack Three.js + Node/Colyseus, framework + protótipo na mesma sessão, projeto em pasta própria.
- IA (registradas em ADR-001..006): monorepo TS, servidor autoritativo desde M0, processo leve in-repo no lugar de spec-kit/dotcontext, aura = oportunidade, drops longe de jogadores.

## Resultado verificado
3 bots headless jogaram 12s: movimento, coleta, níveis e métricas JSONL funcionando. Cliente compila (145KB gzip). Commit `06f80f8`.

## Regras que nascem daqui
Todas em AGENTS.md (princípios 1–7). Processo: spec → decisão CD → placeholder → teste com bots → devlog.

## Pendências para o próximo prompt
Regra de perda de nível (proteção iniciante?), anti-snowball, combate (SPEC-0002 futura).
