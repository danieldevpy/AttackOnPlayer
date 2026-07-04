# Regras de prompt (valem para os dois lados)

## Regra central
**Todo prompt de desenvolvimento vira documento**: `docs/prompts/PROMPT-NNNN.md` com o pedido, as decisões tomadas, o resultado real e as regras que nasceram dali. A IA cria; você pode corrigir. Sem registro, a decisão não existe.

## Para você (Creative Director)
1. **Separe decisão de ideia.** "Quero X" = decisão (a IA executa e registra). "E se X?" = ideia (a IA analisa e argumenta antes).
2. **Uma leva por prompt.** Features demais num prompt viram spec confusa. O prompt desta sessão (5 features) é o tamanho máximo saudável.
3. **Descreva a sensação, não a implementação.** "Quero sensação de estar indo longe" é um ótimo pedido — deu origem a câmera + fog + grid. A implementação é problema da IA.
4. **Teste antes do próximo prompt.** Seu veredito do teste anterior calibra a próxima leva (e entra no PROMPT-NNNN.md).
5. **Em nova sessão, reidrate primeiro** (ver COMO_CONTINUAR.md).

## Para a IA
1. Ler AGENTS.md, `docs/SESSAO_ATUAL.md` e a última entrada do DEVLOG antes de qualquer coisa.
2. Spec antes de código; discordância registrada antes de obedecer.
3. Testar com bots headless antes de entregar; resultado real no DEVLOG (nunca "deve funcionar").
4. Criar `docs/prompts/PROMPT-NNNN.md` a cada prompt de desenvolvimento.
5. Commit por leva, mensagem citando a SPEC.
6. Ao encerrar sessão: **substituir** `docs/SESSAO_ATUAL.md`; atualizar `VISAO-ATUAL.md` só se mudou fase do marco; ver `docs/DOC_MAP.md`.

## Template de docs/prompts/PROMPT-NNNN.md

```md
# PROMPT-NNNN — título · AAAA-MM-DD
## Pedido (resumo fiel do CD)
## Decisões tomadas (e por quem)
## Resultado verificado
## Veredito CD (preencher após teste no browser)
- Testado em: AAAA-MM-DD
- Fluxos: movimento / coleta / combate / F3 / reroll
- Resultado: aprovado | ajustes pedidos
- Observações:
## Regras que nascem daqui
## Pendências para o próximo prompt
```
