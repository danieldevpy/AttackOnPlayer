# SPEC-0006 — V1/F1+F2: Perfis de controle, IA de bot, bandeira, VFX e HUD dev/prod

**Status:** aprovada · **Marco:** V1 (F1+F2) · **Data:** 2026-07-05
**Origem:** PROPOSAL-0002 (§3 P1/P2/P4/P6/P7 + §9 A1/A2) · ADR-015 · `docs/ai/bot-architecture.md`

## Problema / objetivo
A build atual atira "por ângulos" (facing por movimento), os bots parecem robôs e esbarram na borda, não há objetivo de mapa, e o HUD é de desenvolvimento. Esta spec entrega a **sensação** (controles por perfil estilo Valorant-3D-leve) e a **leitura** (bandeira, efeitos nomeados, HUD limpo com reveal-on-hit).

## Comportamento esperado
- **Perfis de controle (ADR-015):** camada no cliente onde todo perfil produz `{move, aim, fire}`. Perfil `mouse`: WASD strafe + crosshair 360° (cursor SO oculto) + câmera com leve offset na direção da mira. Perfil `keyboard`: rotação de mira por teclas, fallback facing-por-movimento. Perfil `touch`: twin-stick virtual (mover/mirar-atirar). Auto-detecção + seletor. Servidor inalterado.
- **IA de bot em camadas** (`bot-architecture.md`): percepção filtrada → memória → decisão utility → **context steering** (nunca mais empurrar a borda; strafe orbital em duelo) → **humanizador** (reação 200–500ms, mira com lerp, pausas, desistência) → atuação na mesma intenção dos perfis. `Personality` = JSON; perfis/boss (T-008b) são presets.
- **Bandeira (rei do mapa):** default ON (`flagEnabled` por room); portador: XP passivo ×2 + glow global; morte derruba no local; abandonada volta ao centro após N s; métricas de posse.
- **VFX nomeados:** registry data-driven (`muzzle_flash`, `hit_spark`, `death_burst`, `level_up_ring`, `shield_pop`, `flag_aura`, `pickup_glint`), derivados de eventos já emitidos; pool com orçamento global.
- **HUD dev/prod:** build prod = ping discreto, painel próprio compacto (HP/nível; atributos por tecla), sem F3/roster/feeds; inimigo = só skin (placeholder: cor+forma por token) até **trocar dano** → nameplate+HP junto ao boneco por ~4s renováveis (`revealedUntil` autoritativo). Dev = tudo atual.

## Fora de escopo
Skins de verdade, gamepad, aura (ADR-005), editor de mapas, matchmaking.

## Critérios de aceite
- [ ] Perfil mouse: circular um alvo com strafe mantendo o crosshair nele; tiro sai exatamente no crosshair (qualquer ângulo).
- [ ] Perfil keyboard e touch jogáveis do início ao fim de um round (touch testado em viewport mobile).
- [ ] Bot nunca fica >2s empurrando borda/prop (telemetria de stuck ~0 no mapa padrão); mira de bot sem tremor por tick (lerp visível no F3).
- [ ] Camadas `decision`/`steering` com testes unitários puros (snapshot → escolha).
- [ ] Bots disputam a bandeira; portador visível pelo mapa; toggle off remove a mecânica; XP do portador dobra.
- [ ] Efeito novo = 1 entrada de dados; 8 players em combate dentro do orçamento de partículas.
- [ ] Build prod sem artefato de dev; reveal só após hit e expira; painel próprio não sobrepõe a área de jogo central.

## Decisão do Creative Director
Aprovada via PROPOSAL-0002 (2026-07-05) com ajustes §9 (A1 controles por perfil, A2 IA em camadas). Questões abertas remanescentes: bônus de atributo da bandeira e duração exata do reveal — defaults da spec (só 2×XP; 4s) valem até o CD ajustar em teste.

## Notas da IA
- Ordem interna sugerida: T-019 → T-020 → T-019b → T-021 → T-022 → T-023 → T-008b (boss ganha bandeira/VFX de graça).
- Risco: perfil touch exige testar input em dispositivo real — bots não cobrem; smoke manual obrigatório.
- O humanizador NÃO pode furar o cooldown do lançador (regra do PROMPT-0019 mantida).

## Quebra em tasks
T-019 (perfis + mouse) · T-019b (keyboard + touch) · T-020 (arquitetura de IA) · T-021 (bandeira) · T-022 (VFX) · T-023 (HUD dev/prod + reveal) · T-008b (perfis/boss) — detalhes no BACKLOG.
