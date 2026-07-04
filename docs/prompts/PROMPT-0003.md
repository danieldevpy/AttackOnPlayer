# PROMPT-0003 — Combate, mapa aberto, crescimento, backlog em tasks · 2026-07-04

## Pedido (resumo fiel do CD)
1. **Lançadores:** o personagem não dispara nada ainda. Terá diversos objetos lançáveis com diferentes formas, velocidades e atributos do "lançador". Mecânica central: acertar o objeto em outra pessoa. Começa "tiro reto" mas deve evoluir para outros efeitos, distâncias, modos, skills — de forma escalável e documentada/conversada.
2. **Pivô do mapa:** sair dos blocos estilo Bomberman → campo aberto com objetos de cenário ("pré-modelos"): colidíveis, coletáveis, áreas de "guerra", áreas "safe", mapa dinâmico.
3. **Coletáveis diversos:** "farm simples" (evento que dá mais XP), buffs de coins, box com skill + pontos (referência: reset de MU).
4. **Crescimento:** evoluir atributos por XP — sistema controlável e escalável, "não ser tudo um atributo só".
5. **Debug:** modo dev cada vez mais eficiente para debugar eventos e respostas dinamicamente.
6. **Processo:** desenvolver a partir de agora em TASKS — o CD executa uma a uma no seu tempo, controlando tokens. Resumo geral da sessão de ideias para poder recomeçar depois. Feedback de arquitetura.

## Decisões tomadas
- CD: tudo acima como direção.
- IA (ADR-010): pivô para campo aberto mantém grid de colisão, seed sync e spawner — só a GERAÇÃO muda. Custo baixo, valida a arquitetura.
- IA (ADR-011): lançadores 100% data-driven (`LauncherDef` em shared) — arma nova = entrada nova no registro, zero mudança de engine.
- IA: backlog em `docs/BACKLOG.md` com contexto de leitura por task (controle de tokens).

## Pontos levantados pela IA que PRECISAM de decisão do CD (antes das tasks correspondentes)
1. **Box estilo "reset de MU" implica progresso permanente entre partidas** — hoje a constituição diz progressão por partida (2–3 min). Opções: (a) box dá skill+pontos só do round; (b) criar camada meta-progressão permanente (muda a constituição). → decidir antes da T-004.
2. **Coins:** o que compram? Loja entre rounds? Cosmético? → decidir antes da T-004 (pode entrar como moeda acumulável sem uso primeiro).
3. **Perda de nível ao morrer** (pendente desde PROMPT-0001) → decidir na T-006.

## Resultado
Sem código nesta leva (por design): SPEC-0003 rascunho, ADR-010/011, docs de mecânica (combate, mundo, crescimento, debug), BACKLOG com 9 tasks, VISAO-ATUAL.md (resumo para recomeço), feedback de arquitetura em LEAD_DESIGNER_NOTES.

## Regras que nascem daqui
- **Desenvolvimento por tasks:** cada prompt de implementação = "Executar T-0XX do docs/BACKLOG.md". A IA lê SÓ o contexto listado na task.
- Toda ideia de mecânica nova entra primeiro em doc/spec, nunca direto em código.

## Pendências para o próximo prompt
Executar T-001 (pivô mapa aberto). Decidir os 3 pontos acima quando as tasks chegarem neles.
