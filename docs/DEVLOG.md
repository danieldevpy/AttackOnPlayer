# Devlog

## 2026-07-05 — Sessão 9 (final): ajuste A4 — juice contínuo com regra de intensidade
- CD jogou mais e pediu (sem reestruturar o plano): mais efeitos visuais (trail de velocidade, anel de cooldown de buff, sangue no hit), distinção **automático = leve vs escolha manual = "aura" chamativa**, toasts de texto personalizados e não invasivos, e um mecanismo para adicionar juice "quando sentir a necessidade momentânea".
- Solução sem tocar nas fases: **backlog vivo** `docs/mechanics/vfx-juice-backlog.md` (fila que o CD alimenta a qualquer momento; qualquer leva puxa itens via registry da T-022) + regra de intensidade registrada na PROPOSAL-0002 §9-A4 e na SPEC-0006; `toast_text` incorporado ao T-023. Plano da V1 **finalizado**.

## 2026-07-05 — Sessão 9 (cont., design): V1 aprovada com ajustes — documentação executável completa
- CD aprovou a PROPOSAL-0002 com 3 refinamentos (registrados no §9): **A1** controles viram PERFIS (`mouse`/`keyboard`/`touch`, todos → `{move, aim, fire}`; jogo é "Valorant 3D leve"; rotação por perfil — ADR-015 encerra o vaivém das ADRs de mira); **A2** bot vira **arquitetura de IA** com base teórica própria (`docs/ai/bot-architecture.md`: percepção → utility AI → context steering → humanizador; Personality = JSON; perfis/boss/Guardian = presets); **A3** mapas referenciam **objetos registrados** (`ObjectDef` em código agora, sistema depois) e a CLI ganha `save-current` (salvar o mapa gerado atual e reajustar) — IA cura mapas com o CD, nunca gera automático.
- Criadas as 4 specs executáveis: **SPEC-0006** (F1+F2 sensação & leitura), **SPEC-0007** (F3 mapas & objetos), **SPEC-0008** (F4 telemetria/Django/auth), **SPEC-0009** (F5+F6 docker/hardening/lançamento) + **ADR-015/ADR-016**; BACKLOG revisado (T-019 dividida em T-019/T-019b; T-020 promovida a 〔G〕).
- Sem código de jogo nesta entrada. Próximo: `Executar T-019` (recomendado: veredito/merge das SPECs 3–5 antes, pois T-019 mexe no input recém-alterado).

## 2026-07-05 — Sessão 9 (design): PROPOSAL-0002 — plano completo da V1 até o lançamento
- CD jogou a build e trouxe 9 percepções (bots robóticos na borda, mira "por ângulos" → quer CS-2D, mapas escolhíveis + CLI, bandeira 2×XP/s, backend Django+admin, HUD dev/prod + inimigo revelado só ao trocar dano, VFX nomeados, logs para análise por IA, login anônimo+Google) + pedido de plano por etapas até a V1 na VPS (docker dev/prod + scripts).
- Alinhamento com o histórico: a mira CS-2D **reverte a ADR-014.6** (facing por movimento) — registrado como revisão consciente (vira ADR-015 na aprovação); Aura (M2) e Guardian (M3) adiados para pós-V1 (a bandeira entrega o "objetivo de mapa" mais barato); M4/M5 absorvidos pelas fases F4/F5/F6; guardrail da constituição mantido (conta = identidade/estatística, nunca poder in-round).
- Também commitado o código da SPEC-0005 que estava com working tree sujo da sessão anterior (já testado, 19/19 no server).
- Produzido: `docs/proposals/PROPOSAL-0002-v1-lancamento.md` (análise ponto a ponto com acréscimos, arquitetura alvo, guardrails, 6 fases, 5 questões abertas) + seção **V1** no BACKLOG (T-019..T-032, T-032 = 🚀 lançamento) + ROADMAP remapeado.
- Sem mudança de código de jogo nesta entrada. Próximo: aprovação do CD → specs por fase (SPEC-0006..0009) → `Executar T-019`.

## 2026-07-05 — Sessão 8 (cont.): correções da SPEC-0005 (PROMPT-0026)
- CD apontou 2 erros da leva anterior:
  1. **Facing não é do mouse.** A direção/visão do player deve vir do **movimento** (WASD), como antes, só que mais eficiente. Removido do cliente todo o caminho de mira por mouse (raycast `cursorGroundOffset`, `mousemove`, envio de `aim`); o servidor já deriva `dir` de `inputX/inputZ`. Cliente do player não manda mais `aim` — o campo do protocolo fica só para os bots (que miram no alvo). Menos trabalho por tick, menos rede.
  2. **XP fracionado no HUD** (`1.478.../88`). Causa: o XP passivo somava fração por tick direto em `p.xp`. Corrigido com **acumulador de tempo no servidor** (`xpAccum`): o XP entra em `p.xp` só em unidades inteiras (1/s), então o estado nunca é fracionado. HUD também floora por defesa.
- **Verificado:** shared 13/13, server 19/19, `tsc --noEmit` limpo ×3. Docs atualizadas (SPEC-0005 item 6 + nota de correção, ADR-014, PLAYER_LOOP/combat, QA, ROADMAP, SESSAO_ATUAL).

## 2026-07-04 — Sessão 8: SPEC-0005 — ajustes de gameplay pós-teste com bots
- CD testou com bots e pediu 6 alterações (PROMPT-0025), implementadas e verificadas:
  1. **XP passivo:** todo player vivo ganha +1 XP/s (`XP_PER_SECOND`) em `grantXp` por tick — o mapa não "esfria" e quem foi zerado sobe só jogando. Confirmado no smoke: bot sem tiros nem engajamento chegou ao nível 2.
  2. **Morte zera o nível:** `p.level = 1` no respawn (aposenta `lossFraction` do loop — função fica exportada p/ testes/curva de balance). Risco real máximo.
  3. **Reroll dá XP:** handler `reroll` chama `grantXp(+20, REROLL_XP_REWARD)` além de redistribuir — a tecla R vira progressão ativa (pode abrir card na hora).
  4. **Zonas safe removidas:** `buildZones` não gera mais safe (verificado: 0 tiles safe num 115×105, só war/field). O primitivo `zone.kind === "safe"` fica só nos testes de combate. Sem safe, o fire-block por zona nunca dispara.
  5. **Invulnerabilidade de nascimento:** novo campo `Player.spawnProtectedUntil`; 3s (`SPAWN_PROTECTION_MS`) ao nascer/renascer; `ProjectileSystem` bloqueia dano (evento `shield_block`, novo `blockedByShield`) e a proteção **cai quando o player atira**. Bolha translúcida no cliente + contador no F3. Verificado por script: alvo protegido = 0 dano / 5 blocks; disparar zera a própria proteção; sem proteção o alvo morre normal.
  6. **Mira contínua:** cliente recalcula `aim` (player→cursor) todo tick com cursor presente, não só no `mousemove` — fim do snap para as 8 direções do movimento (causa-raiz do "tiro em ângulos fixos").
- **Verificado:** shared 13/13, server 17/17, `tsc --noEmit` limpo ×3, guarda `.js` órfão limpa, smoke com 3 bots (level-up por presença sem kill; combate ok). Docs atualizadas: SPEC-0005, ADR-014, PLAYER_LOOP/progression/world/combat, ROADMAP, QA, SESSAO_ATUAL.
- Pendente: veredito do CD no browser (checklist novo no QA.md), re-medir pacing (XP passivo × morte-zera) com bots, T-008b (perfis/boss), merge para `main`.

## 2026-07-04 — Sessão 7: SPEC-0004 implementada (T-014..T-018)
- Execução completa da spec em 5 levas commitadas separadamente (PROMPT-0020..0024): rebalance TTK (dano 20 + guarda em teste), `ATTR_DEFS` data-driven (5 atributos, cadência/alcance no `ProjectileSystem`, reroll 5-vias com fix de arredondamento), cards de level-up (fila server-authoritative, `choose_upgrade` validado, timeout auto-pick, `hud.ts` extraído, bots respondem), skills de projétil (multishot/pierce/fôlego/impulso como modificadores por player — desvio registrado da spec: skill é do jogador, não do `LauncherDef`; marcos 4/8/12 com card ★; box sorteia skill), juice de poder (aro por faixa, números de dano com escala, streak).
- **Verificado:** shared 13/13, server 17/17 (inclui guardas de balance: 5 tiros equilibrado, 3 tiros full-força, pierce exato, cooldown 750ms do perfurante), `tsc --noEmit` limpo ×3, guarda `.js` órfão limpa, smoke com bots real (level-up via card confirmado por `hp 104` no nível 2; kill+respawn ok). **TTK medido:** kills/sessão-bot 0.18 → 0.50, bots terminando com hp 20/40 — relatório em `docs/ai/balance-T014-ttk.md`.
- Aprendizado de ambiente: sessão em sandbox com rede intermitente e filesystem efêmero fora dos mounts — toolchain bootstrapado por chamada (tarball do Node em outputs); processos de fundo não sobrevivem entre chamadas; `pkill -f tsx` mata o próprio shell (usar kill por PID/porta).
- Pendente: veredito do CD no browser (checklist novo no QA.md), T-008b (perfis/boss), merge para `main`.

## 2026-07-04 — Sessão 6 (design): SPEC-0004 — escala de poder, builds e skills
- Pedido do CD: dano "aumenta devagar", difícil eliminar players; planejar sistema de skills/atributos gamificado antes de implementar.
- Diagnóstico (PROPOSAL-0001): dano não aumenta devagar — **TTK é matematicamente constante** (10 tiros em qualquer nível) porque força e vitalidade escalam na mesma taxa (+4%/pt, pontos iguais). Verificado por conta: `10×(1+0.04p)` vs `100×(1+0.04p)`.
- CD aprovou a proposta → formalizada como `specs/SPEC-0004-skills-atributos-escala.md` + ADR-013 + tasks **T-014..T-018** no BACKLOG (nova seção M1.5), adendos em T-008b (política de cards por perfil, boss) e T-OPTIONAL 1 (relatório TTK).
- Resumo: TTK alvo 5 tiros (dano base 20), `ATTR_DEFS` assimétrica (+Cadência/+Alcance, tetos por atributo), cards de level-up determinísticos (timeout 5s, sem pausa), multishot/pierce como skills de marco (nunca atributo linear), juice visual de poder, bots no mesmo pipeline com escolha determinística — player protagonista.
- Sem mudança de código nesta entrada — só design/documentação. Próximo: `Executar T-014 do docs/BACKLOG.md`.

## 2026-07-04 — Sessão 5 (cont., docs): correção de documentação desatualizada
- Pedido do CD: documentar corretamente o bugfix anterior seguindo o padrão do projeto, e relatar estado atual + próximos passos.
- Ao revisar contra `AGENTS.md`/`DOC_MAP.md`, achado: `ROADMAP.md`, `VISAO-ATUAL.md` e `mechanics/PLAYER_LOOP.md` estavam **desatualizados de várias entregas atrás** — ainda diziam "T-008 pendente" e "bots não atiram sozinhos", quando T-008 (bots de combate) e a SPEC-0003 inteira (facing/mira/gatilhos) já estavam prontas e testadas. `QA.md` também não documentava o gate `npx vitest run` do `server` (existia e já rodava nesta sessão, só não estava no checklist).
- Corrigido: `ROADMAP.md` (linha do M1 reflete SPEC-0003 completa), `VISAO-ATUAL.md` (reescrito — tabela "o que já funciona" com facing/gatilho/ganchos de mobilidade/bots de combate/anti-stuck), `PLAYER_LOOP.md` (seções Combate e Debug reescritas pro modelo mira≠gatilho e F3 sempre-on), `QA.md` (gate do server no checklist, matriz de features com as novas mecânicas, remoção da entrada obsoleta "T-008 bots atiram" da lista de "não bloqueia merge").
- Sem mudança de código nesta entrada — só documentação. Nenhum `PROMPT-NNNN` novo (mesmo padrão da sessão de docs anterior, ver DEVLOG "Sessão 3 (docs)").

## 2026-07-04 — Sessão 5 (cont.): bugfix pós-teste manual (F3, ritmo de ataque, anti-stuck)
- CD testou a SPEC-0003 completa no browser + bots e relatou 3 problemas (PROMPT-0019):
  1. **F3 sem log:** o broadcast do feed de eventos exigia `DEBUG=1` no servidor além de abrir F3 no cliente — um segundo interruptor escondido. Removida a checagem; o feed agora sempre acompanha o ring buffer/`/debug/rooms`, que já eram sempre-on. `DEBUG=1` sobra só pro `dev_launcher` (T-012).
  2. **Bot "impossível de matar":** o gatilho do bot ligava a cada tick no alcance, limitado só pelo cooldown da arma (igual humano/bot). Cada `SkillName` ganhou `fireIntervalMs: [min,max]` (`fraco` 1000–1900ms, `medio` 550–1050ms, `forte` 280–600ms); o bot sorteia o próximo intervalo a cada tiro (nunca fixo) — gate adicional ao cooldown da arma, nunca o ultrapassa.
  3. **Bot grudando em obstáculo:** o movimento de combate era linha reta sem desvio (diferente da caça a coletável, que usa BFS). Novo anti-stuck: compara posição autoritativa tick a tick; se pretende andar e quase não desloca por ~500ms, força um desvio lateral por 350–700ms. Não depende de geometria do mapa, só da posição que o servidor já resolve.
- Verificado: tsc limpo (server/bots); shared 5/5; server 4/4. Ao vivo: F3 mostrou `spawn` sem `DEBUG=1`; `npm run bots -- 3 30` — `fraco` 9 tiros vs. `medio`/`forte` 23 (antes: 200+ pra qualquer skill); `BOT_VERBOSE=1` mostrou `"preso — escapando lateralmente"` disparando várias vezes numa sessão de 6 bots, sem regressão de combate.

## 2026-07-04 — Sessão 5 (cont.): T-012 (ganchos de mobilidade) — SPEC-0003 fecha
- **T-012** (PROMPT-0018), última task da spec: `LauncherDef` ganha `movement?` opcional (`selfSlowFactor`, `selfSlowMs`, `inheritVelocityFactor`) — ausente = neutro, `basic_shot` não muda.
- `EffectSystem` ganhou o primeiro efeito de **magnitude dinâmica** (`launcher_slow`, campo `ActiveEffect.magnitude` + método `applySlow()`) — até aqui todo efeito tinha força/duração fixas em constante; agora cada lançador pode definir as suas. `inheritVelocityFactor` bende a direção do projétil somando uma fração do vetor de movimento do atirador (não muda a magnitude do tiro, só a direção).
- Lançador de teste `heavy_shot_dev` no registro `LAUNCHERS`, só selecionável via mensagem nova `dev_launcher` — e essa mensagem só funciona com `DEBUG=1` (reaproveitado o flag real que já existia, sem inventar um `DEV_MODE` novo que só existia nos docs).
- Verificado: novo `describe` determinístico em `projectiles.test.ts` (4/4 no total) prova que `heavy_shot_dev` derruba `player.speed` para o fator exato e ele volta sozinho após a duração, e que `basic_shot` não mexe em nada. `npm run test` (shared) 5/5. `npm run bots -- 3 30` sem crash. Confirmação visual da janela transiente de 700ms não foi possível no preview (ambiente processa comandos com throttling de dezenas de segundos entre chamadas) — o teste unitário é a prova mais confiável disso mesmo.
- **SPEC-0003 fecha:** T-009..T-013 todas ✅. Falta só veredito geral do CD e decisão de merge (`movimento_e_direcao` → `main`, checklist em `QA.md`).

## 2026-07-04 — Sessão 5 (cont.): T-013 (migração dos bots)
- **T-013** (PROMPT-0017): bots (`packages/bots/src/bot.ts`) migrados para `{x, z, aimX?, aimZ?, fire?}` — miram continuamente no inimigo engajado (`aimX/aimZ`, chumbo/lead + erro por skill) mesmo fora do alcance de tiro; o gatilho (`fire: true`) só liga dentro do alcance do launcher. Direção real do disparo sai do facing resolvido pelo servidor, igual ao cliente humano desde T-009/T-010.
- Fecha o efeito colateral aceito nas duas entregas anteriores: bots tinham parado de atirar (0 tiros) porque mandavam o `fx/fz` antigo, que o servidor não lê mais.
- Verificado: tsc limpo; `npm run bots -- 6 45` (skill forte) voltou a produzir tiros e pelo menos 1 morte confirmada no log do servidor (`bot-4 morreu. Respawn...`); gate padrão completo (test/tsc×3/bots smoke/guarda `.js`) limpo.
- `docs/ai/bots.md` atualizado para o protocolo novo.
- Falta só **T-012** (ganchos de mobilidade no LauncherDef) para fechar a SPEC-0003 inteira.

## 2026-07-04 — Sessão 5 (cont.): T-011 (facing visível) + bugfix crítico de build
- **T-011** (PROMPT-0016): indicador placeholder de facing ("nariz", cone amarelo — F1/ADR-003) no `THREE.Group` de todos os players (`visuals.ts`); rotação interpolada em `main.ts` com menor-caminho-angular (`shortestAngleDiff`), convenção `group.rotation.y = -dir` verificada analiticamente com a fórmula de rotação em Y do Three.js.
- **Achado durante a verificação (não era o pedido, mas bloqueava provar T-011 funcionando):** o repo tinha `.js` compilados esquecidos do lado de `.ts` em `packages/{client,shared,bots}/src/` (de uma `tsc` rodada sem `--noEmit`, commit antigo `be7cc0a`). O Vite resolve import sem extensão preferindo `.js` — ou seja, esses arquivos obsoletos **venciam silenciosamente os `.ts` reais** em qualquer import relativo (`./visuals`, `./constants`, `./map`, `./rng`, `./launchers`). Confirmado via log de rede do preview. Removidos os 9 arquivos órfãos; o `.js` shadow nunca tinha efeito documentado em nenhuma task anterior porque ninguém tinha mexido nesses arquivos desde o commit que os gerou — mas era uma bomba-relógio para qualquer edição futura em `shared/`.
- Efeito colateral bom: `npm run test` (shared) foi de "10/10" para **5/5** — eram os mesmos 5 testes de `constants.test.ts` rodando duas vezes (uma do `.ts`, uma do `.js` duplicado), não 10 testes reais. `QA.md` atualizado com o número certo e uma guarda automática (`find ... .ts` sem par `.js`) nos gates e no checklist de merge.
- Verificado: tsc limpo nos 3 pacotes após a remoção; `npm run test` 5/5; ao vivo no browser (preview) o nariz apareceu e girou corretamente com mouse e teclado; `npm run bots -- 3 10` sem crash (0 tiros, esperado até T-013).
- Próximo: T-012 (ganchos de mobilidade) e T-013 (migração dos bots) — podem seguir em qualquer ordem, ambas dependem só de T-010 (pronta).

## 2026-07-04 — Sessão 5: SPEC-0003 — T-009 (facing) + T-010 (gatilhos desacoplados)
- Nova spec aprovada (`specs/SPEC-0003-facing-mira-gatilhos.md`, CD): facing sincronizado, mira ≠ gatilho, ganchos de mobilidade por lançador. Quebrada em T-009..T-013.
- **T-009** (PROMPT-0014): `Player.dir` (ângulo, sincronizado) — híbrido resolvido no servidor: mira (`aimX/aimZ`) tem prioridade quando presente, senão segue o movimento, parado mantém o último valor (nunca zera). Cliente só manda `aimX/aimZ` no tick em que o mouse de fato se move. `docs/mechanics/movement.md` atualizado.
- **T-010** (PROMPT-0015): protocolo de input perde `fx/fz` de vez — vira `{x, z, aimX?, aimZ?, fire?}`. `ProjectileSystem` usa só `p.firing` (booleano) + `p.dir` (facing) para decidir se/para onde atira; spawn ganha offset de raio na direção do facing. Cliente mapeia gatilhos num `Set` (`fireSources`: mouse/space) — extensível a gamepad/touch sem mudar o protocolo. `docs/mechanics/combat.md` atualizado.
- Overlay F3 ganhou `facing` e `gatilho` (fontes ativas) do meu player e `dir` de todos — fecha o critério de aceite 6 já nesta entrega.
- Verificado: tsc limpo (server/client/bots); shared 10/10; `projectiles.test.ts` 2/2 (adaptado para `dir`/`firing`); ao vivo no browser — os 3 casos de facing (mira/teclado/parado) e disparo por espaço e por clique confirmados no F3 (mesma direção, mesmo `dir`).
- **Efeito colateral aceito**: bots (T-008) ainda mandam `fx/fz` — servidor ignora, então bots se movem/perseguem normalmente mas não disparam mais (0 tiros, sem crash, confirmado com `npm run bots -- 3 10`). Fica para **T-013**, que já existe na spec pra isso.
- Próximo: T-011 (facing visível/rotação no cliente) e T-012 (ganchos de mobilidade no LauncherDef) podem seguir em paralelo — T-013 fecha a lacuna dos bots.

## 2026-07-04 — Sessão 4: T-008 (bots de combate, mínimo) + análise de frameworks
- Análise pedida pelo CD antes de codar: spec-kit/dotcontext **não são ferramentas** aqui — ADR-004 os trocou por processo leve in-repo, seguido bem. Desvios: specs pararam no SPEC-0002, SESSAO_ATUAL apontava branch defasada, edição não commitada em BACKLOG. Registrado em PROMPT-0013.
- Base arrumada: T-008 dividido em T-008 (mínimo) + **T-008b** (personalidade/atributos/boss); `bots.md` e SESSAO_ATUAL atualizados.
- Bots de combate em `packages/bots/src/bot.ts`: perfis de skill `fraco|medio|forte` (`BOT_SKILL` ou sorteio), mira com **lead**, fuga a HP baixo, e — causa-raiz corrigida — **ignoram alvos em zona safe** (antes congelavam dentro da safe do spawn, 0 tiros). `forte` = caçador pelo mapa todo.
- Verificado: tsc limpo (server/client/bots); shared 10/10; **novo teste `projectiles.test.ts` 2/2** (cadeia tiro→dano→morte→kill + bloqueio em safe); corrida ao vivo de 6 bots forte com `DEBUG=1` → **18 hits, 1 kill, 1 death** confirmados no ring buffer. Kills raros em janela curta por causa da fuga a 25% HP (ajuste fica p/ passe de balance).
- Próximo: veredito do CD no navegador; depois T-008b.

## 2026-07-04 — Sessão 3 (docs): continuidade entre sessões e modelos
- Evoluída a documentação para memória institucional: `DOC_MAP.md` (quando ler o quê), `SESSAO_ATUAL.md` (ponteiro substituído a cada sessão), `VISAO-ATUAL.md` (snapshot estável do marco), `mechanics/PLAYER_LOOP.md` (FAQ gameplay com números), `QA.md` (matriz automático vs manual + checklist merge).
- Decisão de arquitetura doc: **dois arquivos** — VISAO (fase/milestone, muda pouco) + SESSAO (fio imediato, muda sempre). Conflito: SESSAO vence para próximo passo; código vence para comportamento.
- Atualizados `AGENTS.md`, `instrucoes/COMO_CONTINUAR.md`, `REGRAS_DE_PROMPT.md` (veredito CD no template PROMPT).

## 2026-07-04 — Sessão 3 (bugfix pós-teste): respawn e hitbox
- Relato do CD após teste manual: depois de matar outro player, houve dúvida se o respawn era aleatório/seguro e o tiro pareceu não acertar novamente após o respawn.
- Diagnóstico: respawn era sorteado entre spawns safe, sem avaliar distância de outros players; além disso, dano em safe zone era bloqueado silenciosamente, parecendo falha de hitbox. A colisão do projétil também testava só a posição final do tick.
- Correções: respawn agora escolhe o spawn com melhor distância/risco, zera input/tiro ao renascer, projétil usa colisão por segmento contra o player, tiro bloqueado por safe zone consome o projétil e emite evento `safe_block`, e vitalidade agora recalcula `maxHp`.
- Verificado: typecheck limpo em server/client/bots e 10/10 testes do shared.

## 2026-07-04 — Sessão 3 (retomada): T-007
- Modo debug dinâmico fechado para teste: overlay F3 com snapshot vivo de sala/player/todos os players, feed de eventos, botão de fechar e histórico local.
- Servidor expõe `/debug/rooms` com salas ativas, mapa, budget, projéteis e ring buffer dos últimos eventos; eventos `spawn`, `pickup`, `hit`, `death` e `disconnect` entram no buffer e só são enviados por WebSocket com `DEBUG=1`.
- Bots ganharam `BOT_VERBOSE=1` para logar decisão de alvo/caminho e consomem `debug_event` sem poluir o terminal quando `DEBUG=1`.
- Verificado: typecheck limpo em server/client/bots e 10/10 testes do shared. Próximo: T-008 (Bots de combate).

## 2026-07-04 — Sessão 3 (cont.): T-006
- Morte, respawn e perda de nível.
- ProjectileSystem agora retorna as mortes confirmadas para o `ArenaRoom`.
- Vítimas perdem nível usando curva logarítmica (protege iniciantes) e respawnam num random `spawnPoints`. Seus status são resetados via nova função `resetAttrToLevel` no EffectSystem.
- Assassinos ganham XP (`XP_PER_KILL_PER_LEVEL * victim.level`).
- Kills e deaths agora são gravadas nas métricas (`SessionMetrics`).
- Próximo: T-007 (Modo debug dinâmico).

## 2026-07-04 — Sessão 3 (cont.): T-005
- Lançadores v1: tiro reto.
- Adicionado input via mouse (raycaster) e state handling (hp, maxHp) no client e server.
- ProjectileSystem implantado no servidor validando cooldown, fire ranges e colisões de projétil (com map bounds, walls, props e jogadores). Zonas safe proíbem tiro e bloqueiam dano.
- Hud exibe HP atual.

## 2026-07-04 — Sessão 3 (cont.): T-004b
- Scaffold de progressão persistente (ADR-012) implementado: `playerToken` salvo no localStorage e enviado no join.
- Servidor mapeia token num `memDB` indexado mantendo `PersistentProgress` (força, velocidade, vitalidade) que é atualizado na coleta da box.
- Verificado: tsc limpo, localStorage funciona, progresso persiste no servidor. Detalhe em PROMPT-0008.md.
- Próximo: T-005 (Lançadores v1: tiro reto).

## 2026-07-04 — Sessão 3 (cont.): T-004
- Coletáveis expandidos: xp_orb, speed_up, coin_buff (campo), farm_event/box (só zona de guerra, já raros de graça pelo tamanho da zona). Zona safe ganhou supressão de spawn própria.
- farm_event reusa EffectSystem (`xp_boost`); box dá bônus de atributo 3× maior; coins compram reroll da distribuição de atributos.
- Métricas passam a registrar pickups por kind.
- Verificado: testes 5/5, tsc limpo, 4 bots mostraram os 4 kinds de campo/guerra nas métricas (incl. 1 farm_event). Detalhe em PROMPT-0007.md.
- Aprendizado: dois `tsx watch` concorrentes brigando pela porta 2567 travaram o servidor em loop de crash — sempre `pgrep -af "src/index.ts"` antes de investigar erro de conexão.

## 2026-07-04 — Sessão 3 (cont.): T-003
- XP/nível via curva (`xpToNext`), atributos força/velocidade/vitalidade como segunda camada do EffectSystem existente (mesmo `recompute()`, preset equilibrado: 1 ponto em cada por nível, +4%/ponto).
- Primeiro teste unitário do projeto (vitest, `constants.test.ts`) — dívida registrada em LEAD_DESIGNER_NOTES começou a ser paga.
- Verificado: `npm run test` 3/3, tsc limpo, bots mostram nível subindo pela curva e atributo de velocidade refletido em `speed` independente do speed_up temporário. Detalhe em PROMPT-0006.md.
- Próximo: T-004 (coletáveis expandidos).

## 2026-07-04 — Sessão 3 (cont.): T-002
- Props ganharam pré-modelos F2 (pedra/árvore/caixa/muro/bandeira) compostos de primitivas em `visuals.ts`. Técnica: 1 InstancedMesh por parte-tipo (não por instância) — mantém draw calls baixos mesmo com composição.
- Verificado via preview (screenshot): zona safe pintada + pedra/caixa/muro distintos; bots sem regressão. Detalhe em PROMPT-0005.md.
- Próximo: T-003 (XP/nível/atributos).

## 2026-07-04 — Sessão 3: T-001 (backlog)
- Pivô ADR-010 executado: labirinto (pilares em coord. pares) → campo aberto. Só borda colide; props (~4%, pedra/árvore/caixa/muro) nascem isolados uns dos outros — garante 0 regiões fechadas sem precisar de checagem de conectividade em runtime.
- Zonas safe/guerra/campo derivam do seed (`zoneAt`), cliente pinta o chão sem tráfego extra na rede.
- Verificado: 4 seeds sem tile fechado (flood fill 100%), 0 props perto de spawn, densidade exata; bots BFS seguem coletando (níveis 2→5 em 15s); tsc limpo. Detalhe em `docs/prompts/PROMPT-0004.md`.
- Próximo: T-002 (pré-modelos visuais dos props).

## 2026-07-04 — Sessão 2: M0.5 (SPEC-0002)
- Mapa dinâmico 75×65 mín. (ADR-007), gerado por seed sincronizado; câmera follow + fog + grid ("indo longe").
- EffectSystem (ADR-009): coletável speed_up ×1.5/8s com teto 2×; arquitetura pronta p/ skills.
- Sinalização de inimigos (anéis) + roster HUD; visuals.ts com fases (ADR-008); pasta instrucoes/; log de prompts (docs/prompts/).
- Bots ganharam BFS — no mapa grande, sem pathfinding = 0 coletas; com BFS = 3.7 coletas/bot em 15s. ✅ verificado headless.
- Aprendizado sandbox: processos de fundo persistem entre execuções (porta 2567 fantasma) — usar PORT alternativa p/ testes.

## 2026-07-04 — Sessão 1: fundação
- Framework do estúdio criado (AGENTS.md, constituição, ADRs 001–006, roadmap, specs, notas CD/IA).
- Monorepo TS: `shared` (mapa, constantes, protocolo), `server` (Colyseus, tick 20Hz, autoritativo), `client` (Three.js top-down, HUD ping/nível), `bots` (headless).
- M0: arena 15×13 com pilares estilo Bomberman, movimento com colisão no servidor, coletáveis spawnam longe de jogadores (ADR-006), coleta sobe nível, métricas de sessão em `packages/server/logs/sessions.jsonl`.
- Verificação ✅: 3 bots headless em 1 sala por 12s — movimento ok (~26u de distância média), coletas ok (bot-1 chegou ao nível 4), `sessions.jsonl` gravado, `/metrics/summary` agregando. Cliente compila em 145KB gzip.

**Aberto:** combate (M1), regra final de perda de nível, controle touch.
