# Lead Designer Notes — IA

Voz da IA. Opiniões, riscos e sugestões. Status: proposta → aprovada/rejeitada pelo CD.

## 2026-07-04

**Risco 1 — Snowball em partidas de 2–3 min.** Quem abre vantagem cedo tende a fechar o round sozinho. Sugestões: upgrades dentro do round expiram no fim; veteranos vivos há muito tempo ficam visíveis no minimapa ("caça ao rei"); força necessária para matá-los cresce, mas a recompensa também. *Status: proposta (decidir no M1).*

**Risco 2 — Nível zerar pode expulsar jogador casual.** Perder tudo é tenso e bom, mas zerar com frequência mata retenção. Sugestão: piso de proteção nos 3 primeiros níveis, e perda proporcional (ex.: -30% do progresso) acima disso. *Status: proposta (decidir no M1).*

**Opinião — Aura.** Concordo com o modelo aprovado (ADR-005): aura ganha por mecânica, gasta em oportunidade. Alerta: medir "mecânica pronta" precisa de métricas objetivas (esquiva no último instante, precisão, streak sem dano) — já previsto em observabilidade. Sem isso vira sensação, não sistema.

**Opinião — Predição de movimento.** Em M0 usei interpolação simples (cliente segue o estado do servidor com lerp). Com ping < 80ms fica bom. Predição client-side completa só quando houver combate — implementar antes é custo sem retorno. *Status: decidido tacitamente, reavaliar no M1.*

**Sugestão — Guardian único (não vários NPCs).** Um só NPC de elite que entra quando falta gente: vira treino, desafio, coop e evento com um único cérebro para manter. *Status: aprovado na concepção, implementar no M3.*

**Alerta técnico — 45s/2–3min de partida exige tudo instantâneo.** Loading > 5s destrói o loop "mais um round". Manter bundle pequeno é requisito de design, não só técnico.
