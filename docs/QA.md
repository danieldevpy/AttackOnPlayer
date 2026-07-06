# QA — o que é garantido automaticamente

> Mapa de cobertura de testes e checklist antes de merge. **Não substitui** o veredito do CD em fluxos de combate/UI.  
> Atualizar quando nascer teste novo, bot behavior ou fluxo crítico.

---

## Gates automáticos (rodar antes de merge)

```bash
npm run test                               # vitest @aop/shared
cd packages/server && npx vitest run       # vitest @aop/server (combate/mobilidade, T-008/T-012)
cd packages/bots && npx vitest run         # vitest @aop/bots (decisão/steering/cards puros, T-020/T-008b)
cd packages/server && npx tsc --noEmit
cd packages/client && npx tsc --noEmit
cd packages/bots && npx tsc --noEmit
npm run bots -- 3 30                       # smoke headless

# Guarda (T-011, PROMPT-0016): nenhum .js compilado deve existir do lado de um .ts em src/ —
# Vite resolve import sem extensão preferindo .js, e um .js órfão vence o .ts real em silêncio.
find packages/*/src -name "*.ts" ! -name "*.d.ts" | sed 's/\.ts$/.js/' | xargs -I{} sh -c '[ -f "{}" ] && echo "STALE JS: {}"'

# Backend Django (T-027, SPEC-0008/ADR-016) — banco de teste real via docker compose
docker compose -f backend/docker-compose.yml up -d db
cd backend && . .venv/bin/activate
python -m pytest                                     # todos os apps, contra Postgres
python manage.py makemigrations --check --dry-run     # sem migration faltando
ruff check .                                          # lint
```

| Gate | Cobre | Não cobre |
|---|---|---|
| `npm run test` (shared) — **13 testes** | Curva XP, `pickWeighted`, cards de level-up (determinismo/soma/auto-pick, T-016), `combinedSkillMods` (T-017) | Combate, reroll, rede |
| `npx vitest run` (server) — **19 testes** | Cadeia tiro→dano→morte→kill, safe zone, **invulnerabilidade de nascimento (SPEC-0005: escudo bloqueia dano + cai ao atirar)**, mobilidade (T-012), **guardas de balance da SPEC-0004** (TTK 5 tiros / full-força 3 tiros), ATTR_DEFS/tetos, cadência/alcance no ProjectileSystem, reroll soma preservada, multishot/pierce/fôlego/kill_rush (T-017) | Protocolo de rede real dos cards; XP passivo e morte-zera-nível (rodam no Room, não nos systems) |
| `npx vitest run` (bots) — **17 testes** | **Decisão (utility AI, T-020):** engajar/fugir/coletar/perambular escolhidos corretamente, inimigo em zona safe não é alvo, inércia evita oscilação. **Steering contextual:** segue o vetor desejado, desvia de perigo na direção do alvo, não empurra sem alvo e com perigo total, strafe orbital (`lateralBias`) muda de lado com o sinal. **Política de cards por perfil (T-008b):** cada perfil escolhe seu card preferido quando presente, determinístico, cai no 1º da oferta sem preferido (marco de skill) | Percepção/memória/humanizador (estado vivo, cobertos pelo smoke headless); boss (server-side, coberto só pelo smoke) |
| `tsc --noEmit` | Compilação server/client/bots | Comportamento runtime |
| Bots headless | Movimento, colisão, coleta, sync, métricas JSONL, tiro/kill/respawn, **fluxo real oferta→escolha→aplicação de card** (bots escolhem via `choose_upgrade`, T-016) | Reroll |
| `pytest` (backend Django, T-027) — **71 testes** | accounts (modelo/JWT/guest/JWKS/link), maps (validação espelho do TS + `import_maps` + endpoints), gameops (`RoomConfig`/`GameEvent`/config efetiva por janela), telemetry (ingestão batch + schema version), tudo contra Postgres real | Fluxo completo de login (Google/registro — T-028); integração real do Node consumindo o Django em produção (coberta manualmente, ver Matriz) |
| `platformClient.test.ts` (server, T-027g) — **8 testes** | Cache/TTL do `gameops/config`, fallback pros defaults quando o Django nunca respondeu, mantém o último cache bom quando cai depois de responder, batch de telemetria + descarte gracioso em falha | Integração real de rede (coberta manualmente) |

**CI:** ainda não existe no repositório — gates são locais até GitHub Action ser adicionada.

---

## Matriz: feature → como validar

| Feature | Automático | Manual recomendado |
|---|---|---|
| Mapa / zonas / props | Bots coletam | Olhar chão colorido no client (só guerra/campo — **sem safe**, SPEC-0005) |
| XP / level-up | Teste curva XP | HUD mostra nível subindo |
| **XP passivo (+1/s, SPEC-0005)** | Bots sobem de nível sem kill (smoke) | Ficar parado e ver o nível subir sozinho; **HUD mostra XP inteiro** (`xp N/M`, sem casas decimais) |
| Atributos | — | F3 ou state sync |
| Coletáveis por zona | Bots + métricas por kind | farm_event no HUD |
| Reroll (R) | — | Acumular 15+ coins, pressionar R, ver stats mudarem **e o XP/nível subir (+20 XP, SPEC-0005)** |
| Tiro / dano | — | **2 abas** no browser |
| Morte / respawn / **nível zera** (SPEC-0005) | — | **2 abas** + F3 (`death`, `respawn` com `levelAfter:1`, `hit`, `shield_block`) |
| **Invuln de nascimento (3s, SPEC-0005)** | Teste server (`shield_block` + cai ao atirar) | F3 mostra `escudo` contando; bolha azul no player; tiro no recém-nascido não tira HP; atirar remove o escudo |
| Facing por **perfil de controle** (ADR-015/T-019, revisa SPEC-0005) | Lógica do perfil `mouse` verificada isolada (crosshair segue cursor, `aimX` troca de sinal com o lado da tela) | Perfil mouse: mover o mouse gira o facing/tiro para o crosshair em qualquer ângulo, mesmo parado; soltar o mouse da janela mantém o último facing; F3 mostra `facing` seguindo a mira |
| Perfis **keyboard/touch + seletor** (ADR-015/T-019b) | Lógica isolada via `preview_eval` (setas giram o ângulo; sticks touch produzem move/aim/fire corretos e resetam ao soltar) | **Obrigatório em dispositivo touch real** (bots não cobrem, viewport mobile emulado não substitui o toque de verdade): jogar um round inteiro só com `keyboard` e só com `touch`; seletor (topo) troca sem reconectar; escolha persiste ao recarregar |
| Gatilho (espaço/clique) | Bots (T-013, mira contínua + gatilho) | F3 mostra `gatilho` ativo; espaço e clique geram projétil idêntico |
| Ganchos de mobilidade (T-012) | Teste unitário (`projectiles.test.ts`) | `dev_launcher` + `DEBUG=1` no F3 (velocidade cai e volta sozinha) |
| Bot: ritmo de ataque por skill | `npm run bots` — contar tiros por skill | — |
| Bot: anti-stuck | `BOT_VERBOSE=1` — log `"preso — escapando lateralmente"` | Observar bot perto de prop no client |
| Debug F3 | — | F3 + `/debug/rooms` (sem precisar de `DEBUG=1`) |
| Persistência box (scaffold) | — | Mesmo token reconecta; log servidor |
| Cards de level-up (T-016) | Testes shared + bots (hp 104 no nível 2 = card aplicado) | Subir de nível no browser: 3 cards aparecem, 1/2/3 escolhe, timeout 5s auto-pick, badge de fila |
| Atributos cadência/alcance (T-015) | Testes server | F3 mostra `cadência (×cd)`/`alcance (×range)` mudando ao escolher cards |
| Skills de projétil (T-017) | Testes server (multishot/pierce/fôlego/kill_rush) | Nível 4: card ★; tiro duplo visível; box em zona de guerra dá skill (evento `box_skill` no F3) |
| Juice de poder (T-018) | — | Aro âmbar no nível 4+, pulsante no 8+; números de dano flutuantes; streak no HUD com 2+ kills |
| **Arquitetura de IA em camadas (T-020)** | Testes puros de decisão/steering (11) | `BOT_VERBOSE=1 npm run bots -- 4 20`: engajar/fugir/coletar/level_up/speed_up aparecem no log; `"preso — escapando lateralmente"` raro (steering evita a maior parte da borda/prop) |
| **Perfis nomeados + boss (T-008b)** | Testes puros de `pickCard` (6) | `npm run bots -- 4 20` sem `BOT_SKILL`/com perfis sorteados no log (`— perfil agressivo/cauteloso/cacador/equilibrado`); `BOT_BOSS=1 npm run bots -- 1 10` mostra `[BOSS]` no log do servidor e o bot nasce nível 6–8 (F3 ou log `level_up! nível N` imediato) |
| **Backend Django: guest→conta (T-027)** | pytest cobre guest/link/JWKS/JWT expirado-inválido | `POST /auth/guest` → jogar → `POST /auth/link` → `GET /auth/me` mostra os stats na conta |
| **Backend Django: evento sem deploy (T-027e, aceite #2)** | pytest cobre janela ativa/fora da janela/desabilitado | Admin cria `GameEvent` ativo → `GET /gameops/config/` reflete na hora, sem deploy |
| **Backend Django: degradação (T-027g, aceite #3)** | `platformClient.test.ts` (fetch mockado) | Derrubar o processo Django com uma sala aberta → partida em andamento não cai; nova sala usa cache/defaults (`PLATFORM_ENABLED=1`) |

---

## Checklist de merge para `main`

### Obrigatório

- [ ] `npm run test` (shared) — 13/13
- [ ] `npx vitest run` (server) — 17/17
- [ ] `npx vitest run` (bots) — 17/17 (T-020/T-008b)
- [ ] Typecheck limpo (3 packages)
- [ ] `npm run bots -- 3 30` — sem crash
- [ ] Guarda de `.js` órfão (ver Gates automáticos) — sem saída
- [ ] Se tocou `backend/`: `pytest` verde, `makemigrations --check` limpo, `ruff check` limpo (T-027)
- [ ] Working tree limpa; commits coerentes
- [ ] `docs/SESSAO_ATUAL.md` reflete o merge
- [ ] Task correspondente ✅ no `BACKLOG.md` **ou** na spec ativa em `specs/`

### Manual (M1 — combate presente)

- [ ] Duas abas: kill → respawn → tiro funciona fora da safe zone (espaço e clique, mesmo facing)
- [ ] F3 mostra `safe_block` quando alvo protegido, sem precisar de `DEBUG=1`
- [ ] Sem regressão óbvia de movimento/coleta

### Não bloqueia merge deste pacote

- T-008b (personalidade/atributos sorteados de bot + modo boss)
- Balance TTK formal
- Touch / arte / deploy

---

## Veredito do Creative Director

Ao testar no browser, registrar no `PROMPT-NNNN.md` da leva:

```md
## Veredito CD
- Testado em: AAAA-MM-DD
- Fluxos: [ ] movimento [ ] coleta [ ] facing (mira/teclado/parado) [ ] combate 2 abas [ ] F3 [ ] reroll
- Resultado: aprovado / ajustes pedidos
- Observações: ...
```

Se o veredito mudar o entendimento do jogo, atualizar também `docs/mechanics/PLAYER_LOOP.md`.

---

## Dívida conhecida (não esconder)

| Dívida | Impacto | Mitigação atual |
|---|---|---|
| Poucos testes unitários | Regressão em fórmulas/combate | vitest em curva XP + spawn weights |
| Bots não combatem | Kill/death não exercitados em CI | Smoke manual 2 abas |
| Sem CI | Merge depende de disciplina local | Este checklist |
| Números só no código | Docs podem envelhecer | PLAYER_LOOP aponta para constants.ts |

Próximas melhorias naturais: bots T-008 no smoke, testes de `lossFraction`/`rerollAttrPoints`, GitHub Action mínima.
