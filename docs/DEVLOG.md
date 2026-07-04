# Devlog

## 2026-07-04 — Sessão 3: T-001 (backlog)
- Pivô ADR-010 executado: labirinto (pilares em coord. pares) → campo aberto. Só borda colide; props (~4%, pedra/árvore/caixa/muro) nascem isolados uns dos outros — garante 0 regiões fechadas sem precisar de checagem de conectividade em runtime.
- Zonas safe/guerra/campo derivam do seed (`zoneAt`), cliente pinta o chão sem tráfego extra na rede.
- Verificado: 4 seeds sem tile fechado (flood fill 100%), 0 props perto de spawn, densidade exata; bots BFS seguem coletando (níveis 2→5 em 15s); tsc limpo. Detalhe em `docs/prompts/PROMPT-0004.md`.
- Próximo: T-002 (pré-modelos visuais dos props).

## 2026-07-04 — Sessão 2: M0.5 (SPEC-0002)
- Mapa dinâmico 75×65 mín. (ADR-007), gerado por seed sincronizado; câmera follow + fog + grid ("indo longe").
- EffectSystem (ADR-009): coletável speed_up ×1.5/8s com teto 2×; arquitetura pronta p/ skills.
- Sinalização de inimigos (anéis) + roster HUD; visuals.ts com fases (ADR-008); pasta instrucoes/; log de prompts (docs/prompts/).
- Bots ganharam BFS — no mapa grande, sem pathfinding = 0 coletas; com BFS = 3.7 coletas/bot em 15s. ✅ verificado headless.
- Aprendizado sandbox: processos de fundo persistem entre execuções (porta 2567 fantasma) — usar PORT alternativa p/ testes.

## 2026-07-04 — Sessão 1: fundação
- Framework do estúdio criado (AGENTS.md, constituição, ADRs 001–006, roadmap, specs, notas CD/IA).
- Monorepo TS: `shared` (mapa, constantes, protocolo), `server` (Colyseus, tick 20Hz, autoritativo), `client` (Three.js top-down, HUD ping/nível), `bots` (headless).
- M0: arena 15×13 com pilares estilo Bomberman, movimento com colisão no servidor, coletáveis spawnam longe de jogadores (ADR-006), coleta sobe nível, métricas de sessão em `packages/server/logs/sessions.jsonl`.
- Verificação ✅: 3 bots headless em 1 sala por 12s — movimento ok (~26u de distância média), coletas ok (bot-1 chegou ao nível 4), `sessions.jsonl` gravado, `/metrics/summary` agregando. Cliente compila em 145KB gzip.

**Aberto:** combate (M1), regra final de perda de nível, controle touch.
