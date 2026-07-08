# Sessão atual — ponteiro de continuidade

> **Substituir este arquivo inteiro** ao fim de cada sessão de trabalho.
> Não é histórico — histórico fica em `DEVLOG.md` e `docs/prompts/`.

**Atualizado em:** 2026-07-08
**Branch:** `main`. **Marco:** V1.x (SPEC-0016 — Eventos e modos de jogo).

**Sessão 50 (agente worker): PROMPT-0067 — T-066: Battle Royale server-side completo**
Executada a T-066 (`docs/BACKLOG.md`): `packages/server/src/systems/events/battleRoyale.ts`
implementando `EventDefinition` completo + registro no `EVENT_REGISTRY` — **a partir desta
sessão o Event Director dispara eventos DE VERDADE** (automático por chance/intensidade com
≥4 vivos, ou manual via `room.send("dev_event", "battle_royale")` com `DEBUG=1`). Ciclo:
warning 5s (zona nasce sobre a janela 9×9 mais densa de players vivos, snap em célula
alcançável, raio envolve o cluster com folga, clamp 6–20; morte → renasce dentro da zona) →
active 10s (raio encolhe linear até 0; fora da zona dano verdadeiro `10×(1+0.5t)` que ignora
safe/escudo/protection; morte → `waitingRespawn`, fora do jogo; ≤1 vivo → early-end) →
ending 1.5s (sobrevivente full-heal NO LUGAR + bônus XP/coins; segurados renascem TODOS no
mesmo tick; broadcast `event_result`) → idle (cooldowns 120s próprio + 30s global).
Suporte genérico que a task exigiu: hook `onEndingStart` no contrato, `EventRoom` maior
(`map`/`reachable`/`telemetryBase`/`broadcast`/`grantXp`/`releaseHeldRespawns`),
`ArenaRoom.releaseHeldRespawns`, player segurado sem input/coleta. Telemetria
`event_warning/start/zone_death/end`. Gates: `tsc` ×3 limpo, shared 49/49, server 128/128
(16 testes novos), bots 35/35; smoke isolado com BR disparando naturalmente + ciclo forçado
via `dev_event` observado completo (`/debug/rooms` mostra fase/countdown). Decisões e "como
testar rodando o projeto" em `docs/prompts/PROMPT-0067.md`.

**Próximo passo:** T-067 (cliente: UI genérica de fases — pode rodar já; contratos prontos
desde a T-065, e o broadcast `event_result` que ela consome existe agora). Depois, em
paralelo (4 frentes disjuntas): T-068 (visual da zona) ∥ T-069 (espera de respawn) ∥ T-070
(bots cientes do evento) ∥ T-071 (painel Django EventModeConfig). T-072 após T-068+T-069;
T-073 (QA smoke da spec inteira) por último. Ver `specs/SPEC-0016-eventos-e-modos-de-jogo.md`.

**Follow-up do CD (mesmo dia):** primeira ativação agora é **determinística** — sala nova
não dispara nada no 1º minuto (warm-up) e o primeiro evento elegível dispara GARANTIDO aos
~60s (`DIRECTOR_FIRST_EVENT_AFTER_MS`, dial); depois o ritmo probabilístico normal assume.
`dev_event` (DEBUG=1) segue imediato; elegibilidade (≥4 vivos) continua valendo — rode
`npm run bots -- 4 600` pra completar a sala. Verificado por telemetria: 60.2s exatos.

**Nota pra quem for testar à mão:** sem UI ainda (T-067..T-069), o evento é visível pelo
estado sincronizado, pelo feed do `/debug/rooms` (DEBUG=1) e pelos logs do servidor
("morreu e aguarda o fim do evento"). Bots headless ainda não reagem à zona (T-070) — morrem
fora dela e testam o hold/release de graça.

**Pendências vindas de sessões anteriores (não mexidas nesta sessão):**
`backend/requirements.txt` com `M` no git status desde o início da sessão (mudança de outro
agente/sessão — não investiguei nem toquei); idem `run.sh`, `docs/GUIA_PERSONAGENS_PROCEDURAIS_V2.md`,
`instrucoes/GUIA_MODELOS_CLAUDE.md` e os arquivos `*.skill` não rastreados na raiz.
