# Devlog

## 2026-07-04 — Sessão 3 (cont.): T-004b
- Scaffold de progressão persistente (ADR-012) implementado: `playerToken` salvo no localStorage e enviado no join.
- Servidor mapeia token num `memDB` indexado mantendo `PersistentProgress` (força, velocidade, vitalidade) que é atualizado na coleta da box.
- Verificado: tsc limpo, localStorage funciona, progresso persiste no servidor. Detalhe em PROMPT-0008.md.
- Próximo: T-005 (Lançadores v1: tiro reto).

## 2026-07-04 — Sessão 3 (cont.): T-004
- Coletáveis expandidos: xp_orb, speed_up, coin_buff (campo), farm_event/box (só zona de guerra, já raros de graça pelo tamanho da zona). Zona safe ganhou supressão de spawn própria.
- farm_event reusa EffectSystem (`xp_boost`); box dá bônus de atributo 3× maior; coins compram reroll da distribuição de atributos.
- Métricas passam a registrar pickups por kind.
- Verificado: testes 5/5, tsc limpo, 4 bots mostraram os 4 kinds de campo/guerra nas métricas (incl. 1 farm_event). Detalhe em PROMPT-0007.md.
- Aprendizado: dois `tsx watch` concorrentes brigando pela porta 2567 travaram o servidor em loop de crash — sempre `pgrep -af "src/index.ts"` antes de investigar erro de conexão.

## 2026-07-04 — Sessão 3 (cont.): T-003
- XP/nível via curva (`xpToNext`), atributos força/velocidade/vitalidade como segunda camada do EffectSystem existente (mesmo `recompute()`, preset equilibrado: 1 ponto em cada por nível, +4%/ponto).
- Primeiro teste unitário do projeto (vitest, `constants.test.ts`) — dívida registrada em LEAD_DESIGNER_NOTES começou a ser paga.
- Verificado: `npm run test` 3/3, tsc limpo, bots mostram nível subindo pela curva e atributo de velocidade refletido em `speed` independente do speed_up temporário. Detalhe em PROMPT-0006.md.
- Próximo: T-004 (coletáveis expandidos).

## 2026-07-04 — Sessão 3 (cont.): T-002
- Props ganharam pré-modelos F2 (pedra/árvore/caixa/muro/bandeira) compostos de primitivas em `visuals.ts`. Técnica: 1 InstancedMesh por parte-tipo (não por instância) — mantém draw calls baixos mesmo com composição.
- Verificado via preview (screenshot): zona safe pintada + pedra/caixa/muro distintos; bots sem regressão. Detalhe em PROMPT-0005.md.
- Próximo: T-003 (XP/nível/atributos).

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
