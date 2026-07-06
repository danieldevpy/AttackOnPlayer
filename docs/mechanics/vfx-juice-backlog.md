# VFX & Juice — backlog vivo (PROPOSAL-0002 §9-A4)

> **Como funciona:** este arquivo é um backlog **sem fase fixa**. O CD adiciona itens aqui
> quando sente a necessidade jogando ("time/tempo momentâneo"); qualquer leva de
> desenvolvimento pode puxar 1–3 itens como bônus, desde que use o registry da T-022
> (efeito = 1 entrada de dados) e respeite o orçamento de partículas. Nunca vira
> reestruturação de plano — é lista de compras, não spec.

## Regra de intensidade (decisão do CD, 2026-07-05)

| Origem do evento | Intensidade | Exemplo |
|---|---|---|
| **Automático** (level-up passivo, buff pego, expiração) | **Leve** — glint/pulso discreto | `level_up_auto`: anel sutil |
| **Escolha manual do jogador** (card escolhido, skill de marco, reroll) | **Chamativo, estilo "aura"** | `upgrade_chosen_aura`: explosão de aura no boneco |

Feedback deve ser proporcional à **agência**: o jogo comemora as *decisões* do jogador.

## Fila atual (CD adiciona no topo; ✔ quando entregue)

| Efeito (nome no registry) | Descrição | Origem |
|---|---|---|
| `speed_up_trail` ✔ | rastro/partículas enquanto o buff de velocidade está ativo | pedido CD 2026-07-05 — entregue T-022/PROMPT-0034 |
| `buff_cooldown_ring` ✔ | anel de duração esvaziando ao redor do boneco (velocidade e futuros buffs) — "efeito cooldown" | pedido CD 2026-07-05 — entregue T-022/PROMPT-0034 |
| `blood_hit` ✔ | respingo de sangue estilizado ao tomar dano (fase F1: partículas vermelhas simples) | pedido CD 2026-07-05 — entregue T-022/PROMPT-0034 |
| `level_up_auto` ✔ | evolução automática: anel leve + som futuro | pedido CD 2026-07-05 — entregue T-022/PROMPT-0034 |
| `upgrade_chosen_aura` ✔ | escolha manual (card/skill/reroll): aura chamativa no boneco | pedido CD 2026-07-05 — entregue T-022/PROMPT-0034 |
| `toast_text` ✔ | **sistema de mensagens de texto**: toasts curtos com efeito personalizado (fade/slide), fila não invasiva (canto, nunca no centro), substitui os textos crus do HUD (streak, card, farm_event) | pedido CD 2026-07-05 — entregue T-023/PROMPT-0035 |
| `heal_pop` ✔ | partículas verdes + número "+X" verde flutuante ao curar (kill em briga `kill_heal` e `hp_orb`) | pedido CD 2026-07-05 (passe visual) — entregue T-036/PROMPT-0038 |
| `shield_gain` ✔ | burst azul ao pegar `shield_temp`; reusa o anel de cooldown de buff (cor azul) enquanto o escudo dura | pedido CD 2026-07-05 (passe visual) — entregue T-036/PROMPT-0038 |

## Restrições permanentes

- Todo efeito nasce no **registry nomeado** (`packages/client/src/vfx.ts`, `VFX_DEFS` — T-022) — proibido efeito ad-hoc no main.ts.
- Deriva de eventos que o servidor já emite; se precisar de evento novo, justificar.
- Orçamento global de partículas vale sempre ("leve sempre", constituição §5) — pool único fixo (`MAX_PARTICLES`), não 1 mesh por efeito.
- Todos os itens desta leva inicial (T-022/PROMPT-0034 + T-023/PROMPT-0035) estão entregues; novos itens que o CD adicionar aqui continuam puxáveis por qualquer leva futura.
