# PROMPT-0020 — T-014: Rebalance TTK — dano base e relatório · 2026-07-04

## Pedido (resumo fiel do CD)
Executar a SPEC-0004 inteira (T-014..T-018), sem interrupção, mantendo o contexto de continuidade atualizado a cada etapa para a sessão poder ser retomada sem quebrar o jogo. Esta leva: T-014.

## Diagnóstico
TTK matematicamente constante (10 tiros em qualquer nível) — força e vitalidade escalam na mesma taxa. Detalhe completo em `docs/proposals/PROPOSAL-0001-skills-atributos-escala.md` §1.

## Decisões tomadas (e por quem)
- CD (via SPEC-0004): TTK alvo = 5 tiros em níveis iguais sem especialização.
- IA: `basic_shot.damage` 10 → **20**; `heavy_shot_dev` 14 → **28** (mantém a proporção 1.4× — é dev-only, mas deixá-lo defasado criaria falso resultado em teste manual de mobilidade).
- IA: teste do server deixou de fixar "≥10 acertos" e passou a **derivar** o esperado dos dados reais (`Math.ceil(100 / LAUNCHERS.basic_shot.damage)`), com uma guarda explícita `expectedHits === 5` que quebra se alguém mudar o dano sem atualizar a spec/ADR-013 — balance vira contrato testado.
- IA: relatório de balance em `docs/ai/balance-T014-ttk.md` com o TTK teórico preenchido e a seção de medição por bots marcada como pendente (ver Resultado abaixo), incluindo os comandos exatos para preencher.

## Resultado verificado
- **Limitação de ambiente (registrar, não esconder):** a sessão rodou num sandbox com rede intermitente e sem runtime Node pré-instalado; a instalação do toolchain ficou em andamento durante a implementação. Verificação estática feita com rigor (mudança é 2 números + 1 teste); gates automáticos (`npm run test`, vitest server, tsc, bots) devem rodar assim que houver runtime — registrados como pendência explícita no fim da leva (ver SESSAO_ATUAL).
- Análise estática: nenhuma outra referência a dano hardcoded no repo (`grep` por `damage` cobre launchers/projectiles/testes); o dano flui só via `LAUNCHERS[...].damage × strength`.

## Regras que nascem daqui
- Números de balance com alvo definido em spec ganham **guarda em teste** (ex.: `expectedHits === 5`): mudar o número exige mudar a spec junto — o teste é o lembrete.
- Passe de balance sem medição real é *metade* de um passe: o relatório fica com a seção "medido" pendente e a task só fecha de verdade quando os números reais entrarem (`docs/ai/balance-T014-ttk.md`).

## Pendências para o próximo prompt
- Rodar os gates + 10 partidas de bots e preencher a seção "TTK medido" do relatório.
