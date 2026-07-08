# PROMPT-0066 — T-065: núcleo do Event Director (SPEC-0016)

**Data:** 2026-07-08 · **Sessão:** 49 · **Task:** T-065 (primeira task de SPEC-0016)

## Pedido

Executar a primeira task de `specs/SPEC-0016-eventos-e-modos-de-jogo.md` (Event Director +
Battle Royane) — a T-065 do `docs/BACKLOG.md`, que bloqueia toda a frente (T-066..T-073).

## Escopo da T-065

Criar a camada de eventos de sessão **sem nenhum evento registrado** — a sala precisa se
comportar exatamente como hoje. Concretamente:

1. `packages/server/src/systems/events/{types,director,registry}.ts` — contratos
   (`EventDefinition`, `EligibilityContext`, `EventRoom`, `RespawnPolicy`, `EventPhase`) e o
   `EventDirector` (máquina `idle→warning→active→ending→idle`, avaliação periódica
   `DIRECTOR_EVAL_MS`, chance modulada por intensidade, cooldown global, `EVENT_REGISTRY` vazio).
2. Schema: `ArenaState.event: ActiveEvent {id, phase, phaseEndsAt, zoneX, zoneZ, zoneRadius}` +
   `Player.waitingRespawn: boolean` (⚠schema — cliente/bots recompilam junto, mas ninguém lê
   estes campos ainda nesta task).
3. Refactor cirúrgico do pipeline de morte em `ArenaRoom.updateInner`: extraído
   `handleDeath`/`respawnPlayer`/`pickZoneSpawnPoint`; antes do respawn, consulta
   `director.respawnPolicyFor(id)` — sem evento ativo, sempre `"default"` (comportamento atual
   byte-a-byte idêntico).
4. Dials novos em `packages/shared/src/constants.ts` — todos os da spec (Director + Battle
   Royale, mesmo a lógica do BR sendo T-066).
5. Mensagem `dev_event` atrás de `DEBUG=1` (mesmo padrão do `dev_launcher`) — com registry
   vazio, sempre no-op.
6. `/debug/rooms` (`packages/server/src/index.ts`) ganhou o bloco `event` (id/phase/
   phaseEndsAt); o feed de debug do F3 já mostra `event_phase` automaticamente (broadcast
   genérico existente, `debug_event`) sem precisar tocar no cliente.

## Decisões de design não detalhadas na spec/backlog

- **`EventRoom` como interface estrutural, não `import` de `ArenaRoom`.** A camada de eventos
  nunca importa `rooms/ArenaRoom` (evita import circular e mantém a isolação plugável). Testei
  com `tsc --strict` que métodos `private` quebram a checagem estrutural contra uma interface
  externa — por isso `ArenaRoom.emitDebug`/`emitTelemetry` viraram públicos (único ajuste de
  visibilidade feito; nenhuma mudança de comportamento).
- **`"inside_zone"` é implementado no core (não no BR/T-066).** Como `zoneX/zoneZ/zoneRadius`
  já são campos genéricos do `ActiveEvent`, `pickZoneSpawnPoint()` (novo método privado de
  `ArenaRoom`) sorteia um ponto alcançável dentro do raio usando o `reachable`/`map` que a sala
  já mantém — nenhum conhecimento de Battle Royale. Fica implementado, mas inalcançável
  (registry vazio).
- **`"hold_until_end"` só marca `waitingRespawn=true` e para.** A liberação em massa de todos
  os `waitingRespawn` ao fim de um evento é responsabilidade do próprio evento (via `onEnd`,
  chamando de volta o `respawnPlayer` reaproveitável) — não construí esse mecanismo agora
  porque é T-066 quem sabe exatamente quando/como liberar; T-065 só garante que o pipeline não
  reprocessa a morte a cada tick enquanto o player está held (guard `!p.waitingRespawn` no
  `forEach` — bug que eu quase deixei passar: sem o guard, `handleDeath` rodaria de novo a cada
  tick pra qualquer player com `hp<=0` segurado).
- **`triggerChance(deathsPerMinute)`** (curva contínua, `[0.5×, 2×]` da chance base,
  `DIRECTOR_HOT_DEATHS_PER_MIN=6` como referência) é uma escolha de tuning minha — a spec só
  pede "chance modulada pela intensidade, ritmo de tensão/alívio, nunca timer previsível", sem
  fórmula. Documentei como dial de primeira passada no próprio `constants.ts`; ajustar com
  telemetria real é trabalho futuro (a spec já antecipa isso pro Battle Royale em si).
- **Bug corrigido antes de ele existir em produção:** `EventDirector.globalLastEndedAt`
  iniciava em `0`, o que fazia o cooldown global (`EVENT_GLOBAL_COOLDOWN_MS`) bloquear qualquer
  disparo nos primeiros 30s de vida da sala (achei isso com o próprio teste unitário de
  `forceTrigger`, que falhou até eu trocar o default pra `-Infinity`).
- **Valores numéricos dos dials do Battle Royale** (`BR_ZONE_RADIUS_MIN/MAX`,
  `BR_SURVIVOR_XP_BONUS`, etc.) não estão na spec — inventei defaults razoáveis (comentados
  inline) já que T-066 precisa dessas constantes existirem; qualquer um pode ser retunado sem
  tocar em código quando a T-066 rodar smoke real.

## Testes novos

- `packages/server/src/systems/events/director.test.ts` (8 testes): máquina de estados via
  `forceTrigger` + `tick` com `now` avançado manualmente, `earlyEndCondition`→`onEnd(reason)`,
  cooldown global, `dev_event` com id desconhecido/inelegível ignorado, avaliação periódica
  respeitando `DIRECTOR_EVAL_MS`, `respawnPolicyFor` delegando por fase. Mais um teste dedicado
  de `triggerChance` (monotonicidade/bounds).
- `packages/server/src/rooms/deathPipeline.test.ts` (3 testes): comportamento "default"
  idêntico ao bloco antigo (nível zera, launcher volta, hp cheio, spawn protection); política
  "hold_until_end" forçada via monkey-patch de `room.director.respawnPolicyFor` (sem precisar
  de evento real) — prova que held não reprocessa a morte a cada tick; política "inside_zone"
  idem, prova que o respawn cai dentro do raio configurado em `state.event`.

## Resultado verificado

- `tsc --noEmit` limpo em `server`, `client`, `bots` (×3).
- `npm run test` (shared) 49/49 · `npx vitest run` (server) 112/112 (101 preexistentes + 11
  novos, **nenhum teste existente editado**) · `npx vitest run` (bots) 35/35.
- Smoke `SERVER_URL=ws://localhost:2599 npm run bots -- 4 15` (porta isolada — havia um
  processo pm2 já ocupando a :2567, não mexi nele) rodou sem erro no tick, sala fechou normal
  ao sair o último bot.
- `dev_event` não testado via smoke ao vivo (cobrí a lógica via `director.test.ts`
  `forceTrigger`, mesmo caminho que o handler `onMessage("dev_event", ...)` chama) —
  equivalente ao que já acontecia com `dev_launcher`, que também nunca teve smoke dedicado.

## Próximos passos

T-066 (Battle Royale server-side) e T-067 (UI genérica de fase) já podem rodar em paralelo —
ambos só dependem do schema/contratos desta task.
