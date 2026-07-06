# PROMPT-0044 — PROPOSAL-0004: som, personagens/classes e lobby · 2026-07-06

## Pedido (resumo fiel do CD)

Quatro frentes para ainda entrar na V1: (1) sistema de som (coletáveis, disparos, eventos); (2) sistema de personagem/classe/skin começando simples — 1 classe `archer`, modelo low poly **procedural direto no Three.js** (referência: imagem enviada pelo CD com arqueiro por composição de primitivas + animações por keyframe), com projéteis próprios da classe; (3) analisar e finalizar integração com backend — métricas, ranking, KDA, settings do player, nicks, eventos, salas, tudo operável no admin; (4) janela pré-sala com info do usuário, settings e seleção de personagem, com o mínimo de passos. Extra opcional/futuro: (5) console de staff para configurar o jogo ao vivo. Pedido explícito: plano organizado para execução **agêntica com modelos inferiores**, sem quebrar o projeto, + arquivo orientando qual modelo Claude usar por task.

## Decisões tomadas (e por quem)

- **CD:** som procedural/WebAudio na V1 (zero assets; registry aceita arquivos depois).
- **CD:** tasks já entram no BACKLOG junto da proposal (aprovação implícita no pedido).
- **IA:** frentes disjuntas espelhando o padrão da F2.6 (paralelizável entre frentes, série dentro); contrato antes de consumidor; só T-052/T-059 tocam schema (concentram o risco em prompts de modelo forte); personagens sobem F1→F2 conforme ADR-008 ("quando o CD pedir" — pediu).
- **IA:** console staff (T-063) fica fora do caminho crítico do T-032.

## Resultado verificado

- `docs/proposals/PROPOSAL-0004-som-personagens-lobby.md` (plano completo, riscos, ordem/paralelismo).
- `docs/BACKLOG.md`: seção nova com T-049..T-063 + T-D13/D14/D15 (specs), dependências anotadas.
- `instrucoes/GUIA_MODELOS_CLAUDE.md`: alocação Haiku/Sonnet/Opus/Fable por task + template de prompt + sinais de escalada.
- Sessão de design — **zero mudança de código**; gates não aplicáveis. `npm run aci -- index` rodado ao final.

## Regras que nascem daqui

- Tasks marcadas **⚠schema** no BACKLOG nunca vão para modelo abaixo de Opus.
- Toda frente nova começa pela task de contrato/registry; consumidores nunca redefinem contrato.
- Prompt para modelo menor sempre inclui as cercas do template do GUIA_MODELOS_CLAUDE.md.
