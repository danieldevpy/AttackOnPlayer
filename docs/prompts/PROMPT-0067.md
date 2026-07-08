# PROMPT-0067 — T-066: Battle Royale server-side completo (SPEC-0016)

**Data:** 2026-07-08 · **Sessão:** 50 · **Task:** T-066 (segunda task da frente SPEC-0016)

## Pedido

"implemente ## T-066 — Battle Royale server-side completo de forma bem detalhada e completa,
já entendendo a ideia geral dessa spec, quero conseguir testar ao rodar o projeto" — via skill
`attackonplayer-executor` (agente worker, escopo rigoroso da task).

## Escopo da T-066

`packages/server/src/systems/events/battleRoyale.ts` implementando `EventDefinition` +
registro no `EVENT_REGISTRY` (a partir daqui o Event Director da T-065 tem um evento REAL pra
disparar — automático por chance/intensidade ou manual via `dev_event` com `DEBUG=1`):

- **Elegibilidade:** `BR_MIN_PLAYERS=4` vivos (bots contam) + `BR_COOLDOWN_MS=120s` próprio
  (o global de 30s é do Director) + `enabled` (painel Django, T-071).
- **Warning (5s):** centro = janela 9×9 de maior densidade de players vivos (varredura em
  grade via imagem integral, empate = primeira), snap `nearestReachableCell`; `radiusStart`
  envolve o cluster com folga de 2 tiles, clamp `BR_ZONE_RADIUS_MIN/MAX`; morte no warning →
  `respawnPolicy="inside_zone"` (core da T-065).
- **Active (10s, dial):** raio interpola linear até 0; fora da zona
  `dps = 10 × (1 + 0.5 × t)` direto em `p.hp` (dano verdadeiro: ignora safe zone,
  `damageTakenMult` e `spawnProtectedUntil`; não passa pelo ProjectileSystem — o bloco
  `hp <= 0` do `updateInner` processa a morte sem killer); morte no active →
  `"hold_until_end"` (morte processada 1×, `waitingRespawn=true`, fora do jogo).
- **Early-end:** vivos ≤ 1 ⇒ `ending` com `reason:"last_survivor"`.
- **Ending (1.5s):** resolvido NA ENTRADA da fase (hook novo `onEndingStart`, ver decisões):
  sobrevivente único = full-heal no lugar + `BR_SURVIVOR_XP_BONUS`/`BR_SURVIVOR_COINS_BONUS`;
  timeout com >1 vivo = full-heal + `BR_TIMEOUT_XP_BONUS` cada; 0 vivos = ninguém; todos os
  `waitingRespawn` renascem JUNTOS no mesmo tick (respawn default + protection); broadcast
  `event_result {survivorNames[], reason}` (T-067 consome); telemetria/debug
  `event_warning`/`event_start`/`event_zone_death`/`event_end {reason, survivors, holdCount}`.

## Decisões de implementação (a spec/backlog não fixavam)

1. **Hook novo `onEndingStart(room, reason, now)` no `EventDefinition`** (chamado 1× pelo
   Director na transição active→ending). Sem ele não havia gancho pro "resultado" — `onEnd`
   só dispara ao voltar pra idle, 1.5s depois, e o CD pediu "respawn imediato de quem espera"
   no early-end. Aditivo e genérico (qualquer evento futuro usa).
2. **`EventRoom` cresceu** (contrato estrutural da T-065): `map`, `reachable`,
   `telemetryBase()`, `broadcast()`, `grantXp()`, `releaseHeldRespawns()`. Todos genéricos
   (qualquer evento espacial/hold precisa); `ArenaRoom` só mudou visibilidade
   (`map`/`reachable`/`telemetryBase`/`grantXp` viraram públicos, precedente da T-065) e
   ganhou `releaseHeldRespawns` (liberação em massa reusa `respawnPlayer`/`pickRespawnPoint`).
3. **Estado runtime por sala em `WeakMap<EventRoom, …>`** dentro de `battleRoyale.ts` — a
   definição no registry é singleton compartilhado entre salas; estado mutável no objeto do
   evento colidiria com 2 salas rodando BR ao mesmo tempo.
4. **Player segurado fica de fato fora do jogo:** `handleDeath` zera input/`firing` no hold,
   o handler de `input` ignora mensagens com `waitingRespawn` (bots continuam mandando), e o
   passe de coleta ganhou guard `hp <= 0` (no fluxo normal o respawn no mesmo tick devolve
   `hp=maxHp` antes da coleta, então nada muda fora de evento). Projéteis já pulavam
   `hp <= 0` (confirmado + teste novo). XP passivo já excluía. Percepção de bots é T-070
   (o estado `waitingRespawn` sincronizado já permite filtrar).
5. **Morte que causa o early-end renasce direto:** o Director roda ANTES do pipeline de morte
   no tick; a morte que deixa 1 vivo dispara o ending (liberando os já segurados) e é
   processada em seguida já na fase "ending" → policy `"default"`, respawn imediato. Coerente
   com o pedido do CD (fim antecipado + respawn imediato); coberto por teste.
6. **Raio inicial:** "envolve o cluster com folga" = max distância ao centro entre os players
   que a zona consegue abraçar (dist ≤ `BR_ZONE_RADIUS_MAX`) + folga 2 tiles, clamp
   [MIN, MAX] — quem está longe demais fica de fora de propósito (a zona é do cluster).
7. **Telemetria:** 4 tipos novos no union `TelemetryEvent`
   (`packages/server/src/telemetry/events.ts`) — server-only, sem tocar shared/schema.

## Resultado verificado

- `tsc --noEmit` ×3 (server/client/bots) limpo.
- Testes: shared 49/49 · server **128/128** (112 preexistentes + 16 novos em
  `battleRoyale.test.ts` e ajuste só no fake `makeRoom` do `director.test.ts`, exigido pelo
  contrato `EventRoom` maior) · bots 35/35.
- Smoke em porta isolada (:2599, `DEBUG=1`): 6 bots/75s — BR disparou NATURALMENTE (chance do
  Director), 4 bots mortos pela zona seguraram respawn e renasceram juntos, zero erro no tick.
- Smoke dirigido: 5 bots + observer mandando `dev_event battle_royale` — ciclo completo
  observado pelo estado sincronizado (`idle→warning→active→ending→idle`), zona
  `(5.5, 8.5) r=7.9` encolhendo, `event_result {survivorNames:["bot-4"],
  reason:"last_survivor"}`, `/debug/rooms` mostrando `event.phase`/`phaseEndsAt`.
- Com <4 players, `dev_event` recusa com `not_eligible` (teste + log do servidor explica).

## Como testar ao rodar o projeto

```bash
npm run dev:server                     # ou DEBUG=1 npm run dev:server p/ dev_event
npm run dev:client                     # abrir 1+ abas
npm run bots -- 4 600                  # completar ≥4 vivos — o Director dispara sozinho
# forçar: no console do cliente (DEBUG=1 no server): room.send("dev_event", "battle_royale")
# observar: http://localhost:2567/debug/rooms (bloco event + feed event_*)
```

UI do cliente (banner/zona/overlay) é T-067/T-068/T-069 — por ora o cliente só recebe o
estado; o ciclo é visível via bots/debug/console.

## Próximos passos

T-067 (∥, UI genérica de fases) já podia rodar em paralelo; T-068/T-069/T-070/T-071 liberadas
agora que a T-066 existe (4 frentes disjuntas em paralelo). Depois T-072/T-073 (QA).

## Addendum (mesmo dia) — primeira ativação determinística aos 60s

CD testou e "não conseguiu iniciar o evento" — diagnóstico: o evento DISPAROU (os avisos
`onMessage() not registered for type 'event_result'` no console do cliente e dos bots são o
broadcast de fim do BR chegando), mas sem UI (T-067..T-069) não há nada visível, e o gatilho
probabilístico é imprevisível pra teste. Pedido: "faça com que ele se inicie após 1 minuto do
servidor rodando".

Implementado no `EventDirector` (genérico, não específico do BR):

- Dial novo `DIRECTOR_FIRST_EVENT_AFTER_MS = 60_000` em `packages/shared/src/constants.ts`.
- Enquanto a sala NUNCA rodou evento (`globalLastEndedAt === -Infinity`): warm-up — nenhum
  disparo automático, nem com dado favorável; primeiro eval elegível após 60s de sala dispara
  GARANTIDO (sem dado). Depois do 1º evento, ritmo probabilístico normal.
- `dev_event` (DEBUG=1) ignora o warm-up (gatilho manual continua imediato).
- Elegibilidade continua valendo: com <4 vivos aos 60s, espera ficar elegível.
- Sentinela `firstTickAt = -1` (não 0) — o teste com `now=0` pegou o bug de o 0 ser re-setado
  (mesma classe do `globalLastEndedAt` da T-065).

Verificação: server 129/129 (1 teste novo + avaliação periódica adaptada pra não depender do
dado), `tsc` ×3, shared 49, bots 35; smoke com 5 bots SEM dev_event: telemetria mostra
`match_start` → `event_warning` em **60.2s** exatos, ciclo completo sem erro.

Os avisos no console do cliente (`event_result`/`upgrade_offer_closed` sem handler) somem
quando a T-067 registrar os handlers; o 401 do lobby é settings/auth do Django, sem relação.
