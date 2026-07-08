# SPEC-0016 — Eventos e modos de jogo (Event Director + Battle Royale)

**Status:** rascunho · **Marco:** V1.x · **Data:** 2026-07-07

> Origem: pedido direto do CD (sessão de ideação 2026-07-07). Visão: **o jogo nunca para** —
> o mata-mata (modo default, comportamento atual) é interrompido por eventos curtos que mudam
> as regras por segundos e devolvem a sessão ao normal sem quebrar o fluxo de ninguém.
> Primeiro evento: **Battle Royale relâmpago**. A arquitetura nasce genérica: novos
> modos/eventos são plugins, não mudanças no core.

## Problema / objetivo

O jogo hoje tem um único modo (mata-mata contínuo). Queremos uma camada de **eventos de
sessão** que: (1) crie picos de intensidade sem downtime; (2) seja plugável (novos eventos =
arquivo novo + config nova, zero mudança no core); (3) seja operável pelo painel Django
(presets, ativar/desativar, parametrizar) sem deploy; (4) não quebre nada quando desligada.

## Glossário

- **Modo default**: o mata-mata atual. Não é um "evento" — é o estado a que a sala sempre volta.
- **Evento**: mudança temporária de regras com ciclo de vida próprio (aviso → ativo → fim).
- **Event Director**: componente server-side que observa a sessão e decide *se/qual/quando*
  disparar um evento (inspiração: AI Director de Left 4 Dead).

## Arquitetura (visão — detalhes viram ADR na T-065)

Tudo **server-authoritative** (princípio 2). Novo diretório `packages/server/src/systems/events/`:

```
events/
  types.ts        # contratos: EventDefinition, EventRuntime, EligibilityContext, RespawnPolicy
  director.ts     # EventDirector: snapshot da sessão + regras de ativação + máquina de estados
  registry.ts     # EVENT_REGISTRY: { battle_royale: BattleRoyaleEvent, ... }
  battleRoyale.ts # primeira implementação concreta
```

**Máquina de estados global da sala** (uma por `ArenaRoom`, sincronizada via schema):

```
idle ──director dispara──▶ warning(8s) ──▶ active(duração do evento) ──▶ ending(~1.5s) ──▶ idle
                                                    │ condição de fim antecipado (ex.: ≤1 vivo)
                                                    ▼
                                                  ending
```

**Contrato de um evento** (interface `EventDefinition`, tudo opcional exceto `id` e `checkEligibility`):

- `checkEligibility(ctx)` — pode disparar agora? (`ctx`: nº de players vivos incl. bots,
  clusters de posição, mortes/min, cooldowns, config efetiva).
- `onWarningStart(room)` / `onWarningTick(room, dt, now)` (T-074) / `onStart(room)` /
  `onTick(room, dt, now)` / `onEnd(room, reason)`.
- `respawnPolicy(room, playerId, phase)` → `"default" | "inside_zone" | "hold_until_end"` —
  o pipeline de morte do core consulta o evento ativo; sem evento ativo, sempre `"default"`
  (comportamento atual intocado).
- `earlyEndCondition(room)` → encerra `active` antes do tempo.

**Schema novo** (⚠schema — cliente e bots precisam recompilar juntos):

```ts
class ActiveEvent extends Schema {
  @type("string") id = "";            // "" = idle (sem evento)
  @type("string") phase = "idle";     // idle | warning | active | ending
  @type("number") phaseEndsAt = 0;    // timestamp ms — cliente deriva countdown/progresso
  @type("number") zoneX = 0;          // centro da zona (eventos espaciais; 0 se não usa)
  @type("number") zoneZ = 0;
  @type("number") zoneRadius = 0;     // raio atual (server interpola; cliente só desenha)
}
// ArenaState ganha: @type(ActiveEvent) event = new ActiveEvent();
// Player ganha:     @type("boolean") waitingRespawn = false; // morto segurado por evento
```

**Regras de ativação** são dados, não código: cada evento declara `minPlayers`, `cooldownMs`
próprio; o Director ainda aplica `EVENT_GLOBAL_COOLDOWN_MS` entre quaisquer eventos e o teto
de 1 evento simultâneo. Defaults em `packages/shared/src/constants.ts` (dials); o painel
Django sobrescreve em runtime via o sync já existente (`platformClient.getConfig`, padrão
T-061 — degrada pros defaults com Django fora do ar).

**Event Director** roda dentro do tick da sala (sem timer novo), avaliando a cada
`DIRECTOR_EVAL_MS` (default 10 s) quando `phase === "idle"`:

1. Snapshot: players vivos (bots contam), posições, mortes/min recentes, `lastEventEndedAt`.
2. Filtra `EVENT_REGISTRY` por elegibilidade (regras acima + `enabled` da config).
3. Decide *se* dispara: probabilidade base por avaliação (`DIRECTOR_TRIGGER_CHANCE`) modulada
   pela intensidade — sessão morna (poucas mortes/min) aumenta a chance; logo após pico, segura.
   Ritmo de tensão/alívio, nunca timer fixo previsível.
4. Escolhe *qual* por peso (`weight` na config). Com 1 evento só, é ele.
5. Gatilho manual pra teste/staff: mensagem `dev_event` atrás de `DEBUG=1` (mesmo padrão do
   `dev_launcher`); depois integrável ao console staff (T-063).

## Comportamento esperado — Battle Royale relâmpago

Ciclo completo (~19.5 s no default; **duração `active` é dial**, testar 10/20/30 s):

**Elegibilidade:** ≥ `BR_MIN_PLAYERS=4` players (bots contam) · cooldown próprio
`BR_COOLDOWN_MS=120s` · cooldown global respeitado.

**Warning (8 s, `BR_WARNING_MS` — T-074: era 5s, esticado pra dar tempo real de reação):**
- Servidor escolhe o **centro da zona = célula de maior densidade de players** (varredura em
  grade das posições vivas; raio inicial = envolve o cluster com folga, clamp
  `BR_ZONE_RADIUS_MIN/MAX` — 6/50 desde T-074, era 6/20; centro snapa em célula walkable via
  `nearestReachableCell`).
- **T-074:** quem está FORA do raio no instante exato do aviso ganha `zone_rush` (boost de
  velocidade `BR_ZONE_RUSH_MULT=1.8`, automático, sem input) — só pra ter chance real de chegar;
  desativa sozinho ao cruzar pra dentro da zona (não é reconcedido depois se sair de novo; teto
  de segurança `BR_ZONE_RUSH_MS=20s` caso nunca chegue). Ver `packages/server/src/systems/effects.ts`.
- Cliente: banner "⚠ BATTLE ROYALE" + contagem regressiva grande + anel da zona já visível +
  chão de fora escurecendo gradualmente (transição, não corte) + seta pra zona pra quem está longe.
- Quem morrer no warning **renasce dentro da zona** (`respawnPolicy = "inside_zone"`, ponto
  walkable sorteado dentro do raio).
- Bots: cientes da zona, caminham pra dentro (senão o evento vira tiro ao alvo).

**Active (duração dial, default `BR_DURATION_MS=10s`):**
- Zona encolhe linearmente de `radiusStart` até 0 ao longo da duração (server interpola,
  cliente só renderiza `zoneRadius`).
- **Fora da zona**: dano por segundo `BR_OUTSIDE_DPS_BASE=10` crescendo
  `dps = base × (1 + BR_OUTSIDE_DPS_GROWTH × t)` (t = segundos de evento; growth default 0.5).
  Dano de zona é "dano verdadeiro": **ignora zona safe do mapa, escudo (`damageTakenMult`) e
  spawn protection** — senão vira camping. Aplica direto em `p.hp`; o pipeline de morte
  existente (checagem `hp <= 0` no tick) processa a morte normalmente, sem killer.
- Quem morrer no active: **`respawnPolicy = "hold_until_end"`** — morte processada 1× (reset
  de nível/build, regras atuais), `waitingRespawn = true`, player fica fora do jogo: sem
  input, invisível/ignorado por projéteis, bots e coletáveis, sem XP passivo.
  Cliente: overlay claro "☠ Aguardando o fim do evento…" + barra de progresso sincronizada
  com `phaseEndsAt` + câmera observando a zona (a espera é arquibancada, nunca tela morta).
- **Fim antecipado:** sobrou ≤1 vivo → vai direto pra `ending` (pedido explícito do CD).

**Ending (~1.5 s, `BR_ENDING_MS`):**
- Sobrevivente(s): destaque "🏆 SOBREVIVENTE: <nick>" + bônus (`BR_SURVIVOR_XP_BONUS`,
  `BR_SURVIVOR_COINS_BONUS`); se o tempo esgotou com vários vivos, todos recebem bônus menor
  (`BR_TIMEOUT_XP_BONUS`); se ninguém sobreviveu, toast "Ninguém sobreviveu…".
- **Sobreviventes voltam com vida cheia, no lugar onde estão, sem interrupção de gameplay.**
- Todos os `waitingRespawn` renascem **juntos, no mesmo tick**, respawn default (zona safe),
  com spawn protection normal.
- Visual da zona desfaz em transição suave; sala volta pra `idle`; cooldowns registrados.

**Interações com sistemas existentes (decididas aqui pra não virar bug):**
- Bandeira: segue as regras atuais (morte do portador derruba no local — já coberto pelo
  pipeline). O evento não desliga a bandeira. Fora de escopo mudar isso.
- Cards de level-up pendentes: seguem regra atual (morte fecha oferta).
- Coletáveis/arma: spawns continuam; sem mudança.
- Telemetria: eventos `event_warning`, `event_start`, `event_end` (com `reason`,
  `survivorTokens`, `holdCount`), `event_zone_death` — via `emitDebug` + `emitTelemetry`
  (padrões existentes). Métricas p/ balancear duração/dano com dados reais.

## Painel Django (gameops)

Novo model `EventModeConfig` (app `gameops`), 1 linha por tipo de evento por `RoomConfig`:
`event_id` (choices; por ora `battle_royale`), `enabled`, `weight`, `params` (JSONField —
sobrescreve dials: `durationMs`, `warningMs`, `minPlayers`, `cooldownMs`, `outsideDpsBase`,
`outsideDpsGrowth`, bônus…). `RoomConfig` (preset) agrupa; `effective_config()` passa a
devolver bloco `events`; `GameEvent` (override temporal, T-027e) pode sobrescrever
`events_enabled` global. `EffectiveConfig` do `platformClient` estende com o bloco `events` —
o sync ao vivo já existente propaga pra sala aberta. **Django fora do ar / PLATFORM_ENABLED=0
⇒ defaults do `constants.ts`, tudo funciona igual** (padrão da casa).

## Fora de escopo

- Novos eventos além do Battle Royale (a arquitetura os habilita; cada um terá SPEC própria).
- Câmera espectador seguindo players (v1 da espera: câmera fixa olhando a zona).
- Mudanças na bandeira, coletáveis ou balance do modo default.
- GUI custom de painel (Django admin basta; console staff T-063 integra depois).
- "Tease" ambiental pré-warning (céu/música) — fica pro passe de polish (T-072) se couber.

## Critérios de aceite

- [ ] Com a frente inteira desligada (sem evento registrado/`enabled=false`), TODOS os gates
      atuais passam sem alteração: tsc ×3, shared 49, server 98, bots 35, smoke de bots.
- [ ] Smoke headless: 6+ bots, ≥3 ciclos completos de BR em sequência (warning→active→ending→idle),
      cooldowns respeitados, sem erro no tick.
- [ ] Morte no warning renasce dentro da zona; morte no active segura respawn e renasce no
      fim junto com os demais; sobrevivente termina com HP = maxHp no mesmo lugar.
- [ ] ≤1 vivo encerra antecipado (observável no feed de debug com `reason: "last_survivor"`).
- [ ] Dano de zona ignora safe zone/escudo/spawn protection (teste unitário).
- [ ] Mudar `enabled`/`durationMs` no Django admin reflete na sala aberta em ≤ 1 ciclo de sync,
      sem restart; Django fora do ar ⇒ defaults.
- [ ] F3 mostra fase/zona/countdown do evento; draw calls do visual da zona ≤ +3.

## Decisão do Creative Director

(aguardando)

Decisões já dadas na ideação (2026-07-07): duração ajustável via painel (default 10 s);
fim antecipado com transição quando sobra 1 vivo + respawn imediato de quem espera;
painel = presets no Django; regras de ativação: ≥4 players (bots contam), re-ativação só
após 2+ min; deve existir um controlador que entende a sessão e decide os eventos.

## Notas da IA

- **Risco maior:** o refactor do pipeline de morte/respawn (T-065) toca o coração do
  `updateInner`. Mitigação: extrair mantendo comportamento byte-a-byte (policy `"default"`),
  cobrir com os 98 testes de server existentes ANTES de plugar o primeiro evento.
- **Zona visual barata:** anel (torus/linha) + plano escuro com furo circular
  (`THREE.ShapeGeometry` com hole path, 1 draw call, regenerado só em mudança de raio
  significativa ou escalado). Nada de shader custom na v1.
- 10 s de active com zona encolhendo até 0 é mais "momento de pânico" que BR clássico —
  intencional (partidas de 2–3 min, princípio 3). Por isso duração é dial, não constante.
- `waitingRespawn` como boolean sincronizado (e não timestamp) porque o fim antecipado move o
  horário — o cliente deriva o progresso de `phaseEndsAt`, que o servidor atualiza.
- Alternativa considerada e rejeitada: evento como "room type" separado do Colyseus —
  quebraria o "nunca para" (migração de sala = loading). Evento é camada sobre a sala viva.
