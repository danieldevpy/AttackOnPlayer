# PROMPT-0017 — T-013: migração dos bots para o protocolo novo · 2026-07-04

## Pedido (resumo fiel do CD)
- Continuar a SPEC-0003 task a task. T-013 fecha a lacuna aberta desde a T-010: bots (T-008) mandavam `fx/fz`, o servidor não lê mais isso, então paravam de atirar (0 tiros, sem crash).

## Decisões tomadas (e por quem)
- IA: bots passam a mandar `{x, z, aimX?, aimZ?, fire?}`. Miram continuamente (`aimX/aimZ`, com chumbo/lead + erro por skill) em qualquer inimigo dentro do **raio de engajamento**, não só do alcance de tiro — a direção real do disparo é resolvida pelo servidor a partir do facing (`dir`), como já vale para o cliente humano desde T-009/T-010. O **gatilho** (`fire: true`) só liga quando o alvo está de fato dentro do alcance do launcher, igual antes.
- IA: nenhuma mudança na árvore de decisão de combate em si (fuga por HP, fechar distância, recuar se colado) — só a forma de comunicar mira/gatilho ao servidor mudou.
- IA: `docs/ai/bots.md` atualizado para descrever o protocolo novo em vez de `fx/fz`.

## Resultado verificado
- Typecheck limpo (`bots`).
- `npm run bots -- 6 45` (skill forte): tiros voltaram a acontecer (ex.: 226, 238, 374, 201, 375 por bot) e o log do servidor mostrou `bot-4 morreu. Respawn no nível 1 em (73.5, 1.5).` — cadeia completa mira→tiro→dano→morte→respawn confirmada, igual à T-008.
- Gate padrão (`npm run test`, `tsc --noEmit` nos 3 pacotes, `npm run bots -- 3 30`, guarda de `.js` órfão): tudo limpo, sem crash.
- Fecha o efeito colateral aceito nas PROMPT-0015/0016 (bots paravam de atirar).

## Veredito CD (preencher após teste no browser)
- Testado em: —
- Fluxos: [ ] bots engajam e atiram [ ] kill acontece em sessão headless
- Resultado: pendente
- Observações:

## Regras que nascem daqui
- Bot nunca manda direção de tiro direto — só mira (`aimX/aimZ`) e gatilho (`fire`), exatamente como o protocolo espera de qualquer cliente (humano ou bot). Isso também significa que qualquer ajuste futuro na resolução de facing do servidor vale automaticamente para bots, sem tocar em `bot.ts`.

## Pendências para o próximo prompt
- T-012 é a última task da SPEC-0003: ganchos de mobilidade no `LauncherDef` (ex.: lentidão ao disparar) via `EffectSystem`, com um lançador de teste atrás de flag/DEV.
- Depois de T-012, a SPEC-0003 fecha por completo — revisar os 6 critérios de aceite da spec e pedir veredito geral do CD (browser + headless).
