# PROMPT-0045 — T-049 (SPEC-0013): AudioSystem + registry procedural · 2026-07-06

## Pedido (resumo fiel)

Executor de task (agente worker) recebeu **apenas T-049** do BACKLOG (Frente S — Som, PROPOSAL-0004): `packages/client/src/audio.ts` novo — `SoundDef` (synth WebAudio: tipo/freq/envelope/noise; campo `file?` reservado), `AUDIO_REGISTRY`, `AudioContext` com unlock no primeiro gesto, master gain + mute, teto de vozes, pool. Espelhar o padrão do `vfx.ts` (T-022). Aceite: 3 sons de teste tocam por evento real; mute funciona; zero erro de autoplay no console.

## Decisões tomadas (e por quem)

- **IA:** `SoundDef` com `wave` (`sine|square|sawtooth|triangle|noise`), `freq`/`freqEnd` (sweep opcional), `envelope {attack, decay}` (rampa linear de gain), `gain` e `file?` reservado — espelha os campos de `VfxDef` (cor/count/life/speed) 1:1 em conceito.
- **IA:** pool de vozes com teto fixo (`MAX_VOICES=12`), rouba a voz mais antiga quando saturado — mesmo padrão de ring buffer do `vfx.ts` (lá é array circular de partículas; aqui é fila de `Voice` com `stop()`).
- **IA:** `AudioContext` só é criado dentro de `unlock()`, chamado por listeners `pointerdown`/`keydown`/`touchstart` com `{ once: true }` — nunca antes do primeiro gesto, para não disparar o warning de autoplay do Chrome.
- **IA:** 3 sons de teste escolhidos = `fire`, `hit`, `death`, plugados exatamente nos mesmos pontos onde `vfx.spawnAt` já dispara `muzzle_flash`/`hit_spark`/`death_burst` em `main.ts` (nenhum evento novo, só o mesmo gancho existente). Mapeamento completo de sons por kind/launcher fica pra T-050 (não escopo desta task).
- **IA:** mute exposto via `setMuted`/`isMuted`/`toggleMuted`; sem UI dedicada (slider/persistência é T-051, exposição no lobby é T-058) — testável nesta task via tecla `M` no handler global de teclado já existente (`main.ts`, mesmo bloco de F3/1-2-3/R).

## Resultado verificado

- `packages/client/src/audio.ts` (novo): `SoundDef`, `AUDIO_REGISTRY` (`fire`/`hit`/`death`), `createAudioSystem()`.
- `packages/client/src/main.ts`: import + instância `audio`; `audio.play("fire")` no spawn de projétil (mesma linha do `vfx.spawnAt(style.muzzle,...)`); `audio.play("hit")` no `ev.type === "hit"`; `audio.play("death")` no `ev.type === "death"`; tecla `M` chama `audio.toggleMuted()`.
- `cd packages/client && npx tsc --noEmit` — limpo.
- Preview manual (`server-verify`:2604 + `client-verify`:5299): client conectou numa sala real, gesto de clique destravou o `AudioContext` (`state: "running"`), `AUDIO_REGISTRY` com as 3 chaves esperadas carregado via import dinâmico, `play()`/`toggleMuted()` executados sem exceção, bots reais (`SERVER_URL=ws://localhost:2604 npm run bots -- 2 15`) rodaram na mesma sala do client conectado — console sem nenhum erro (só warning padrão do Electron, não relacionado).
- `npm run aci -- index` rodado ao final.

## Regras que nascem daqui

- Novo som = 1 entrada em `AUDIO_REGISTRY` (nunca `new Audio()`/oscilador solto em `main.ts`), mesmo princípio do `vfx.ts`.
- `AudioContext` nunca é instanciado fora de um gesto do usuário — qualquer código que precise tocar som antes disso deve esperar o unlock (checar `ctx.state === "suspended"` antes de agir).
