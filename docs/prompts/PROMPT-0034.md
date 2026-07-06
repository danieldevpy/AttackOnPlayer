# PROMPT-0034 — T-022 (SPEC-0006): VFX nomeados · 2026-07-05

## Pedido (resumo fiel do CD)
Retomar a fila da V1 depois do alinhamento de estado do projeto (PROMPT-0033): "Quero começar a desenvolver as próximas etapas/tasks" — próxima da fila era **T-022**, sem novas instruções específicas além do que já estava fechado na SPEC-0006/backlog vivo.

## Decisões tomadas (e por quem)
- **Registry data-driven único (`packages/client/src/vfx.ts`)** — `VFX_DEFS: Record<string, VfxDef>` com 10 efeitos (os 6 "base" da SPEC-0006: `muzzle_flash`, `hit_spark`, `death_burst`, `shield_pop`, `flag_aura`, `pickup_glint` + os 5 da fila inicial do backlog vivo: `speed_up_trail`, `buff_cooldown_ring`, `blood_hit`, `level_up_auto`, `upgrade_chosen_aura`). "Efeito novo = 1 entrada de dados" (critério de aceite da spec): cor, contagem, vida, velocidade e a intensidade da regra do CD (`leve`/`aura`).
- **1 pool de partículas para o jogo inteiro**, não 1 mesh por efeito: `THREE.Points` com buffer fixo (`MAX_PARTICLES = 260`), ring-buffer recicla a partícula mais antiga se saturar. Partículas inativas ficam em `y=-1000` (fora da câmera) — custo de draw call constante independente de quanto combate está rolando, e zero alocação por frame (arrays pré-alocados). Cumpre o critério "8 players em combate dentro do orçamento de partículas" por construção, não por sorte.
- **Todo efeito nasce de um evento que o servidor já emite** (regra permanente do backlog vivo) — nenhum evento novo no protocolo:
  - `hit_spark`/`blood_hit` ← `debug_event` tipo `hit` (mesmo evento que já alimentava o popup de dano da T-018).
  - `death_burst` ← `debug_event` tipo `death`.
  - `pickup_glint` ← `debug_event` tipo `pickup` (qualquer kind).
  - `shield_pop` ← **derivado no cliente**, não existe evento de "escudo caiu": comparado o `spawnProtectedUntil` a cada tick (mapa `wasShielded`), dispara no instante da transição true→false.
  - `level_up_auto` / `upgrade_chosen_aura` ← `debug_event` tipo `upgrade`, escolhido pelo campo `auto` (fiel à regra de intensidade: automático=leve, escolha manual=aura).
  - `muzzle_flash` ← primeira vez que um `id` aparece em `st.projectiles` (o projétil já nasce na posição do cano; não precisava de evento novo).
  - `speed_up_trail` / `flag_aura` ← contínuos, emitidos a cada poucos frames (throttle local) enquanto `p.effects` contém `speed_up` / o jogador é o portador da bandeira — reusam o mesmo pool via `spawnAt`, sem mesh próprio.
- **`buff_cooldown_ring` (novo helper em `visuals.ts`, mesmo padrão de `updatePowerVisual`/`updateShieldVisual`):** em vez de "chutar" o tempo restante do buff, o cliente usa o **instante exato de aplicação** — que já é observável nos eventos existentes: `pickup` (kind `speed_up`/`farm_event`) e `impulso` (skill de kill_rush) — pareado com a MESMA constante de duração do `EffectSystem` (`SPEED_BOOST_MS`/`XP_BOOST_MS`/`KILL_RUSH_MS`, importadas de `@aop/shared`, não duplicadas). Isso também resolve a renovação do buff (pickup de novo `speed_up` reseta o timer local) sem precisar sincronizar `expiresAt` pelo Schema. Simplificação consciente: só 1 anel por vez (o buff mais recente) — múltiplas faixas concêntricas fica pro backlog se o CD sentir falta.
- **Sem mudança de protocolo/servidor** — T-022 é 100% cliente; `ArenaRoom.ts` não foi tocado.

## Resultado verificado
- **Gates:** shared 13/13 · server 25/25 · bots 24/24 · `tsc --noEmit` limpo em client/server/bots.
- **Smoke end-to-end real:** servidor + cliente reais (preview real, não headless simulado) com 1 humano + 6 bots na mesma sala por ~2 minutos — combate, mortes, respawns, pickups de `speed_up`/`coin_buff`/`farm_event`, cards automáticos e escolhidos, e disputa de bandeira todos ocorrendo organicamente. **Zero erros no console do browser** durante todo o ciclo (prova de que os novos caminhos de código — incluindo os que dependem de payloads reais do servidor — não quebram em runtime). Overlay de debug (F3) confirmou os eventos batendo com os campos esperados (`pickup{playerId,kind}`, `upgrade{playerId,cardId,auto}`, etc.).
- **Confirmação visual:** screenshot do preview capturou um burst de partículas coloridas renderizando corretamente na cena (cores distintas por efeito, fade visível) — evidência direta de que o pool de partículas desenha, não só que o código não lança exceção.

## Regras que nascem daqui
- **Efeito de VFX = 1 entrada em `VFX_DEFS`, nunca um `THREE.Mesh`/`THREE.Points` novo solto no `main.ts`.** Quem quiser adicionar um efeito do backlog vivo (`docs/mechanics/vfx-juice-backlog.md`) só precisa de uma linha de dados + o `spawnAt("nome", x, z)` no ponto de gatilho.
- **Duração de buff no cliente nunca deve reinventar um número — sempre importar a mesma constante do `EffectSystem`/`@aop/shared`** usada no servidor, e ancorar o timer local no evento que já marca a aplicação exata (`pickup`/`impulso`), não em heurística.
- **Efeito "leve" (automático) vs. "aura" (escolha manual)** já está codificado no campo `intensity` de `VfxDef` — próximos efeitos do backlog entram classificando-se numa dessas duas categorias, replicando a decisão do CD de 2026-07-05.

## Pendências para o próximo prompt
- **`docs/mechanics/vfx-juice-backlog.md`** teve a fila inicial marcada como entregue (✔) — continua vivo, CD pode alimentar itens novos a qualquer momento.
- **`toast_text`** (mensagens de texto com efeito, fila no canto) fica para a **T-023** (HUD dev/prod + reveal-on-hit), que é a próxima da fila — ainda não iniciada.
- Nenhuma pendência de código conhecida para o que foi pedido; veredito de sensação em jogo mais longo/múltiplos humanos continua em aberto (mesma ressalva já registrada nas sessões anteriores).
