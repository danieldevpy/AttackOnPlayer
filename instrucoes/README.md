# Instruções — AttackOnPlayer

Pasta de referência do Creative Director. Comece por aqui em qualquer sessão.

| Arquivo | Para quê |
|---|---|
| `COMO_CONTINUAR.md` | Como retomar o desenvolvimento (mesma sessão ou nova) sem perder contexto |
| `FASES_VISUAIS.md` | As 4 fases de evolução visual (objeto simples → sprite 3D → low-poly) e como implementar cada uma |
| `REGRAS_DE_PROMPT.md` | Como pedir features para a IA + regra do log de prompts (vale para os dois lados) |

## Mapa do projeto (onde está cada coisa)

```
AGENTS.md                  regras de trabalho dos agentes (a IA SEMPRE lê primeiro)
docs/GAME_CONSTITUTION.md  visão e pilares — muda raramente
docs/ROADMAP.md            o que vem agora / depois
docs/DECISION_LOG.md       toda decisão de arquitetura (ADRs)
docs/DEVLOG.md             diário: o que aconteceu em cada sessão
docs/prompts/              resultado de CADA prompt seu, vira regra
docs/mechanics|multiplayer|ai|observability/  regras vivas de cada sistema
specs/                     especificação de cada leva de features
packages/shared            constantes, mapa, colisão — fonte única servidor+cliente
packages/server            simulação autoritativa, efeitos, spawner, métricas
packages/client            Three.js, câmera, HUD, visuais (fases em src/visuals.ts)
packages/bots              bots headless de teste
```
