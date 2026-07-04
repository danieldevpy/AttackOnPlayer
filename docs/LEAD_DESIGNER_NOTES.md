# Lead Designer Notes — IA

Voz da IA. Opiniões, riscos e sugestões. Status: proposta → aprovada/rejeitada pelo CD.

## 2026-07-04 — Feedback de arquitetura (pedido no PROMPT-0003)

**Saudável.** O pivô Bomberman → campo aberto custa UMA função (`buildMap`) porque colisão, rede, seed sync e bots são camadas independentes — é exatamente o teste que uma boa arquitetura deve passar. O EffectSystem absorveu speed_up sem tocar o Room e vai absorver dano/atributos igual; o shared já evitou drift 3 vezes (cliente, servidor e bots reconstroem o mesmo mapa de 3 números).

**Dívidas a vigiar (nenhuma urgente):**
1. Cliente itera o estado inteiro por frame — ok até ~200 entidades; projéteis (T-005) vão pressionar. Se pesar: callbacks tipados do Colyseus ou interest management. Medir antes de otimizar.
2. `main.ts` do cliente crescendo — separar `net.ts`/`hud.ts` quando o combate entrar (na T-005, não antes).
3. Zero testes unitários — a curva de XP (T-003) é onde eles passam a valer a pena (balance depende dela).
4. Tensão de design: box "reset MU" (meta-progressão) vs constituição (progressão por round). Decisão do CD antes da T-004 — recomendo round-only agora.
5. Sandbox de teste: processos fantasmas seguram portas; testes sempre em PORT alternativa (aprendido na prática).

**Opinião sobre o rumo:** lançadores data-driven é a decisão mais importante desta sessão — transforma "adicionar arma" de tarefa de engenharia em tarefa de design. Com F3 debug (T-007) cedo, cada task seguinte fica mais barata de validar. Sugiro executar T-007 logo após T-001 se sentir o desenvolvimento "às cegas".

## 2026-07-04

**Risco 1 — Snowball em partidas de 2–3 min.** Quem abre vantagem cedo tende a fechar o round sozinho. Sugestões: upgrades dentro do round expiram no fim; veteranos vivos há muito tempo ficam visíveis no minimapa ("caça ao rei"); força necessária para matá-los cresce, mas a recompensa também. *Status: proposta (decidir no M1).*

**Risco 2 — Nível zerar pode expulsar jogador casual.** Perder tudo é tenso e bom, mas zerar com frequência mata retenção. Sugestão: piso de proteção nos 3 primeiros níveis, e perda proporcional (ex.: -30% do progresso) acima disso. *Status: proposta (decidir no M1).*

**Opinião — Aura.** Concordo com o modelo aprovado (ADR-005): aura ganha por mecânica, gasta em oportunidade. Alerta: medir "mecânica pronta" precisa de métricas objetivas (esquiva no último instante, precisão, streak sem dano) — já previsto em observabilidade. Sem isso vira sensação, não sistema.

**Opinião — Predição de movimento.** Em M0 usei interpolação simples (cliente segue o estado do servidor com lerp). Com ping < 80ms fica bom. Predição client-side completa só quando houver combate — implementar antes é custo sem retorno. *Status: decidido tacitamente, reavaliar no M1.*

**Sugestão — Guardian único (não vários NPCs).** Um só NPC de elite que entra quando falta gente: vira treino, desafio, coop e evento com um único cérebro para manter. *Status: aprovado na concepção, implementar no M3.*

**Alerta técnico — 45s/2–3min de partida exige tudo instantâneo.** Loading > 5s destrói o loop "mais um round". Manter bundle pequeno é requisito de design, não só técnico.

## 2026-07-04 — Interpretação técnica das decisões de T-004/T-006 (escopo delimitado)

O pedido do CD é maior que uma task — vou implementar a fatia buildável agora e registrar o resto como proposta para os marcos certos, em vez de meio-construir tudo.

**Meta-progressão entre rooms (box):** tensiona direto com a constituição ("progressão por round") e com a recomendação anterior da IA em `progression.md` ("persistência só cosmética/rank, nunca poder"). CD decidiu por cima disso — registrado, é decisão dele. Escopo que vou construir agora: `PersistentProgress` por `playerToken` (id gerado no cliente, guardado em localStorage, enviado no join) acumulando pontos de atributo entre partidas; visível SÓ com `DEV_MODE` ligado (painel debug, integra com o overlay F3 do T-007). **Não vou** ligar isso ao poder real dentro do round nem ao balanceamento multi-sala (ADR-007/matchmaking) — isso exige o sistema de salas/matchmaking do M3, que não existe ainda. Fica a peça pronta para "acionar" quando M3 chegar (ADR-012).

**Coins:** CD não especificou o quê. Proposta da IA (implementada): coins compram **reroll** da distribuição automática de atributos do último nível (ver T-003 auto-distribuição). Justificativa: reusa o sistema já existente (sem UI de loja nova), é testável por bot (gasta ao acumular um limiar), e é o precursor natural da "escolha manual" (v2) já prevista em growth.md.

**Perda de nível / crítico / armadura / aura-sobrevivência:** vou implementar a curva de perda escalando com nível (piso baixo nos níveis iniciais, perda cresce com o nível) + toggle de reset total (por room, com default global). **Não vou** implementar armadura, crítico ou "aura decide sobrevivência" agora — são sistemas de combate/aura que dependem do M2 (Aura, ADR-005) e de combate já rodando de verdade (T-005/T-006 é o próprio combate nascendo). Registrado como proposta para quando Aura entrar em pauta, para não nascerem meio-prontos.
