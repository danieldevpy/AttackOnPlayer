# PROPOSAL-0002 — Plano da V1: do protótipo jogável ao lançamento na VPS

> **Status:** ✅ aprovada pelo CD (2026-07-05) **com 3 ajustes** (ver §9) — virou SPEC-0006..0009 + ADR-015/016.
> **Origem:** 9 percepções do CD jogando a build atual (2026-07-05) + pedido de plano completo por etapas até o lançamento.
> **Referências:** GAME_CONSTITUTION.md · ROADMAP.md (M0–M5 antigos) · specs/SPEC-0001..0005 · DECISION_LOG (ADR-001..014) · PROPOSAL-0001

---

## 1. Estado atual — alinhamento com tudo que foi construído

O que existe hoje (branch `evolução`, tudo testado com bots):

| Bloco | Estado |
|---|---|
| Fundação (M0/M0.5) | Servidor autoritativo Colyseus 20Hz, mapa dinâmico por seed, cliente Three.js top-down, bots headless com BFS, métricas JSONL |
| Combate (M1, SPEC-0003) | Lançadores data-driven, mira≠gatilho, projéteis com colisão por segmento, morte/respawn, bots de combate com skill fraco/médio/forte |
| Escala de poder (M1.5, SPEC-0004) | TTK alvo 5 tiros, 5 atributos (`ATTR_DEFS`), cards de level-up, skills de projétil (marcos + box), juice (aro/dano/streak) — 30 testes verdes |
| Ritmo (SPEC-0005/ADR-014) | XP passivo +1/s, morte zera nível, reroll dá XP, zonas safe removidas → invuln de nascimento 3s, **facing por movimento** |

**Pendências herdadas:** veredito do CD nas SPECs 3–5, merge → `main`, T-008b (perfis de bot/boss), T-OPTIONAL 1 (passe de balance formal).

**Conflitos que este plano resolve explicitamente:**

1. **Mira (ponto 2) reverte a ADR-014.6.** A SPEC-0005 tirou a mira do mouse (facing por movimento) — e o próprio CD sentiu a consequência: "só consigo atirar por ângulos". O pedido "FPS 2D estilo CS" devolve a mira ao mouse, desta vez como **crosshair de 360° com movimento independente (strafe)** — que é o modelo do CS 2D, diferente tanto do híbrido da SPEC-0003 quanto do facing-por-movimento da SPEC-0005. Vira **ADR-015** (revisão consciente, não flip-flop: cada iteração foi testada em jogo — é o processo funcionando).
2. **Roadmap antigo (M2–M5) é remapeado.** Aura (M2) e Guardian (M3) **ficam pós-V1** — a bandeira (ponto 4) entrega o "objetivo de mapa" que a aura prometia, com 10% da complexidade. Observabilidade (M4) e Produção (M5) são absorvidas pelos pontos 8, e docker/lançamento deste plano.
3. **Constituição vs contas persistentes (pontos 5/9).** A constituição diz "progressão por round; ranking persistente fora de escopo". **Guardrail mantido:** a conta (Django) guarda identidade, estatísticas, mapas e futuramente cosméticos — **nunca poder dentro do round**. O acumulador da box (ADR-012) liga na conta como registro/estatística, não como buff. Qualquer mudança nisso é decisão explícita do CD, não deriva deste plano.

## 2. O que é a V1 (definição de pronto)

> Um desconhecido recebe um link, entra **em menos de 10 segundos como anônimo**, joga uma partida de 2–3 min com mira estilo CS-2D contra players e bots que parecem gente, disputa a bandeira do mapa, sente a evolução (cards/skills/efeitos), vê um HUD limpo de produção — e pode, se quiser, logar com Google para guardar seu nome e estatísticas. Tudo rodando numa VPS com dev/prod separados por container e um script que sobe e verifica o ambiente inteiro.

## 3. Análise ponto a ponto (pedido do CD + acréscimos da IA)

### P1 — Bot esbarrando na borda / comportamento de robô
**Análise:** dois defeitos distintos. (a) *Borda:* em combate o bot persegue em linha reta (`combatDir`) sem desvio; o anti-stuck (PROMPT-0019) só reage *depois* de travar — falta **steering preventivo** (repulsão de borda/props antes de colidir). (b) *Robô:* o bot é mecanicamente perfeito — mira com ruído por tick (tremor não-humano), nunca hesita, nunca perambula.
**Acréscimos:** camada de "humanização" data-driven por skill: mira com **suavização** (lerp até o alvo, overshoot leve) em vez de ruído por tick; tempo de reação ao avistar (200–500ms); strafe lateral em duelo; perambulação com pausas quando ocioso; desistência de alvo (hysteresis). Telemetria de stuck para regressão. Sinergia direta com T-008b (perfis usam os mesmos knobs).

### P2 — "FPS 2D estilo Counter-Strike"
**Análise:** o modelo alvo é: **WASD move (strafe, independente da mira) + mouse mira 360° com crosshair + clique/espaço atira na direção exata do crosshair**. O protocolo já suporta (`aimX/aimZ` existe e os bots usam) — a mudança é de input/feel no cliente + facing no servidor voltar a priorizar mira.
**Acréscimos de feel (baratos, alto impacto):** cursor do SO escondido + crosshair custom; câmera com **leve offset na direção da mira** (peek à frente, marca registrada do CS 2D); "nariz" vira indicação de cano de arma; recuo visual mínimo no tiro. Mantém espaço como gatilho alternativo (acessibilidade/touch futuro). **ADR-015.**

### P3 — Sistema de mapas (gerado → curado → ferramentas)
**Análise:** hoje o mapa é 100% derivado do seed em runtime. Para "cada room escolher o mapa" e "IA gerar mapas via terminal", o mapa precisa virar **dado versionado**: formato `maps/<id>.map.json` (versão do schema, nome, autor, dimensões, props **semânticos** — pedra/árvore/caixa/muro —, zonas, spawns, posição da bandeira, seed de origem). Props semânticos são o que permite "trocar objetos" depois (reskin por tema sem tocar no layout). Room recebe `mapId`; cliente recebe o JSON no join (mapas são pequenos — dezenas de KB).
**Acréscimos:** CLI `npm run map -- gen|save|update|list|preview` com **preview ASCII no terminal** (pensado para IA iterar mapa sem abrir o jogo); validação de schema compartilhada (`shared`); regra de sanidade automática (0 regiões fechadas — flood fill que já existe). Registry de mapas migra para o Django (P5) quando ele existir — o formato JSON é o contrato. Editor visual para players fica **pós-V1**, mas o formato já nasce pronto pra ele.

### P4 — Bandeira (rei do mapa)
**Análise:** entrega o "ponto estratégico" da constituição e o "caça ao rei" proposto pelo Lead Designer em 2026-07-04. Design: 1 bandeira por mapa (posição vem do mapa, P3), **default ON** com toggle por room (`flagEnabled`); encostar = carregar; portador ganha **XP passivo ×2** (2 XP/s — empilha sobre a SPEC-0005) e bônus de atributo configurável (proposta: +2 pontos temporários de força/agilidade enquanto segura — devolvidos ao soltar); morrer derruba a bandeira no local; portador ganha **glow visível no mapa inteiro** (vira alvo social — anti-camping por natureza).
**Acréscimos:** métricas de posse (tempo segurando, disputas) na telemetria (P8); bandeira parada há muito tempo volta ao centro (evita esconder a bandeira em canto).

### P5 — Backend Django (plataforma e painel)
**Análise:** decisão de arquitetura — **ADR-016 (fronteira de responsabilidade):** o **tempo real continua 100% no Node/Colyseus** (autoridade de gameplay, tick 20Hz); o **Django é a plataforma**: contas/auth, perfis, registry de mapas, configuração de rooms/eventos (feature flags e "gameops" — criar evento de fim de semana sem deploy), ingestão de telemetria e o **admin** que o CD pediu (painel pronto do Django é imbatível em custo/benefício). Comunicação Colyseus↔Django por REST com service token; o game server **cacheia** config e funciona degradado se o Django cair (estabilidade primeiro, P8).
**Acréscimos:** Postgres desde o início (não SQLite — evita migração dupla); DRF para a API; estrutura de apps: `accounts`, `maps`, `gameops`, `telemetry`. "Formas de criar gameplays rápidas": rooms parametrizadas por config do gameops (`flagEnabled`, `fullResetOnDeath`, multiplicadores de XP, mapa) — evento novo = registro no admin, não código.

### P6 — Dev/prod no cliente + informação por skin/reveal
**Análise:** duas coisas: (a) **build de modo** — `import.meta.env` do Vite decide dev (F3, feeds, logs visuais, painéis) vs prod (só jogo); (b) **redesign da informação**: no prod, ping pequeno; painel do próprio player compacto e não invasivo (canto inferior: HP em barra, nível, atributos colapsados num painel que abre por tecla); **inimigo = só a skin** — nameplate + barra de HP de inimigo **só aparecem (perto do boneco) depois de troca de dano**, por N segundos, e isso é **autoritativo** (servidor mantém `revealedUntil` por par atacante↔vítima e só então o cliente exibe — informação é gameplay, não vaza de graça).
**Acréscimos:** "skin" ainda não existe — a V1 usa **skin placeholder**: cor + variação de forma estáveis por conta/token (fase visual F1/F2, ADR-008). Sistema de skins de verdade é pós-V1, mas o campo `skin` já nasce no protocolo/conta. Roster lateral some no prod (era ferramenta de dev) — quem está na sala você descobre jogando.

### P7 — Efeitos visuais nomeados ("partículas")
**Análise:** mesmo padrão que já venceu duas vezes (lançadores ADR-011, skills T-017): **registry data-driven** `vfx.ts` — efeito = nome + receita (`kind: burst|ring|trail|flash`, cor, contagem, vida, tamanho, gravidade). Efeitos iniciais nomeados: `muzzle_flash`, `hit_spark`, `death_burst`, `level_up_ring`, `shield_pop`, `flag_aura`, `pickup_glint`. Cliente deriva efeitos dos **eventos que o servidor já emite** (hit/death/upgrade/shield_block) — zero tráfego novo; pool de partículas com orçamento global (princípio "leve sempre").
**Acréscimos:** criar efeito novo = 1 entrada de dados → é exatamente o formato que permite "criar de diversas formas" depois (IA/designer escreve receita, o motor executa). Skills/lançadores ganham campo opcional `vfx` referenciando por nome.

### P8 — Logs inteligentes para análise por IA + estabilidade
**Análise:** evoluir o `sessions.jsonl` para **telemetria de eventos** NDJSON com **schema versionado**: cada evento com `matchId`, `roomId`, `mapId`, `playerToken`, tick, posição — cobrindo kills (com posições de ambos), upgrades escolhidos (o card recusado também!), posse de bandeira, quits, erros. Rotação de arquivos por tamanho/dia.
**Acréscimos:** (a) `npm run analyze` — agrega uma sessão em resumo legível por IA (funil do round, heatmap ASCII de mortes, escolhas de card por nível) — é o que transforma log em ideia de design; (b) **estabilidade identificável**: todo erro de servidor vira evento estruturado com contexto (room/tick/player), `/healthz` em cada serviço, watchdog de tick (alerta se o tick passar do orçamento). Ingestão no Django (P5) quando existir; arquivo local é a fonte primária (funciona offline).

### P9 — Login anônimo + Google + "registre-se"
**Análise:** o fluxo atual (playerToken em localStorage) **já é o modo anônimo** — formaliza-se: entra jogando como `guest-XXXX`, sem fricção. Janela **não invasiva** (canto, colapsável, nunca modal durante partida): "Entrar com Google" (1 clique, via Django `allauth`/OAuth) + texto pequeno "registre-se" → cadastro/login manual (email+senha) em página do Django. Ao logar, o token anônimo **vincula-se** à conta (herda estatísticas do guest). Colyseus valida JWT emitido pelo Django no `join`.
**Acréscimos:** logout/troca de conta; nome do player vem da conta (guest = editável localmente); LGPD mínima: página de privacidade + dados que guardamos (necessário antes de divulgar, P-launch).

## 4. Arquitetura alvo da V1

```
[Browser] ──WebSocket──> [game-server: Node/Colyseus]  ← autoridade de gameplay (20Hz)
    │                          │  REST (service token, com cache/degradação)
    │ HTTPS                    ▼
    └────────────────> [backend: Django + DRF + admin] ──> [Postgres]
                               ▲ ingestão de telemetria (batch)
[client: Vite → build estático servido por nginx (prod) / vite dev (dev)]

docker-compose.dev.yml  → hot-reload, F3/debug ligados, bots fáceis
docker-compose.prod.yml → nginx + TLS, builds otimizados, HUD prod, logs rotacionados
scripts/dev.sh · scripts/prod.sh → sobem, migram, verificam /healthz de tudo
```

Regras da fronteira (ADR-016 proposto): Node nunca acessa o Postgres direto; Django nunca decide gameplay em tempo real; contrato = REST/JSON + JWT; game server funciona sozinho se a plataforma cair (rooms anônimas continuam).

## 5. Guardrails (o que este plano NÃO muda)

- **Progressão de poder é por round** (constituição). Conta = identidade/estatística/mapa/cosmético.
- **Habilidade > sorte** — reveal-on-hit e bandeira são informação/objetivo, não RNG.
- **Servidor autoritativo** — reveal, bandeira, XP, tudo decidido no servidor.
- **Leve sempre** — partículas com orçamento; HUD prod mais leve que o atual, não mais pesado.
- **Debug First** — cada fase jogável/testável com bots antes da seguinte.

## 6. Fases (ordem de importância, cada uma jogável ao fim)

| Fase | Tema | Por quê nesta ordem |
|---|---|---|
| **F1 — Sensação** (T-019, T-020, T-008b) | Mira CS-2D + bots humanos | É o coração do jogo; sem feel, nada retém. Bots são o "conteúdo" mínimo de toda partida |
| **F2 — Objetivo & leitura** (T-021, T-022, T-023) | Bandeira, VFX nomeados, HUD dev/prod + reveal | Dá motivo pra lutar e clareza visual do que acontece |
| **F3 — Conteúdo** (T-024, T-025) | Formato de mapa + CLI | Variedade e o pipeline "IA gera mapa via terminal" |
| **F4 — Plataforma** (T-026, T-027, T-028, T-029) | Telemetria, Django+admin, auth anônimo/Google | Identidade, eventos e análise — na ordem: log local primeiro (não depende de nada), depois Django, depois auth |
| **F5 — Empacotamento** (T-030, T-031, T-OPTIONAL 1) | Docker dev/prod + scripts, hardening, balance final | Reprodutibilidade e estabilidade pré-público |
| **F6 — LANÇAMENTO** (T-032) | VPS, domínio, go-live, divulgação | A última task, como pedido |

Dependências fortes: T-028 → T-027; T-025 → T-024; T-029 → T-028; T-032 → tudo. T-026 pode rodar em paralelo desde cedo (recomendado: logo após F1, os logs ajudam a calibrar as próprias fases).

## 7. Questões abertas para o CD

1. **Bandeira — bônus de atributo:** +2 força/agilidade temporários enquanto segura está bom, ou só o 2× XP/s no início (mais simples de balancear)?
2. **Reveal-on-hit:** quanto tempo o nome/HP do inimigo fica visível após o hit? (proposta: 4s, renova a cada hit)
3. **Skins placeholder:** cor+forma por conta resolve a V1, ou quer já um seletor simples (3–5 formas) no login?
4. **Django já na V1** confirmado? (alternativa mais enxuta: launch só-anônimo e Django na V1.1 — **não recomendo**: auth depois força retrabalho no join/token)
5. **Divulgação:** qual canal primeiro (Discord/amigos/post público)? Define o tamanho do teste de carga da T-032.

---

## 8. Quebra em tasks (executar em ordem; padrão do BACKLOG)

> Numeração continua do BACKLOG. Cada task vira uma leva com PROMPT-NNNN, testes, docs e commit próprios — como nas SPECs 3–5. Ao aprovar esta proposta, F1+F2 viram **SPEC-0006**, F3 **SPEC-0007**, F4 **SPEC-0008**, F5+F6 **SPEC-0009** (specs curtas, uma por fase, para o veredito ser por fase).

### T-019 — Mira CS-2D: crosshair 360° + strafe 〔M〕 · ADR-015
Mouse mira (facing prioriza `aim` de novo), WASD move independente, crosshair custom (cursor SO escondido), câmera com offset sutil na direção da mira, espaço/click atiram no crosshair. Bots inalterados (já usam `aim`).
**Aceite:** atirar em qualquer ângulo parado e em movimento; strafe circulando um alvo mantendo mira nele; F3 mostra facing seguindo o mouse.

### T-020 — Bots humanos: steering de borda + humanização 〔M〕
Repulsão preventiva de borda/props no vetor de movimento; mira com suavização (lerp + reação 200–500ms) em vez de ruído por tick; strafe em duelo; perambulação com pausas; hysteresis de alvo. Knobs por skill (base pro T-008b).
**Aceite:** bot nunca fica >2s empurrando a borda; sessão de 30s observada sem "tremor de mira" nem paradas bruscas; telemetria de stuck zerada em mapa padrão.

### T-008b — Perfis de bot + boss 〔M〕 (já no BACKLOG) · depende: T-020
Perfis usam os knobs da T-020 + política de cards da SPEC-0004.

### T-021 — Bandeira: rei do mapa 〔M〕
Entidade flag (posição do mapa; centro por default), `flagEnabled` por room (default ON), portador: 2× XP/s + bônus configurável + glow global; morte derruba no local; retorno ao centro após N s abandonada. Métricas de posse.
**Aceite:** bots disputam a bandeira; toggle off remove tudo; portador visível através do mapa.

### T-022 — VFX nomeados: registry de partículas 〔M〕
`client/src/vfx.ts`: efeito = nome + receita data-driven (burst/ring/trail/flash; cor/contagem/vida); pool com orçamento global; efeitos iniciais (`muzzle_flash`, `hit_spark`, `death_burst`, `level_up_ring`, `shield_pop`, `flag_aura`, `pickup_glint`) derivados de eventos existentes — zero tráfego novo.
**Aceite:** criar efeito novo = 1 entrada de dados; orçamento respeitado com 8 players em combate.

### T-023 — HUD dev/prod + reveal-on-hit 〔G〕 · depende: T-022
Modo por env (Vite): prod = ping discreto, painel próprio compacto (barra HP, nível; atributos por tecla), sem F3/roster/feeds; inimigo = só skin (placeholder: cor+forma por token); nameplate+HP do inimigo **perto do boneco** só após troca de dano (`revealedUntil` autoritativo no servidor, ~4s renováveis).
**Aceite:** build prod sem nenhum artefato de dev; reveal só após hit e expira; dev continua com tudo.

### T-024 — Formato de mapa v1 + loader por room 〔G〕
Schema JSON versionado (`maps/*.map.json`): nome, autor, dimensões, props semânticos, zonas, spawns, flag, seed de origem; validação no `shared`; room aceita `mapId` (fallback: gerado por seed como hoje); cliente recebe o mapa no join; flood-fill de sanidade no load.
**Aceite:** 2 mapas salvos jogáveis por `mapId`; mapa inválido rejeitado com erro claro; bots jogam neles sem mudança.

### T-025 — CLI de mapas 〔M〕 · depende: T-024
`npm run map -- gen|save|update|list|preview`: gera por seed, nomeia, salva/atualiza, valida, **preview ASCII** no terminal (para IA iterar mapa sem abrir o jogo).
**Aceite:** fluxo gen→preview→save→jogar sem tocar em código; update preserva id/autor.

### T-026 — Telemetria estruturada para IA 〔M〕
Schema NDJSON versionado (matchId/roomId/mapId/playerToken/tick/posições) cobrindo kills, upgrades (escolhido **e** recusados), posse de bandeira, quits, erros com contexto; rotação de arquivos; `npm run analyze` (resumo por partida: funil, heatmap ASCII de mortes, escolhas por nível). Watchdog de tick.
**Aceite:** 1 partida de bots → resumo legível por IA; doc do schema em `docs/observability/`.

### T-027 — Backend Django: plataforma + admin 〔G〕 · ADR-016
`backend/` (Django+DRF+admin, Postgres): apps `accounts`, `maps` (registry), `gameops` (config de rooms/eventos por admin — flag, multiplicadores, mapa), `telemetry` (ingestão batch). Colyseus consome config via REST com service token + cache/degradação.
**Aceite:** admin cria um "evento" (ex.: XP ×2 no fim de semana) sem deploy e a room nova respeita; Django caído ≠ jogo caído.

### T-028 — Auth: anônimo default + Google + registre-se 〔G〕 · depende: T-027
Guest sem fricção (token atual); janela discreta (canto, colapsável, nunca modal em partida): "Entrar com Google" + link pequeno "registre-se" (email/senha, páginas Django); JWT no join do Colyseus; guest vincula estatísticas ao logar; nome vem da conta.
**Aceite:** jogar sem login = 1 clique como hoje; login no meio da sessão não derruba a partida; JWT inválido cai para guest.

### T-029 — ADR-012 liga na conta 〔P〕 · depende: T-028
Acumulador da box + estatísticas por conta no Django (guardrail: nunca poder in-round). Painel do jogador simples (stats) no Django.
**Aceite:** box soma na conta logada; guest→login migra acumulado.

### T-030 — Docker compose dev/prod + scripts de boot 〔G〕
Dockerfiles (game-server, client→nginx, backend+gunicorn) + `docker-compose.dev.yml` (hot-reload, debug on) e `docker-compose.prod.yml` (TLS via proxy, HUD prod, restart policies); `scripts/dev.sh`/`scripts/prod.sh`: sobem, rodam migrações, verificam `/healthz` de cada serviço e portas, imprimem diagnóstico claro de falha.
**Aceite:** máquina limpa: `./scripts/dev.sh` → jogo jogável; `./scripts/prod.sh` → build prod completo; falha de um serviço identificada pelo script em <30s.

### T-031 — Hardening de produção 〔M〕 · depende: T-030
`/healthz` nos 3 serviços, rate-limit de mensagens por cliente no Colyseus, limites de sala, logs de erro estruturados (integra T-026), backup automático do Postgres, `.env.dev`/`.env.prod` segregados e documentados.
**Aceite:** flood de mensagens não derruba tick; restore de backup testado; nenhum segredo commitado.

### T-OPTIONAL 1 — Passe de balance final (já no BACKLOG) · antes do lançamento
10 partidas de bots com perfis (T-008b) nos mapas novos; ajustar `docs/ai/balance-T014-ttk.md`.

### T-032 — 🚀 LANÇAMENTO V1 〔G〕 · depende: todas — ver §8 original; aceites mantidos

---

## 9. Ajustes pós-revisão do CD (2026-07-05) — INCORPORADOS às specs

**A1 — Controles são PERFIS, não um modo único (revisa o T-019 e o "conflito 1" do §1).**
O jogo é *estilo Valorant, porém 3D leve e simplista, com habilidades/atributos gamificados* — a jogabilidade (divertida, pouco frustrante) é o critério nº 1. "CS 2D" era sobre **liberdade de movimento + disparo com lógica "realista" para o estilo**, não sobre um esquema fixo de mouse. Decisão (ADR-015): nasce uma **camada de perfis de controle** no cliente — todo perfil produz a mesma intenção `{move, aim, fire}` (o protocolo atual já é esse); a **rotação do player é resolvida por perfil**:

| Perfil | Movimento | Mira/rotação | Alvo |
|---|---|---|---|
| `mouse` | WASD (strafe) | crosshair 360° no cursor | desktop com mouse |
| `keyboard` | WASD | rotação por teclas (←/→ ou J/L giram a mira; sem mirar, facing segue o movimento) | notebook sem mouse |
| `touch` | stick virtual esquerdo | stick direito mira e atira (twin-stick) | celular/tablet |

Auto-detecção do dispositivo + seletor manual. Servidor não muda (autoridade e facing híbrido já existem desde a SPEC-0003) — perfis são 100% do lado do input. T-019 dividida: **T-019 (camada de perfis + perfil `mouse`)** e **T-019b (perfis `keyboard` e `touch` v1)**.

**A2 — Bot é uma ARQUITETURA DE IA reutilizável, não um script (revisa o T-020).**
Pedido: aprofundamento teórico — um algoritmo que sirva a diversas "características". Resposta: **`docs/ai/bot-architecture.md`** (novo, entra junto desta aprovação) define a arquitetura em camadas **Percepção → Memória → Decisão (Utility AI) → Steering contextual → Humanizador → Atuação**, com **Personalidade** como um simples vetor de parâmetros que atravessa todas as camadas. Consequências: o esbarrão na borda (P1) se resolve na camada de steering (repulsão preventiva); "menos robô" se resolve no humanizador (reação, lerp de mira, cadência); perfis/boss (T-008b) e o Guardian (pós-V1) viram **presets de personalidade**, não código novo. T-020 passa a ser "implementar a arquitetura do doc".

**A3 — Mapas: IA ajuda a CURAR, não gera sozinha; objetos são REGISTRADOS (revisa T-024/T-025).**
O fluxo desejado: (1) **salvar o mapa gerado atual** como arquivo e poder **reajustá-lo depois**; (2) mapas referenciam **objetos por id** — objetos definidos **em código** (como os props de hoje: pedra/árvore/caixa/muro/bandeira, num registry `ObjectDef` no `shared`) e, futuramente, objetos **salvos no sistema** (Django, F4) — mesma interface, duas origens. Personalizável com pouca complexidade inicial: mapa = metadados + lista de instâncias `{objectId, x, z, rot?, scale?}` + zonas + spawns + bandeira. A CLI ganha **`save-current`** (serializa o mapa da sala em execução, ou regenera pelo seed) além de `gen|save|update|list|preview`. "IA cria mapas" = IA (em sessão com o CD) edita o JSON/usa a CLI e vê o preview ASCII — nunca geração automática em produção.
VPS: deploy do compose prod, domínio + TLS, página inicial mínima (jogar agora + o que é o jogo + privacidade/LGPD), teste de carga com bots (2× o público esperado), checklist go-live (backup, rollback = tag da imagem anterior, monitoração ligada), **divulgação** no canal escolhido pelo CD e coleta de feedback estruturada (telemetria T-026 + formulário curto).
**Aceite:** desconhecido entra pelo link e joga em <10s; sessão de lançamento monitorada sem crash; primeiro relatório de telemetria pós-lançamento gerado.
