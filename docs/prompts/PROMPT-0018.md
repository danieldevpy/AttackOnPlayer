# PROMPT-0018 — T-012: ganchos de mobilidade no LauncherDef · 2026-07-04

## Pedido (resumo fiel do CD)
- Última task da SPEC-0003: ganchos opcionais de mobilidade em `LauncherDef`, aplicados pelo servidor via `EffectSystem` no momento do disparo, com um lançador de teste para validar. Depende só de T-010 (pronta).

## Decisões tomadas (e por quem)
- IA: `LauncherDef` ganha `movement?` opcional: `selfSlowFactor`, `selfSlowMs`, `inheritVelocityFactor`. Ausente = neutro; `basic_shot` não define nada (comportamento idêntico ao de antes).
- IA: **lentidão vira um `EffectKind` novo (`launcher_slow`) com magnitude dinâmica** — até agora todo efeito do `EffectSystem` tinha duração E força fixas em constantes (`speed_up` sempre ×1.5/8s). Como cada lançador pode querer um fator/duração diferentes, `ActiveEffect` ganhou um campo opcional `magnitude`, e um método novo `applySlow(playerId, player, factor, durationMs, now)` que não usa a tabela `DURATION` (essa é só para os kinds de valor fixo). Escolhido em vez de codificar `selfSlowFactor` como constante global — o objetivo da task é justamente lançador novo = 1 entrada de dados, não uma constante nova por lançador.
- IA: `inheritVelocityFactor` implementado como um blend vetorial no momento do spawn — soma `inputX/inputZ × PLAYER_SPEED × player.speed × inherit` à velocidade base do projétil (direção × `projectile.speed`) e renormaliza a direção. Hoje só **entorta a direção**, não a magnitude do disparo (a magnitude continua fixa em `projectile.speed`) — decisão consciente de manter simples; se um lançador futuro precisar que o projétil também vá mais rápido herdando velocidade, é um ajuste pontual na mesma função, não uma reformulação.
- IA: lançador de teste `heavy_shot_dev` (`selfSlowFactor: 0.5`, `selfSlowMs: 700ms`, `inheritVelocityFactor: 0.3`) cadastrado no registro `LAUNCHERS` (sempre existe como dado, nunca atribuído por padrão). Só fica **selecionável** via mensagem nova `dev_launcher`, e essa mensagem só faz efeito com `process.env.DEBUG === "1"` no servidor — mesmo flag que já existe no projeto para o feed de debug (não inventei um `DEV_MODE` novo; `DEBUG=1` já era o sinal real de "sessão de desenvolvimento" usado em `emitDebug`).
- IA: `ProjectileSystem.tick()` ganhou um 5º parâmetro (`effects: EffectSystem`) para poder chamar `applySlow` no momento exato do disparo — evita duplicar a decisão de "esse launcher tem gancho de mobilidade" em outro lugar do código.

## Resultado verificado
- Typecheck limpo nos 4 pacotes (`server`, `client`, `bots`, e `shared` via os outros).
- **Novo teste determinístico** em `projectiles.test.ts` (`describe` dedicado, T-012): dispara com `heavy_shot_dev` e confirma `player.speed` cai exatamente para `selfSlowFactor` (0.5) no tick do disparo e volta sozinho a 1.0 depois que `selfSlowMs` passa (sem nenhuma chamada manual de "remover efeito" — é o `EffectSystem.tick()` de sempre). Segundo teste confirma que disparar com `basic_shot` não move `player.speed` de 1 — cobre o "basic_shot permanece inalterado" do critério de aceite 5.
- `npm run test` (shared): 5/5. Suite do server: 4/4 (2 de T-008 + 2 novas de T-012).
- Verificação ao vivo no browser (preview, `DEBUG=1`): a mensagem `dev_launcher("heavy_shot_dev")` trocou o launcher do meu player de fato (confirmado no F3, linha `launcher`). A confirmação visual da **janela transiente** de lentidão (fator ativo por ~700ms logo após o tiro) não foi capturada na tela porque o ambiente de preview processa os comandos de forma throtled/assíncrona (gaps de dezenas de segundos de tempo real entre uma chamada e outra) — a janela de 700ms sempre já tinha expirado quando o screenshot chegava. O teste unitário determinístico é a prova mais confiável desse comportamento específico (mede o instante exato, coisa que uma screenshot não consegue).
- `npm run bots -- 3 30` após a mudança: sem crash, combate seguiu normal (bots continuam em `basic_shot`, então o gancho novo nem entra em jogo pra eles — comportamento idêntico ao de antes).

## Veredito CD (preencher após teste no browser)
- Testado em: —
- Fluxos: [ ] `heavy_shot_dev` reduz velocidade ao disparar (via `dev_launcher`, precisa `DEBUG=1`) [ ] volta ao normal sozinho [ ] `basic_shot` sem nenhuma mudança
- Resultado: pendente
- Observações:

## Regras que nascem daqui
- Efeito com magnitude variável por chamador (não por `EffectKind` fixo) é um padrão novo no `EffectSystem` — quando a força/duração vier de fora (dado, não constante), usar `ActiveEffect.magnitude` + um método dedicado (como `applySlow`), não forçar o kind a caber no molde de `apply()`/`DURATION`.
- Mensagens `dev_*` (equivalente ao `DEV_MODE` sempre mencionado nos docs, nunca implementado até agora) devem ficar atrás de `process.env.DEBUG === "1"` — é o flag real que já existe no projeto; não criar um segundo flag concorrente.

## SPEC-0003 — fechamento
Com T-012, as 5 tasks da spec (`T-009`..`T-013`) estão implementadas e verificadas (unitário + headless + browser, dentro dos limites do ambiente de preview). Falta:
1. Veredito do CD nos fluxos marcados como pendente nos PROMPTs 0014–0018 (idealmente testando ao vivo, não só a verificação da IA).
2. Decidir sobre merge de `movimento_e_direcao` → `main` (checklist em `docs/QA.md`, que já está com os números corrigidos e a guarda de `.js` órfão).

## Pendências para o próximo prompt
- Nenhuma task nova da SPEC-0003 — próximo passo é veredito + merge, ou nova spec.
