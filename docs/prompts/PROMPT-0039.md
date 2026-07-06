# PROMPT-0039 — SPEC-0011 (T-037..T-045): feedback de gameplay #2, agentes paralelos + recuperação de reset · 2026-07-06

## Pedido (resumo fiel do CD)
Segundo lote de feedback pós-gameplay com bots: (1) mais aura ⇒ mais foco dos bots, mas divisão equilibrada ("fico forte, fico parado e quase não sou atacado"); (2) ≥3 projéteis, padrão discreto + vantajosos, arma coletável no chão 1 por vez, respawn sorteado 15–30 s, nunca sobre estrutura; (3) projétil menor para passar vãos em diagonal; (4) bandeira nunca bloqueada/sobre obstáculo, acesa quando livre, "desativada" quando carregada, e estado de cooldown de 1 min se abandonada por 5 s; (5) combo de XP em sequência sem tomar dano, limite sorteado 3–5 a partir da 3ª; (6) bot com vida cheia sempre caça, foge só com pouca vida E coletável de fuga, senão luta; (7) texto não invasivo com opacidade nas coletas; (8) transição de nascimento (sem "teletransporte"). Instrução de processo: organizar a linha de raciocínio em etapas, planejar e desenvolver por agentes paralelos (Sonnet/Opus).

Mensagem posterior (após limite de sessão + reset acidental do working tree): restaurar a sessão e o código, e transformar o que foi decidido em plano por tasks com escopo claro para desenvolvimento paralelo com Sonnet.

## Decisões tomadas (e por quem)
- **"Aura" = banda de poder por nível (IA, registrado na spec):** a aura mecânica é do M2 (ADR-005); a leitura fiel hoje é `POWER_BAND_MID/HIGH` (mesma fonte do aro visual da T-018). Quando a aura do M2 nascer, os bots trocam de fonte sem mudar a forma.
- **Anti-"todos contra um" (IA):** peso de engage por aura tem teto e convive com o `targetBias` da S12; adicionou-se piso de `advantageConf` para o penalizador de desvantagem não anular justamente o alvo forte.
- **Raio duplo do projétil (IA):** `sceneryRadius` (fino, 0.22 — passa diagonal) separado do raio de hit em player (0.4 — TTK intacto). Fato geométrico registrado: props que se tocam no canto são intransponíveis para qualquer raio > 0; o caso real do gerador (props isolados) é o coberto.
- **Arsenal sem pattern novo (IA, escopo):** `heavy_shot`/`rapid_shot` mudam números/visual (vantagem +8%/+15% DPS com tradeoff), não pattern — patterns são das skills (T-017). Arma dura até a morte; morte devolve `basic_shot`.
- **Cooldown da bandeira em qualquer abandono (IA, simplicidade):** morte OU desconexão ⇒ mesmo fluxo (5 s → cooldown 60 s → centro). `Flag.state` sincronizado; bots tratam cooldown como bandeira inexistente.
- **Combo de XP 100% servidor (princípio 2):** estado runtime (`xpComboCount`/`xpComboLimit`), cliente só recebe `xp_combo`. Outras coletas não contam nem zeram; só dano real zera.
- **Execução por 4 agentes em 2 etapas (CD pediu paralelismo):** Etapa 1 = frentes disjuntas (bots ∥ shared/server/client); Etapa 2 = bandeira ∥ feedback/UX com fronteiras de região explícitas nos arquivos compartilhados (seções próprias no fim de `constants.ts`; instrução reler-e-refazer em conflito de edit). Funcionou sem nenhuma colisão real (0 falhas de edit por concorrência).

## Incidente e recuperação (regra nova mais importante da sessão)
O limite de sessão do plano cortou os 2 agentes da Etapa 2 durante a verificação final; na retomada, o working tree foi **resetado por acidente** (`reset HEAD~1` + checkouts), perdendo todas as modificações não commitadas. Recuperação:
1. `evolução` reapontada para `7c9e28e` (o commit S17/S18 nunca se perdeu — HEAD estava nele, e o CD criou `funcional-0705` de resgate).
2. Os transcripts JSONL dos 4 subagentes (persistidos em `~/.claude/projects/.../subagents/`) contêm cada `Edit`/`Write`; script Python extraiu as **85 operações bem-sucedidas** (as com erro foram descartadas), ordenou por timestamp global (reproduz a história real, inclusive a intercalação da Etapa 2) e reaplicou sobre a base `7c9e28e`: **0 falhas, 26 arquivos**.
3. Inventário: as 9 tasks estavam completas (os agentes da Etapa 2 morreram DEPOIS de terminar código+testes, durante o relatório).
4. Commit imediato `337ae08` (o que faltou na primeira vez).

## Resultado verificado
- **Gates pós-recuperação:** shared **25/25** · server **49/49** (37 da Etapa 1 + 12 novos de flag/combo) · bots **35/35** · `tsc --noEmit` limpo em server/client/bots.
- Etapa 1 havia sido verificada integrada antes do corte (25/37/35 + tsc ×3) — os números baterem após o replay é evidência forte de reconstrução fiel.
- **Não verificado:** smoke fim-a-fim com as 4 frentes juntas ao vivo (virou **T-046**) e vereditos de sensação/visual do CD.

## Regras que nascem daqui
- **Commitar ao fim de cada frente verde, sempre** — trabalho não commitado foi perdido por um reset acidental; o custo da recuperação (replay de transcript) é alto e nem sempre possível.
- **Transcripts de subagentes são backup de última instância:** `~/.claude/projects/<projeto>/<sessão>/subagents/agent-*.jsonl` guardam cada edit; replay por timestamp global reconstrói o estado (só vale se a base do replay for o mesmo commit em que os agentes trabalharam).
- **Agentes paralelos em arquivos compartilhados:** seções próprias no FIM de `constants.ts` + fronteiras de região explícitas + "se o Edit falhar, releia e refaça" — padrão validado, zero colisões.

## Pendências para o próximo prompt
- **T-046** (smoke de integração da SPEC-0011) e **T-047** (doc de mecânica da bandeira) — escopos fechados no BACKLOG, paralelizáveis, dimensionados para Sonnet.
- Vereditos de sensação do CD (dials por task na seção F2.6 do BACKLOG): multiplicadores de aura, números dos lançadores/janela de respawn da arma, tempos da bandeira, booster do combo.
- T-025 (CLI de mapas) segue como próxima da fila V1 original.
