# PROMPT-0030 — T-008b: personalidade nomeada, política de cards e boss · 2026-07-05

## Pedido (resumo fiel do CD)
Continuação da execução autônoma sequencial da V1 — `Executar T-008b` após a T-020, sem pausar para aprovação.

## Decisões tomadas (e por quem)
- **Perfis nomeados** (`packages/bots/src/ai/personality.ts`, `BOT_PROFILES`): `agressivo`/`cauteloso`/`cacador`/`equilibrado`, cada um combinando um vetor `Personality` (como o bot decide/luta) com uma `CardPolicy` (como o bot constrói) — substitui de vez a ponte `PERSONALITY_BY_SKILL` da T-020. Sorteados por bot (`BOT_PROFILE` env fixa um para todos, se precisar reproduzir).
- **Política de cards determinística** (`pickCard`): cada perfil tem uma lista ordenada de ids preferidos do `UPGRADE_CARD_POOL` (bruto=Força→Cadência, tanque=Vitalidade→Agilidade, caçador=Alcance→Agilidade, equilibrado=card `equilibrado`); escolhe o primeiro presente na oferta do nível, nunca sorteia — é o que torna o build do bot **observável e explorável** (habilidade > sorte, mesmo pilar dos cards humanos da T-016). Sem nenhum preferido na oferta (marco de skill), cai no primeiro card ofertado — nunca trava a escolha.
- **Boss é autoridade de SERVIDOR, não do bot:** `ArenaRoom.onJoin` ganhou `options.boss?: boolean`; quando true, `initBoss(id, p)` sorteia nível 6–8 (`BOSS_LEVEL_MIN/MAX`, novos em `shared/constants.ts`), aplica um card CONCENTRADO (não-equilibrado, sem skill) repetido `nível−1` vezes via `EffectSystem.addAttrPoints` (build concentrada de verdade, nunca espalhada) e concede 1 skill de marco (nível 4, que o boss já "passou" ao nascer alto). O bot só pede `boss: true` no join — os números reais nascem no servidor, consistente com "servidor autoritativo" (AGENTS.md). `BOSS_PROFILE` no cliente é só o comportamento (agressivo, quase não foge).
- **`isBossIndex`/`BOT_BOSS=1`:** flag de smoke/teste manual — marca o bot de índice 0 como boss numa sessão de bots headless.

## Resultado verificado
- **Gates:** shared 13/13 · server 19/19 · **bots 17/17 (11 anteriores + 6 novos de `pickCard`)** · `tsc --noEmit` limpo ×3 · guarda `.js` órfão sem saída.
- **Achado de infraestrutura durante a verificação:** depois de isolar esta sessão num worktree (`.claude/worktrees/v1-continue`, ver nota abaixo), o `preview_start` continuou iniciando o servidor no diretório ORIGINAL (compartilhado com a outra sessão concorrente), não no worktree — confirmado via `/proc/<pid>/cwd` do processo ouvindo a porta 2567. Como resultado, os primeiros testes do boss "falhavam silenciosamente" (server rodando código antigo, sem o `boss` handling). Resolvido subindo o servidor manualmente via Bash a partir do worktree correto. **Lição: com sessão em worktree, não confiar no `preview_start`/`preview_*` para o processo do servidor — usar Bash direto e checar `/proc/<pid>/cwd` se o comportamento parecer "código antigo".**
- **Smoke real (`BOT_VERBOSE=1 BOT_BOSS=1 npm run bots -- 4 20`, servidor correto):** boss (perfil `agressivo` + `boss:true`) nasceu nível 6, terminou o teste ainda vivo no nível 6 com 27 tiros, 197 ticks engajado e distância mínima de 0.2u contra os outros 3 bots (perfis `equilibrado`/`equilibrado`/`cacador` sorteados) — ameaça real e visível, exatamente o critério de aceite. Log do servidor confirmou `[BOSS]` na entrada.
- **Achado de higiene:** o `package-lock.json` do commit da T-020 (feito antes do isolamento em worktree) carregava uma referência órfã a `packages/aci` — vazamento do `npm install` ter rodado num diretório então compartilhado com a sessão concorrente do ACI. Corrigido num commit dedicado (`fix: remove referência órfã...`) antes de continuar a T-008b.

## Regras que nascem daqui
- **Perfil de bot = dado em `personality.ts` (Personality + CardPolicy), nunca um novo `if` em `bot.ts`.** Confirmado na prática: T-008b não tocou `decision.ts`/`steering.ts`/`humanizer.ts`.
- **Boss (ou qualquer stat/nível/skill inicial não-padrão) é sempre decidido pelo servidor**, mesmo quando quem pede é "só um bot" — o cliente nunca é a fonte de verdade de progressão, nem para bots.
- **Trabalhando em worktree isolado: verificar com Bash puro, não com as ferramentas `preview_*`**, até confirmar que elas seguem o `cwd` do worktree (não seguiam nesta sessão).

## Pendências para o próximo prompt
- Próxima task da fila: **T-021** — bandeira "rei do mapa" (2×XP/s, glow global, toggle por room). Quando ela existir, `disputar_bandeira` finalmente ganha dado real para entrar em `decision.ts` (hoje de propósito fora, ver PROMPT-0029).
- Veredito do CD jogando contra o boss (a métrica automática mede "ameaça" por tiros/engajamento/sobrevivência; "ameaça sentida" é do CD).
