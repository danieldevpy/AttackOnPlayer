# PROMPT-0041 — 3 correções antes do backlog: bandeira, SPEC-0010, cards · 2026-07-06

## Pedido (resumo fiel do CD)
"Quero fazer umas correções antes das próximas tasks. 1. A bandeira que fica parada no mapa deve
ter o estado de enable/disable baseado em alguém pegar ou estar em cooldown ou 'pegavel'. 2.
Verificar a spec 10 se já está funcional, teste também. 3. Tem que ter mais variações para 'upar'
attributos e ser mais sortido para não ficar sempre repetitivo."

## Decisões tomadas (e por quem)
- **Bandeira (item 1) — já implementado, não era bug (IA):** T-041/T-042 (SPEC-0011, sessão 19) já
  cobrem exatamente os 3 estados pedidos (livre=acesa pulsante/pegável, carregada=apagada,
  cooldown=some/impossível de pegar). Revisão de código não achou divergência. Adicionei uma
  linha de estado no overlay F3 (`bandeira: livre (pegável) | carregada por X | cooldown (fora do
  mapa)`) — dá um jeito de CONFIRMAR o estado por texto, já que o ambiente desta sessão não
  consegue renderizar o canvas WebGL pra um screenshot de verdade (ver seção de veredito abaixo).
- **SPEC-0010 (item 2) — confirmado funcional via smoke ao vivo (IA):** rodei 8 bots por 100s
  contra um servidor isolado, com polling do `/debug/rooms` a cada 13s (472 eventos únicos).
  `kill_heal`/`kill_duel_bonus` bateram com a fórmula exata da spec; `hp_orb`/`shield_temp`
  respeitaram teto e janela de respawn. Redução de dano do escudo já tinha teste unitário
  dedicado (`projectiles.test.ts`), não precisei reescrever.
- **Cards de level-up (item 3) — reversão consciente de um princípio anterior (IA registra a
  tensão, mas segue a instrução explícita do CD):** T-016/SPEC-0004 tinha decidido "determinístico,
  nunca sorteio" (habilidade > sorte). O CD pediu o oposto agora — variedade e sorteio contra
  repetição. Implementado: pool de 6→12 cards (`UPGRADE_CARD_POOL` em `constants.ts`, agora com
  cards puros de Cadência/Alcance que não existiam, + 4 combos novos: `fera`, `muralha`,
  `cacador_furtivo`, `sobrevivente`) e `upgradeCardsForLevel` virou sorteio de 3 distintos a cada
  level-up (não mais janela fixa por `level % 6`). A ESCOLHA dentro da oferta continua do jogador
  — só o menu que aparece é aleatório, como um loot pool de roguelike. `UPGRADE_AUTO_PICK` agora
  busca por id (`"equilibrado"`) em vez de índice fixo, já que a posição no pool não é mais
  estável. Perfis de bot (T-008b) ganharam `preferredCardIds` extras cobrindo os cards novos, pra
  não perderem identidade de build com um pool maior e aleatório.

## Resultado verificado
- **Testes:** shared **30/30** (2 testes novos substituindo a asserção de determinismo por
  asserções de variedade/validade), server **49/49**, bots **35/35** (perfis com preferência
  estendida, `pickCard` sem mudança de assinatura). `tsc --noEmit` limpo em server/client/bots.
- **SPEC-0010:** ver acima — funcional, com números batendo a fórmula da spec ao vivo.
- **Bandeira:** código revisado sem bug encontrado; F3 ganhou linha de estado textual. **Não
  consegui** um screenshot pixel-a-pixel do estado visual nesta sessão — diagnóstico exato: o
  preview roda com `document.hidden === true`, então o `requestAnimationFrame` do loop `animate()`
  em `main.ts` nunca dispara (comportamento padrão de browser pra página não visível ao
  compositor) — mesma limitação já registrada em `LEAD_DESIGNER_NOTES.md` (2026-07-05), agora com
  causa raiz confirmada em vez de suposição.
- **Infra de verificação (efeito colateral útil):** `.claude/launch.json` ganhou `server-verify`
  (porta 2604) e `client-verify` (porta 5299) — servidores isolados pra testar sem disputar porta
  com a sessão paralela `aci` (2567/5173 ocupadas). Cliente ganhou override `?port=NNNN` (dev-only,
  só em localhost) pra apontar pra um servidor numa porta alternativa.

## Regras que nascem daqui
- **Cards de level-up: "sorteio na oferta" ≠ "sorteio no poder".** Documentado pra não confundir
  com RNG de build em discussões futuras — a escolha final continua 100% do jogador.
- **Preview headless deste ambiente não sustenta o loop de render** (página não-visível pausa
  `requestAnimationFrame`) — qualquer verificação visual de UI/3D precisa ser feita pelo CD num
  browser de verdade; a IA pode (e deve) adicionar pontos de verificação textual (F3, logs) como
  substituto parcial, mas não deve reivindicar veredito visual que não pôde observar.

## Veredito CD
- Confirmado em: 2026-07-06 (via chat, não teste em browser — ambiente ainda sem verificação visual real)
- Escopo: os 3 itens deste prompt (bandeira, SPEC-0010, variedade de cards)
- Resultado: **aprovado sem ressalvas** ("estou de acordo com tudo")
- Observações: a bandeira e a sensação dos cards sorteados não foram jogadas de fato (pendência
  técnica: preview headless não renderiza WebGL, ver acima) — o CD aprovou pela implementação e
  explicação, não por ter visto/jogado. Se ao jogar de verdade algo destoar (bandeira ou variedade
  de cards "demais"), é reabertura, não reversão de decisão.

## Pendências para o próximo prompt
- Retomar a fila V1: F4 — Plataforma (SPEC-0008), começando por T-026 (telemetria NDJSON).
