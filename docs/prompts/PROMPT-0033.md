# PROMPT-0033 — Feedback de jogo do CD: progressão de skill/atributo + bug do menu de level-up · 2026-07-05

## Pedido (resumo fiel do CD)
Depois de jogar com os ajustes da T-021/T-008b (PROMPT-0032) já aplicados por conta própria, o CD trouxe 2 pontos direto do jogo, sem task de backlog associada:
1. Skill demora demais pra aparecer (às vezes só no nível 11); quando aparece, quer a composição invertida — 2 cards de atributo + 1 de skill, não o contrário.
2. Quer os cards de atributo dando um valor maior por escolha (ex.: "em vez de +3, já dá +6").
3. (Achado em jogo, reportado depois): se o jogador morre com o menu de escolha de level-up aberto na tela, o menu não fecha — mesmo não servindo mais pra nada.

## Decisões tomadas (e por quem)
- **`UPGRADE_CARD_POINTS` dobrou (3→6)** — todo card do pool (`packages/shared/src/constants.ts`) tem o dobro: `+6 Força`, `+6 Vitalidade`, `+6 Agilidade`, `+4 Cadência +2 Alcance`, `+4 Alcance +2 Cadência`, `+2/+2/+2` (equilibrado). `ATTR_POINTS_PER_LEVEL_EACH` (usado por `resetAttrToLevel` na morte) acompanhou 1→2 pra manter a invariante já existente no código: o preset "equilibrado" pós-morte precisa refletir o mesmo ganho por nível de quem sempre escolheu o card equilibrado.
- **Marcos de skill foram de 3 esparsos (4/8/12) pra 5, um por skill existente (3/6/9/12/15)** — com só 3 marcos era matematicamente impossível pegar as 5 skills numa run (`SKILL_MILESTONE_LEVELS` em `packages/shared/src/skills.ts`). Cada marco agora aponta pra **uma** skill fixa (`SKILL_MILESTONE_SKILL`, não mais um par de escolha) — decisão consciente: a composição pedida (2 atributo + 1 skill) só faz sentido com 1 slot de skill por marco, não 2. Perder a skill do marco (timeout/AFK) não é revisitado — próximo marco custa 3 níveis, não 8 como antes.
- **`ArenaRoom.buildCards`** simplificado: nos marcos, monta `[skillCard, attrCards[0], attrCards[1]]` em vez de `[skillA, skillB, attrCards[0]]`. Skill já possuída (ex.: reroll de perfil, ou jogador raramente repetindo marco) cai pra próxima que falte; sem skill faltando, volta a ser só atributo.
- **Guard-tests de balance recalculados, não só ajustados por tentativa e erro:** o teste "full-Força nível 8 mata equilibrado em 3 tiros" (`effects.test.ts`) documentava a matemática original (21 pts de força pura em 7 level-ups × 3). Com o dobro, são 42 pts — só que 42 já estoura o teto de força (`max: 3.0`, atingido a partir de ~34 pts), então o teste virou também um teste do anti-snowball. Refiz a conta do zero (não só troquei os números) e confirmei: ainda mata em 3 tiros (equilibrado vs. equilibrado ainda em 5, TTK alvo preservado) — coincidência boa, não differentemente pretendida, mas verificada.
- **Bug do menu travado — causa raiz:** na morte, o servidor sempre limpou a oferta pendente (`this.pendingUpgrade.delete(id)`) mas nunca avisou o cliente disso. A única forma da HUD fechar o menu era receber `upgrade_applied` (escolha manual ou timeout de 5s server-side) — a morte pulava esse caminho inteiro. Corrigido com uma mensagem nova e específica: se havia oferta pendente (`Map.delete` retorna `true`), o servidor manda `upgrade_offer_closed` pro cliente antes do respawn. Cliente ganhou `closeUpgradeOffer()` em `hud.ts` — fecha sem o flash "✔ card aplicado" (nenhuma escolha foi feita, seria enganoso mostrar isso).

## Resultado verificado
- **Gates:** shared 13/13 · server 25/25 · bots 24/24 · `tsc --noEmit` limpo em server/bots/client.
- **Smoke end-to-end real #1 (economia de cards):** cliente colyseus.js real, XP passivo até nível 3 — nível 2 mostrou os 3 cards de atributo com os valores dobrados certos; nível 3 (novo marco) mostrou exatamente `[★ Tiro Duplo, +4 Cadência/+2 Alcance, +2/+2/+2 equilibrado]` — a composição pedida, confirmada em servidor de verdade, não só em teste unitário.
- **Smoke end-to-end real #2 (fechar no morte):** 2 clientes reais (um "vítima" parada ganhando XP passivo, um "atacante" perseguindo e só disparando quando a oferta de level-up da vítima estava aberta, pra garantir que a morte acontecesse dentro da janela de 5s) — log confirmou: oferta abriu → morte aconteceu com a oferta ainda aberta (`offerOpen=true`) → `upgrade_offer_closed` chegou imediatamente depois, e um marco seguinte se comportou normalmente (auto-pick no timeout) — nenhuma regressão no fluxo padrão.

## Regras que nascem daqui
- **Mudança de balance em constante compartilhada (`UPGRADE_CARD_POINTS`, `ATTR_POINTS_PER_LEVEL_EACH`) exige recalcular — não só reescalar — qualquer guard-test que documente números absolutos.** Esses testes existem exatamente pra pegar esse tipo de mudança; quando o número muda de propósito, o teste vira `git diff` de intenção, e o CD/próxima sessão consegue ler o "antes/depois" direto no diff.
- **Estado server-only que expira/é descartado silenciosamente (timeout, morte, desconexão) precisa de uma notificação explícita ao cliente quando existe UI local esperando por uma resposta.** O padrão vira: toda vez que uma oferta pendente é abandonada sem passar por `resolveUpgrade`, mandar um "fechamento" dedicado — não reaproveitar `upgrade_applied` (que implica escolha feita).

## Pendências para o próximo prompt
- Nenhuma pendência de código: os dois pontos foram resolvidos e verificados ao vivo.
- Calibração fina do novo ritmo de skill (3/6/9/12/15) e do valor dobrado dos cards é chute inicial validado por sensação de jogo — T-026/telemetria confirma com dados quando existir.
- Fila da V1 segue parada na T-022 (VFX nomeados) — CD pediu alinhamento do estado atual do projeto antes de retomar.
