# PROMPT-0024 — T-018: Juice de poder — aro por faixa, números de dano, streak · 2026-07-04

## Pedido (resumo fiel do CD)
Continuação da execução da SPEC-0004 (PROMPT-0020..0023). Esta leva: T-018 (a última de código da spec — T-008b fica para leva própria).

## Decisões tomadas (e por quem)
- CD (via SPEC-0004): evolução precisa ser *sentida* — glow por faixa, números de dano com escala, streak.
- IA: **aro de poder** em `visuals.ts` (`updatePowerVisual`): nível 1–3 nada; 4–7 aro fraco âmbar; 8+ aro forte **pulsante** (o pulso é o placeholder de "trail" na fase F1 — trail de verdade é F3+, ADR-008). Faixas em `shared/constants.ts` (`POWER_BAND_MID/HIGH`) com comentário explícito: **só feedback, nunca lógica de jogo**. Também é leitura tática — prepara o "famar aura" do M2 e o "caça ao rei" (proposta do LD).
- IA: **números de dano flutuantes** derivados do `debug_event: hit` que o servidor **já transmite** — zero tráfego novo. Sprite com CanvasTexture, fonte cresce com o dano (20 → 46px no teto), ☠ vermelho em kill; orçamento fixo de 24 popups vivos com dispose de textura/material (leve sempre, princípio 5).
- IA: **kill streak** no HUD (`hud.ts`), também derivado do feed existente: kills sem morrer, aparece a partir de 2, zera na própria morte. É o cousin visual do `hit_streak` que o M2 (aura) vai medir de verdade no servidor.
- IA: flash textual do card escolhido já tinha nascido na T-016 — mantido.

## Resultado verificado
- ⚠️ Gates + screenshot comparando faixas pendentes de runtime (limitação da sessão; ver PROMPT-0020). Revisão estática: popups e aro não criam geometria nova por frame (geometria/anel compartilhados, canvas só no spawn do popup); draw calls extras ≤ 24 sprites + 1 ring por player — dentro do orçamento (< 200).
- Sem mudança de servidor nesta task (só leitura do feed já existente) — risco de regressão de gameplay: zero.

## Regras que nascem daqui
- Juice visual deriva de eventos que o servidor já emite — feedback novo não pode inventar tráfego novo sem justificar.
- Todo elemento visual dinâmico nasce com orçamento explícito (pool/limite) e dispose — "leve sempre" se verifica no code review, não depois.

## Pendências para o próximo prompt
- Rodar gates; screenshot de faixas de nível (1/5/9) para o veredito do CD.
