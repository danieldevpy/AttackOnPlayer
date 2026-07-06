# PROPOSAL-0004 — Som, personagens/classes e lobby (complemento da V1)

> **Status:** ✅ aprovada pelo CD (2026-07-06) — decisões: som **procedural/WebAudio** na V1; tasks já registradas no BACKLOG (T-049..T-063).
> **Origem:** pedido direto do CD (2026-07-06): som para coletáveis/disparos/eventos; personagem low poly procedural (classe única `archer`) com animações direto no Three.js; fechar integração com o backend/painel; janela pré-sala (lobby); console staff (opcional/futura).
> **Referências:** PROPOSAL-0002 (F1–F6) · SPEC-0008 (Django) · ADR-008/FASES_VISUAIS (fases visuais) · ADR-016 (fronteira Django) · ADR-015 (perfis de controle) · `packages/client/src/vfx.ts` (padrão de registry por evento) · imagem de referência do CD (arqueiro low poly por composição).

---

## 1. Problema / objetivo

A V1 está funcional (F1–F4 fechadas, faltam F5/F6), mas sem: (a) feedback sonoro; (b) identidade visual de personagem (players ainda são cápsula F1); (c) fluxo de entrada — o jogador cai direto na sala sem ver conta, nick, classe ou settings; (d) fechamento das pontas backend↔jogo no painel (ranking, KDA, settings, nicks). Este plano fecha essas 4 frentes **antes do T-032 (go-live)**, mais uma frente opcional pós-V1 (console staff).

## 2. Princípios de execução (para agentes com modelos menores)

Todo o plano foi fatiado para execução agêntica segura com modelos inferiores (Haiku/Sonnet):

1. **Uma task por prompt** (`Executar T-0XX do docs/BACKLOG.md`), contexto = só os arquivos listados na task + AGENTS.md. Usar ACI antes de abrir arquivo inteiro.
2. **Frentes disjuntas paralelizáveis; tasks da mesma frente em série** (mesmo padrão da F2.6). Som = client-only; Personagens = shared+client; Lobby = client(+auth); Backend = Django+platformClient. Nenhuma task cruza duas frentes.
3. **Contrato antes de consumidor:** toda frente começa por uma task de registry/contrato (`SoundDef`, `ClassDef`, endpoint) pequena e testável; as tasks seguintes só consomem. Se um modelo menor falhar numa task de consumo, o contrato não quebra.
4. **Zero mudança de rede sem task explícita.** Só T-052 e T-059 tocam schema/join — são as tasks marcadas para modelo forte.
5. **Gate obrigatório por task:** `tsc ×3` + vitest dos pacotes tocados + smoke com bots quando tocar server. Task sem gate verde não commita.
6. **Placeholder first (ADR-008):** personagem sobe para F2 (composição de primitivas) — nunca GLTF na V1.

## 3. Frente S — Sistema de som (SPEC-0013, a escrever)

**Decisão do CD:** procedural/WebAudio na V1 (zero assets), registry data-driven que aceita arquivos depois.

Arquitetura espelha o VFX da T-022: registry nomeado derivado dos **eventos que o servidor já emite** — nenhum som ad-hoc no `main.ts`. Novo `packages/client/src/audio.ts`:

- `SoundDef { id, synth: {type, freq, envelope, noise?...} | file?: string }` + `AUDIO_REGISTRY`.
- `AudioSystem`: WebAudio `AudioContext` (unlock no primeiro gesto — política de autoplay), master gain, mute, teto de vozes simultâneas, pool.
- Mapeamento evento→som na mesma tabela que o vfx consome (coleta por kind, fire por launcher, hit/kill/death, level-up/card, bandeira, combo, spawn, toast).
- Fase 2 (P): pan/atenuação por distância da câmera, ducking, sliders de volume (liga no lobby T-058).

## 4. Frente C — Personagens, classe e skin (SPEC-0014, a escrever)

Sobe personagens de F1→F2 (ADR-008 prevê exatamente isso: composição de primitivas em `visuals.ts`, ponto de troca único `VISUAL_PHASE`).

- **Contrato (shared):** `ClassDef { id, launcherIds, baseTint, skinIds }` + `CLASS_REGISTRY` com só `archer`; `Player.classId`/`skinId` no schema, validados no join (servidor autoritativo — classe inválida ⇒ default). Guerreiro/mago = adicionar entrada no registry depois, sem tocar sistema.
- **Modelo (client):** `characters.ts` — fábrica `createCharacterVisual(classId, skinId)` retornando `THREE.Group` com partes nomeadas (head cone 4 lados, body cylinder low-seg, arms/legs boxes, arco = torus/tubo), `MeshStandardMaterial flatShading`, geometrias/materiais **singleton** (orçamento < 200 draw calls — instancing se preciso). Plugado via `createPlayerVisual` (F2).
- **Animação:** procedural por código dirigida por estado da rede já sincronizado (velocity ⇒ walk; evento fire ⇒ shoot/puxar arco; death/spawn já têm eventos) — `AnimationMixer` + keyframe tracks OU update manual por seno; decidir na spec pelo mais barato.
- **Projéteis da classe:** flecha visual orientada pela velocidade para os launchers do arqueiro (`basic_shot`/`heavy_shot`/`rapid_shot` viram os "projéteis da classe archer" via `ClassDef.launcherIds` — sem mudar dano/rede); skins = variação de paleta.

## 5. Frente L — Lobby pré-sala (SPEC-0015, a escrever)

Janela única antes do join (evolui o `#profile-selector` + pill de auth da T-028 — **nunca** cadeia de modais):

- Card com: identidade (guest/conta, nick editável), seleção de classe com **preview 3D girando** (reusa `createCharacterVisual`), settings (perfil de controle ADR-015, volumes T-051, fullscreen T-048), botão **Jogar**.
- **Regra de ouro: 1 clique.** Defaults sensatos ⇒ jogador novo clica "Jogar" e entra; tudo mais é opcional.
- Persistência: localStorage sempre; conta Django quando logado (endpoint de settings, T-060). Nick sanitizado/limitado no servidor.
- Join envia `{nick, classId, skinId, profile}` — validação server-side (T-059).

## 6. Frente B — Fechamento backend/painel (extensão da SPEC-0008)

Auditar e fechar as pontas entre T-026/T-027/T-028 e o jogo:

- **KDA/ranking:** agregar kills/deaths (telemetria T-026 já ingere) em `PlayerStats`; endpoints de ranking; exibição no lobby.
- **Admin integral:** eventos (`GameEvent`), salas (`RoomConfig`), contas/nicks (moderação), métricas — tudo operável no admin Django sem deploy (aceite #2 da T-027 já provou o mecanismo).
- **ADR-012 na conta** = T-029 (já no backlog, entra nesta frente).

## 7. Frente X — Console staff (OPCIONAL, pós-V1)

Role `staff` no JWT (Django) ⇒ console in-game (tecla dedicada) com **whitelist server-side** de comandos (toggles de room, spawn rates, kick) + audit log na telemetria. GUI ("painelzinho") fica para depois. Nenhuma task desta frente bloqueia o go-live.

## 8. Ordem, paralelismo e encaixe na V1

```
agora ──► T-049 (SoundDef+AudioSystem) ─► T-050 ─► T-051
      ──► T-052 (ClassDef+schema) ─► T-053 ─► T-054 ─► T-055 ─► T-056
      ──► T-060 (KDA/ranking) ─► T-061 (admin) ─► T-029
                     └──────────────► T-057 (lobby) ─► T-058 ─► T-059 ─► T-062
depois ─► T-030/T-031 (F5) ─► T-032 (go-live) ─► T-063 (staff, opcional)
```

As 3 primeiras colunas são paralelizáveis entre si (frentes disjuntas). O lobby depende do modelo do personagem (preview) e dos endpoints de settings — começa quando T-053 e T-060 fecharem. F5/F6 (T-030..T-032) só depois que S/C/L/B estiverem verdes.

## 9. Riscos

- **Autoplay/WebAudio:** contexto só destrava com gesto — o lobby (clique em "Jogar") resolve de graça; até lá, unlock no primeiro input.
- **Draw calls:** personagem F2 tem ~8 meshes × N players — usar geo/mat singletons e medir no F3 overlay; teto do princípio 5 vale.
- **Schema change (T-052/T-059):** único ponto que quebra replay/bots se malfeito — por isso é task de modelo forte, com testes de join.
- **Escopo do lobby:** tentação de virar "menu de jogo completo" — a spec deve cortar tudo que não for identidade/classe/settings/Jogar.

## 10. Guia de execução por modelo

Ver **`instrucoes/GUIA_MODELOS_CLAUDE.md`** — alocação de modelo Claude por task, com racional e dicas de prompt.
