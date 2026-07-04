# PROMPT-0022 — T-016: Cards de level-up (escolha manual v2) · 2026-07-04

## Pedido (resumo fiel do CD)
Continuação da execução da SPEC-0004 (PROMPT-0020/0021). Esta leva: T-016.

## Decisões tomadas (e por quem)
- CD (via SPEC-0004): level-up gamificado por cards, timeout 5s, jogo nunca pausa, cards determinísticos.
- IA: **pool de 6 cards** em `shared/constants.ts` (`UPGRADE_CARD_POOL`), todos valendo `UPGRADE_CARD_POINTS = 3` (mesma soma do preset antigo — curva de poder total inalterada, muda a concentração). Oferta = janela determinística de 3 sobre o pool (`upgradeCardsForLevel`, offsets 0/2/4 mod 6 — sempre distintos).
- IA: **servidor valida tudo** (`choose_upgrade`): oferta aberta + card pertencente à oferta do nível; inválido é ignorado SEM consumir a oferta. Timeout resolvido no `update()` com `UPGRADE_AUTO_PICK` (equilibrado 1/1/1 — quem ignora o menu evolui igual à v1).
- IA: **fila de ofertas** (`pendingUpgrade: Map<id, {levels[], expiresAt}>`): vários level-ups de uma vez viram fila; `Player.pendingUpgrades` sincronizado dá o badge no HUD. Morte apaga a fila (níveis já foram perdidos); onLeave limpa.
- IA: **confirmação é a fonte da verdade**: cliente só esconde os cards ao receber `upgrade_applied` (com `auto: boolean` para diferenciar timeout de escolha). Evento `upgrade` no feed do F3.
- IA: **`hud.ts` extraído** de `main.ts` (paga a dívida registrada em LEAD_DESIGNER_NOTES) — HUD, roster e cards; `main.ts` só encaminha teclas 1/2/3 (`chooseUpgradeByIndex`, consome a tecla apenas com oferta aberta). Barra de tempo via CSS transition (zero JS por frame).
- IA: **bots** respondem `upgrade_offer` com o card `equilibrado` (auto-pick explícito, delay 150–400ms) — política por perfil fica para a T-008b, como previsto na spec.
- IA: `grantXp` não aplica mais preset direto — todo ponto de nível passa pelos cards (auto-pick cobre AFK/bots). `ATTR_POINTS_PER_LEVEL_EACH` continua usado só no `resetAttrToLevel` (preset pós-morte).

## Resultado verificado
- Testes novos em `shared/constants.test.ts`: determinismo + 3 cards distintos por nível (40 níveis), soma de pontos de cada card do pool = 3, auto-pick = preset equilibrado.
- ⚠️ Gates de execução pendentes de runtime (mesma limitação da leva; ver PROMPT-0020). Fluxo de rede (oferta→escolha→aplicação) é exercitado por bots quando os gates rodarem (`npm run bots` já cobre level-up em massa).
- Revisão estática: mensagens novas registradas nos 2 consumidores (cliente e bots) — sem warning de onMessage não registrado; `xpToNext`/`roster` órfãos removidos de `main.ts`.

## Regras que nascem daqui
- Toda mensagem nova do servidor precisa de handler registrado no **cliente E nos bots** na mesma entrega (colyseus.js loga warning e o fluxo fica surdo).
- Escolha inválida nunca consome recurso/oferta — validação server-side silenciosa (não dar feedback a cliente malicioso).
- UI de escolha nunca pausa o jogo; confirmação visual só depois do servidor confirmar (`upgrade_applied`).

## Pendências para o próximo prompt
- Rodar gates quando houver runtime; smoke com 4 bots (fila de ofertas sob level-up rápido).
