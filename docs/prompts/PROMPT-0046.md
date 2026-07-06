# PROMPT-0046 — T-050+T-051 (SPEC-0013): mapeamento evento→som + áudio posicional · 2026-07-06

## Pedido (resumo fiel)

Executor de task (agente worker) recebeu **T-050 e T-051** do BACKLOG (Frente S — Som,
PROPOSAL-0004), em sequência (T-051 depende de T-050, ambas em `packages/client/src/audio.ts`):
- **T-050:** mapeamento evento→som completo — coleta por kind (xp/coin/hp/shield/weapon/box/
  farm_event), fire por launcher (basic/heavy/rapid), hit dado/recebido, kill/death/respawn,
  level-up + card escolhido, bandeira (pickup/drop/cooldown/respawn), xp_combo,
  spawn_materialize, toast. Sons distinguíveis entre si. Aceite: partida com bots audível e
  legível de olhos fechados; sem estouro de vozes.
- **T-051:** áudio posicional + polish — atenuação/pan por distância da câmera, ducking
  simples, sliders master/sfx persistidos em localStorage (lobby T-058 expõe depois).

## Decisões tomadas (e por quem)

- **IA:** regra central de "legibilidade" — eventos **pessoais** (hit dado/recebido, kill,
  death_self, respawn_self, level-up/card, toda coleta por kind, xp_combo, skill de box,
  streak) tocam **só pro jogador dono do evento**; numa partida com vários bots, tocar isso
  globalmente vira ruído contínuo (farm de XP a cada segundo por bot) e mascara o que importa.
  Eventos **ambientes/globais** (fire por launcher, morte de outro jogador, bandeira,
  farm_event de zona) continuam audíveis pra todo mundo — é informação tática válida mesmo
  sem posição exata ainda.
- **IA:** `hit`/`death` (registry de teste da T-049) viraram `hit_given`/`hit_taken`/`kill` e
  `death_self`/`death_other` — a distinção "dado/recebido" do backlog só faz sentido do ponto
  de vista de alguém (`shooterId`/`victimId` comparado a `mySessionId`).
- **IA:** `flag_pickup`/`flag_drop` **não tinham nenhum handler client-side** antes desta task
  (nem VFX nem toast) — os debug events já existiam no servidor (`ArenaRoom.ts:521,607`) mas
  o client ignorava. Adicionados agora só pra áudio (posicional, na posição de quem
  pega/derruba), sem VFX novo — fora do pedido explícito da task.
- **IA (T-051):** `AudioContext` ganhou 3 buses: `master` (mute + volume geral) → `sfxBus`
  (volume de efeitos, persistido separado do master pra quando a T-058 expuser os 2 sliders)
  → `duckBus` (só sons NÃO-`priority`). Som marcado `priority: true` no `SoundDef` conecta
  direto no `sfxBus` (pula o duck) e, ao tocar, abaixa o `duckBus` por ~350ms
  (`setTargetAtTime`) — ducking simples sem sidechain de verdade.
- **IA (T-051):** posição é **opcional** em `play(name, x?, z?)` — omitida = som pessoal
  (cheio, sem pan, "na cabeça"); informada = atenuação linear até `MAX_AUDIBLE_DIST=26` +
  `StereoPannerNode` (com fallback silencioso se o browser não suportar). A câmera do jogo
  **nunca gira** (`followCamera` sempre olha -Z), então pan = diferença de X do mundo direto,
  sem trigonometria de facing.
- **IA:** `setListenerPosition(x,z)` chamado 1×/frame em `animate()` (mesmo padrão de
  `vfx.update(now)`), alimentado pela posição da câmera.
- **IA:** volumes persistidos em `localStorage["aop_audio_volume"] = {master, sfx, muted}` —
  incluí `muted` na mesma chave (não só master/sfx) por consistência; UI de slider fica pra
  T-058 (lobby), aqui é só a camada de dados + a tecla `M` (já existente da T-049) pra testar.

## Resultado verificado

- `packages/client/src/audio.ts`: registry expandido pra 27 sons nomeados; `priority`/ducking;
  `setListenerPosition`; `play(name, x?, z?)` com atenuação/pan; `setMasterVolume`/
  `getMasterVolume`/`setSfxVolume`/`getSfxVolume` persistidos.
- `packages/client/src/main.ts`: todos os pontos de evento (fire por launcher, hit/death,
  pickup por kind, xp_combo, upgrade, box_skill, flag_pickup/drop/cooldown/respawn,
  farm_event announce, respawn) plugados no som certo; `audio.setListenerPosition` no loop.
- `packages/client/src/hud.ts`: `HudCtx.playSound` novo (main.ts injeta `audio.play`) — usado
  no toast de kill streak (única leitura de combate que vive em hud.ts, não em main.ts).
- `cd packages/client && npx tsc --noEmit` — limpo.
- Preview manual (`server-verify`:2604 + `client-verify`:5299): import dinâmico do módulo
  tocou as 27 entradas do registry (sem posição, com posição perto, com posição longe/no-op)
  sem exceção; `setMasterVolume`/`setSfxVolume`/`toggleMuted` persistiram em
  `localStorage["aop_audio_volume"]`; partida real com 4 bots (`SERVER_URL=ws://localhost:2604
  npm run bots -- 4 20`, hp caiu de 100→60/80 = combate de verdade) — F3 confirmou `pickup`,
  `xp_combo` e `upgrade` (auto E manual) passando pelos handlers novos — console sem nenhum
  erro do início ao fim.
- `npm run aci -- index` rodado ao final.

## Regras que nascem daqui

- Som novo pessoal (só o dono do evento ouve) vs. ambiente (todo mundo ouve) é uma decisão
  de design, não só técnica — documentar no registry (comentário) qual é qual, porque errar
  pro lado "global" em evento frequente (pickup, hit) transforma uma partida de bots em ruído
  branco.
- `priority: true` no `SoundDef` = doi coisas ao mesmo tempo: bypassa o duck bus E dispara o
  ducking nos outros sons. Não é só "mais alto" — é "isto importa mais que o ambiente agora".
