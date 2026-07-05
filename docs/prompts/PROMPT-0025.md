# PROMPT-0025 — SPEC-0005: ajustes de gameplay pós-teste com bots · 2026-07-04

## Pedido (resumo fiel do CD)
Após testar o jogo com bots, o CD pediu 6 alterações e que fossem englobadas na documentação geral:
1. todos os players online na sala ganham 1 XP por segundo;
2. ao morrer, o nível é zerado;
3. o reroll (tecla R), além de dar atributos, também dá XP;
4. remover a área safe;
5. quando o player nasce/renasce, fica 3 segundos sem tomar dano;
6. o ângulo de direção ainda está muito "fixo" — muito projétil não sai em ângulos específicos.

## Decisões tomadas (e por quem)
- **(1) XP passivo:** `XP_PER_SECOND = 1`. No `update()` do Room, `grantXp(id, p, XP_PER_SECOND * dt)` para cada player vivo, depois da morte/respawn do tick (quem renasceu já conta). Frações por tick; `grantXp` cuida do level-up/oferta de card. Vale para bots.
- **(2) Morte zera o nível:** `p.level = 1` no respawn — removida a perda parcial via `lossFraction` do loop. `lossFraction`/`MAX/MIN_LOSS_FRACTION` ficam **exportadas** (testes/curva de balance e reintrodução por room possível). Também some a antiga flag `fullResetOnDeath`.
- **(3) Reroll dá XP:** handler `reroll` chama `grantXp(+REROLL_XP_REWARD)` (20) além de `rerollAttrPoints`. Ordem: gasta coins → redistribui → concede XP (pode abrir card na hora).
- **(4) Remover safe:** `buildZones` não gera mais zonas safe. Decisão da IA: **não** apagar o primitivo `zone.kind === "safe"` (de `zoneAt`/tipos) porque `projectiles.test.ts` constrói uma safe manualmente e depende do bloqueio — só a **geração** foi removida. Efeito: `zoneAt` nunca retorna "safe" em jogo, então o fire-block e o damage-block por zona ficam dormentes (verificado: 0 tiles safe num 115×105).
- **(5) Invuln de nascimento:** novo campo sincronizado `Player.spawnProtectedUntil` (ms). Setado em `onJoin` e no respawn = `now + SPAWN_PROTECTION_MS` (3000). `ProjectileSystem`: alvo com `now < spawnProtectedUntil` consome o projétil sem dano e emite `blockedByShield` (novo campo do `ProjectileHitEvent`), que o Room converte em `shield_block`. **Break-on-fire:** ao disparar de fato, `p.spawnProtectedUntil = 0` (anti "torre invulnerável"). Cliente: bolha translúcida azul (`updateShieldVisual` em `visuals.ts`) + linha `escudo` no F3.
- **(6) Mira contínua:** causa-raiz era o `aim` só ser enviado no tick do `mousemove`; parado, o servidor caía no facing de movimento (8 direções). Agora o cliente, com `hasCursor`, recalcula `cursorGroundOffset()` (player→cursor) **todo tick** e envia como `aim` — resolução total. Sem mouse (só teclado) o facing segue o movimento (8 dir), inerente ao esquema.

## Resultado verificado
- **Gates:** shared 13/13 · server **19/19** (2 testes novos em `projectiles.test.ts`: escudo bloqueia dano; atirar zera a própria proteção) · `tsc --noEmit` limpo ×3 · guarda `.js` órfão limpa.
- **Smoke (3 bots, 20s):** bot sem tiros nem engajamento chegou ao nível 2 → XP passivo confirmado; combate/pickup ok.
- **Scripts de verificação:** alvo protegido = 0 dano / 5 `blockedByShield`; `spawnProtectedUntil` zera ao atirar; alvo sem proteção morre normal; `buildMap(115,105)` → 0 tiles safe (só war/field).

## Regras que nascem daqui
- Feedback/proteção "por região" (safe zone) foi trocado por "por player, temporal" (escudo). Preferir estado por-player a geometria de mundo quando a regra é sobre o indivíduo.
- Remoção de mecânica que os testes exercem: apagar só a **geração/uso em jogo**, manter o primitivo se um teste depende dele — documentar o porquê no código.
- Novo campo em evento de combate (`blockedByShield`) exige atualizar TODOS os `hits.push` do sistema — o typecheck é a guarda.

## Pendências para o próximo prompt
- Veredito do CD no browser (mira contínua e escudo só se sentem jogando).
- Re-medir pacing: XP passivo + morte-zera-nível podem achatar/acelerar a curva — rodar bots e revisar `docs/ai/balance-T014-ttk.md`.
