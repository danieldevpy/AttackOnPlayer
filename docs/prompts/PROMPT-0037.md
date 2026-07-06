# PROMPT-0037 — F2.5 / SPEC-0010 (T-033..T-035): sobrevivência por habilidade · 2026-07-05

## Pedido (resumo fiel do CD)
Duas etapas no mesmo prompt: (1) "criar o plano de uma nova mecânica para entrar em desenvolvimento ainda antes de lançar a V1 — formas de viver mais" (kill que recupera vida conforme a briga, coletáveis de vida escassos e espaçados, escudo temporário de no máx. 2 instâncias, "jogador que joga bem consegue recursos para se manter vivo"); depois (2) "quero que implemente esse plano". O plano virou SPEC-0010 (ADR-017) e três tasks (T-033..T-035, fase nova F2.5); esta leva implementa as três.

## Decisões tomadas (e por quem)
- **Recompensa de kill CONTEXTUAL (T-033, IA propôs, CD aprovou implementação):** o pedido "1v1 → XP, briga → cura" virou: no abate, `countLivingEnemiesNear(matador, COMBAT_THREAT_RADIUS=6)` conta a "temperatura da briga". 0 inimigos → `kill_duel_bonus` (XP extra = `KILL_DUEL_XP_BONUS_PER_LEVEL × nível da vítima`, **além** do XP de kill de sempre); ≥1 → `kill_heal` = `killHealFraction(threats)` da vida **FALTANTE** do matador, sem overheal. Curar da faltante (não da total) + só em briga é o guardrail anti-snowball central: no duelo o dominante ganha XP, nunca vida, então o loop "mato→curo→mato" contra alvos isolados não abre.
- **`killHealFraction` é função pura no shared** (`0.25 base + 0.10 por ameaça extra`, teto `0.5`) — testável isolada, e a fração fica fora do Room (fonte única em `constants.ts`).
- **Recursos de vida têm passe de spawn DEDICADO (`spawnSurvivalItem`), fora do orçamento/pesos do coletável comum** — decisão de arquitetura da IA para honrar "poucos, muito espaçados" sem poluir o spawner genérico: teto por kind (`HP_ORB_MAX=3`, `SHIELD_TEMP_MAX=2`), distâncias mínimas próprias e MAIORES que o comum (player 7, mesmo-kind 9 — vs. 4/2 do genérico), cadência lenta (12s/15s), só campo aberto. `createCollectible` ganhou `forceKind?` opcional — o caminho por peso de zona ficou intacto.
- **Escudo REDUZ, não bloqueia (T-035):** novo `EffectKind` `damage_reduction` no EffectSystem → recompute seta `Player.damageTakenMult` (0.5 por 3s) → `projectiles.ts` multiplica `launcher.damage × strength × damageMult × target.damageTakenMult`. Distinto de propósito da invulnerabilidade de nascimento (ADR-014), que consome o projétil com dano 0 (`blockedByShield`); o escudo deixa o `hit` acontecer com dano menor. Eventos de debug separados para não confundir no F3.
- **Placeholders no cliente (Debug First):** `hp_orb` = esfera vermelha, `shield_temp` = icosaedro azul, em `visuals.ts` (`createCollectibleVisual`). Tag de escudo reusa `player.effects` (o kind `damage_reduction` já entra no array sincronizado). Sem arte, sem VFX novo nesta leva.
- **Escopo consciente deixado de fora** (registrado na spec/ADR): regen passiva parada, cura por box/armadura/crítico/lifesteal-por-dano, escudo como skill de build, e qualquer amarra com aura (Pós-V1) ou persistência entre rounds.

## Resultado verificado
- **Gates:** shared 25/25 (5 novos — `killHealFraction`: duelo=0, base, escala, teto, monotonicidade) · server 28/28 (3 novos — escudo reduz dano no hit ×2 caminhos + `damage_reduction` aplica/expira `damageTakenMult`) · bots 24/24 · `tsc --noEmit` limpo em server/client/bots.
- **Smoke real (12 bots aglomerados, servidor `PORT=2599 DEBUG=1`, polling do `/debug/rooms`):**
  - `kill_heal` observado ao vivo: `{threats:1, heal:10}` e `{threats:2, heal:14}` — mesma vida faltante (40), mais inimigos por perto = mais cura, exatamente a escala projetada. Nenhum overheal.
  - `kill_duel_bonus` ×15 — kills isolados dando XP, não cura.
  - `hp_orb` (12) e `shield_temp` (9) nascendo pelo passe dedicado (escudo batendo no teto de 2 concorrentes) e sendo coletados (`pickup` hp_orb 10, shield_temp 8).
- **Não verificado (ambiente):** veredito visual dos placeholders/tag de escudo — canvas WebGL não renderiza em screenshot no ambiente headless sem GPU (mesma limitação registrada em PROMPT-0027+); marcado pendente de veredito humano, sem marcar critério de "sensação" como ✅ sozinho.

## Regras que nascem daqui
- **Recurso de sobrevivência novo = entrada de dados + caso no passe dedicado, nunca no spawner genérico** — o passe `spawnSurvivalItem(kind, minPlayerDist, minSelfDist)` é o ponto único; item com teto/espaçamento próprio segue esse molde.
- **Dano recebido passa por `target.damageTakenMult`** — qualquer efeito futuro de defesa (armadura, resistência) entra pelo mesmo campo sincronizado via recompute do EffectSystem, nunca com lógica solta no ProjectileSystem.
- **Recompensa de kill é contextual por design** — qualquer ajuste (novo bônus, outro proxy de "briga") vive no bloco de kill do Room + constantes/funções puras do shared; a distinção duelo×briga é a regra, não um caso especial.
- **Bloqueia ≠ reduz:** invulnerabilidade de nascimento **bloqueia** (dano 0, `blockedByShield`); escudo temporário **reduz** (`hit` normal, dano menor). Manter os dois caminhos e eventos separados.

## Pendências para o próximo prompt
- **Veredito de sensação do CD** (jogando período longo) sobre os 4 tunables: `KILL_HEAL_MISSING_FRAC_BASE`, `COMBAT_THREAT_RADIUS`, `HP_ORB_AMOUNT`, `SHIELD_TEMP_DAMAGE_MULT`. Todos movíveis por constante única em `constants.ts`.
- **Veredito visual** dos placeholders (`hp_orb`/`shield_temp`) e da leitura do escudo ativo no HUD.
- Possível VFX nomeado dedicado (aura de escudo, "+X vida" no kill em briga) se o CD quiser — hoje reusa toasts/effects existentes; entra no backlog vivo de VFX quando pedido.
- Métrica `kill_heal`/`kill_duel_bonus` já emitida como evento de debug; se virar telemetria estruturada (T-026) é só mapear.
- Nenhuma pendência de código conhecida para o que foi pedido nesta task.
