# PROMPT-0005 — T-002: pré-modelos de props (fase F2) · 2026-07-04

## Pedido (resumo fiel do CD)
"Agora execute sequencialmente as tarefas até terminar essa spec" — continuar o backlog a partir de T-002, sempre commitando por task para permitir reverter isoladamente. Também pediu para, ao final, avaliar se o padrão dotcontext + spec-kit está correto (registrado como task própria, respondido só no fim da sequência).

## Decisões tomadas
- IA: props deixam de ser um cubo colorido genérico e viram composições de primitivas por tipo (`propParts` em visuals.ts), exatamente como a tabela de `world.md` já previa (pedra = icosaedro achatado, árvore = cilindro+cone, caixa = cubo, muro = cubo esticado, bandeira = haste+pano).
- Para não furar o orçamento de draw calls (Princípio 5, < 200), a composição não é "1 Group por prop" — é **1 InstancedMesh por parte do tipo** (ex.: todas as pedras do mapa = 1 draw call; toda árvore = 2, tronco+folha). Isso é o que a IA já havia sinalizado como arquitetura saudável (LEAD_DESIGNER_NOTES).
- Bandeira é decorativa (não colide, per world.md) e marca o centro de cada zona de guerra — renderizada à parte dos props colidíveis do grid.

## Resultado verificado
- `tsc --noEmit` limpo no client.
- Servidor + cliente rodando via preview (porta 2567/5173): screenshot confirma zona safe pintada (azul-esverdeado) e pedra (icosaedro cinza achatado), caixa (cubo marrom) e muro (caixa alongada escura) visualmente distintos entre si.
- Bots headless (2 bots, 8s) seguem coletando sem regressão (níveis subindo, speed_up aplicado) — a troca de visual não tocou colisão/rede.
- Não verificado visualmente nesta rodada: árvore e bandeira (zona de guerra fica longe do spawn onde os bots testam) — código é estruturalmente idêntico ao das outras partes (mesma técnica de InstancedMesh por parte) e passa no type-check.

## Regras que nascem daqui
- Visual de prop novo = nova entrada em `propParts()` + world.md; nunca cubo solto hardcoded em main.ts.
- Composição de cenário sempre 1 InstancedMesh por parte-tipo, nunca por instância — é a técnica oficial para "composição sem custo de draw call".

## Pendências para o próximo prompt
T-003 (XP/nível/atributos) — sem dependência pendente, pode seguir.
