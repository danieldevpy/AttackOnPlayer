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
