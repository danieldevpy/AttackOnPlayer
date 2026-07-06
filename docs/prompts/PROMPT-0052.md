# PROMPT-0052 — Deploy em VPS sem domínio + reorganização de scripts · 2026-07-06

## Pedido (resumo fiel)

Pedido direto do CD, em três partes ao longo da conversa (fora da fila V1):
1. Plano de estudo pra colocar o projeto em produção numa VPS pra jogar com amigos; perguntou
   primeiro se dava pra rodar tudo direto no IP público sem domínio e, se sim, o plano de deploy
   com poucos passos ou um arquivo shell.
2. Depois de confirmar o deploy funcionando na VPS, pediu que o script também soubesse subir
   bots, no mesmo estilo do `run.sh` de dev.
3. Por fim, pediu pra separar todos os scripts `.sh` numa pasta `/script`, commitar incluindo os
   scripts, e fazer merge na `main` (o push pro GitHub o CD faz manualmente).

## Decisões tomadas (e por quem)

- **IA — sim, dá pra rodar sem domínio:** confirmado lendo o código, não supondo — o game server
  (`packages/server/src/index.ts`) já escuta em todas as interfaces (`httpServer.listen(port)`
  sem host); o client é só HTML/JS/CSS estático; página `http://` conectando em WebSocket `ws://`
  não sofre bloqueio de mixed content (esse bloqueio só existe partindo de `https://`); backend
  Django é opcional (`PLATFORM_ENABLED` off por padrão em `ArenaRoom`).
- **IA — único ajuste de código necessário:** `packages/client/src/main.ts` tinha uma regra que
  assumia `wss://` (TLS) pra qualquer host que não fosse `localhost`/`192.x` — quebraria a conexão
  num IP público sem certificado (Let's Encrypt exige domínio, exatamente o que se quer evitar).
  Adicionei override de build `VITE_SERVER_URL` (lido via `import.meta.env`) que, se setado, força
  `ws://` explícito pro host:porta do server; se não setado, cai na regra antiga — **não afeta o
  fluxo oficial com domínio/TLS do SPEC-0009/M5**, que não seta essa env.
- **IA — pm2 em vez de nodemon/tsx watch em produção:** processos sobem via `pm2 start npm ...`
  usando `npm run start` (não `dev`, que é watch/hot-reload) — restart automático se cair,
  `pm2 save`/`pm2 startup` pra sobreviver a reboot.
- **IA — bots via pm2, espelhando `run.sh`:** `-b/-c/-t` com os mesmos defaults e semântica do
  `run.sh` de dev (2 bots, duração 0 = pra sempre). Diferença deliberada: quando a duração é
  finita, adiciono `--no-autorestart` no processo pm2 dos bots — sem isso, o pm2 tentaria
  reiniciar o processo em loop toda vez que os bots terminassem sozinhos após a duração.
- **IA — escopo da reorganização de scripts (pergunta feita ao CD):** existiam 5 `.sh` no repo.
  Perguntei o que fazer com `backend/dev.sh` (acoplado aos arquivos do Django em `backend/` —
  venv, docker-compose.yml, manage.py ao lado — e referenciado como `cd backend && ./dev.sh` em
  vários docs) e com o script do skill `attackonplayer-executor-skill/scripts/execute-task.sh`
  (não é parte do jogo). **CD escolheu:** mover só os 3 soltos (`run.sh`, `snapshot-test.sh`,
  `deploy/deploy-vps-sem-dominio.sh`) pra `script/`; deixar `backend/dev.sh` onde está e ignorar o
  script do skill.
- **IA — ajuste de path no `script/run.sh`:** o `cd "$(dirname "$0")"` original assumia que o
  script morava na raiz do repo; movido um nível pra dentro, virou `cd "$(dirname "$0")/.."`.
  `script/snapshot-test.sh` não precisou de ajuste de lógica (usa `$(pwd)`, não `dirname`) — só
  texto de uso atualizado.
- **IA — `run.sh`/`snapshot-test.sh` eram untracked:** uma nota de sessão anterior (`SESSAO_ATUAL.
  md`) os marcava como "resíduo não relacionado, ainda não investigado (não tocar)". Como o
  pedido de reorganizá-los veio diretamente do CD (autoridade final por `AGENTS.md`), tratei isso
  como a investigação/decisão pendente sendo resolvida agora, não como uma violação da nota —
  atualizei a nota em `SESSAO_ATUAL.md` pra refletir o novo estado.

## Resultado verificado

- `packages/client/src/main.ts`: override `VITE_SERVER_URL` adicionado (poucas linhas, ver
  `git diff`). `tsc --noEmit` limpo antes e depois; `vite build` real com
  `VITE_SERVER_URL=ws://203.0.113.10:2567` gerou bundle com o IP fixo dentro (grep confirmado).
- `script/deploy-vps-sem-dominio.sh` (novo): detecta IP público (arg ou auto via `ifconfig.me`/
  `ipinfo.io`), instala Node 20/pm2 se faltar, `git pull` se for clone git, `npm install`, build
  do client com o IP certo, sobe `aop-server`+`aop-client` (+`aop-bots` se `-b`) via pm2, libera
  `ufw`, healthcheck em `/health`. Idempotente (rodar de novo atualiza tudo). `bash -n` limpo.
  Parsing das flags `-b/-c/-t` testado isolado (todas as combinações: sem args, só IP,
  `-b -c 5 -t 60 IP`, `-b` sem IP) — resultados corretos.
- `script/run.sh` e `script/snapshot-test.sh`: movidos, path/texto ajustado, `bash -n` limpo.
- `docs/deploy/PLANO-VPS-SEM-DOMINIO.md` (novo): plano de estudo (SSH, firewall SO+provedor,
  pm2, serving estático de SPA, WS sem proxy reverso, build-time vs runtime env) + passo a passo
  + trade-offs de rodar sem TLS + quando migrar pro fluxo oficial (SPEC-0009/M5).
- `npm run aci -- index` rodado após cada lote de mudança de código/doc.
- Backend Django, `SPEC-0009`, ROADMAP e BACKLOG não foram tocados — os dois fluxos de deploy
  (sem domínio / com domínio) coexistem sem conflito.
- **Confirmado pelo CD:** deploy na VPS real funcionou.

## Limitação de verificação

Não há VPS real neste ambiente de execução — a validação foi por leitura de código (bind de
interface do `httpServer.listen`, ausência de CORS/mixed-content), `tsc`/`vite build` reais e
teste isolado do parsing de flags em bash. O go-live de fato foi confirmado pelo CD numa VPS
própria, fora deste ambiente.

## Regras que nascem daqui

- Deploy "rápido pra jogar com amigos" (IP público, sem domínio/TLS) e o lançamento oficial
  (SPEC-0009, domínio+TLS+Docker+hardening) são **dois fluxos paralelos, não substitutos** — o
  primeiro não deve herdar complexidade do segundo (Docker, Django obrigatório, etc.), e mudanças
  num não devem quebrar o outro (por isso o override por env em vez de trocar a regra default).
- Scripts soltos na raiz do monorepo vivem em `script/`; scripts fortemente acoplados a um
  sub-projeto (ex. `backend/dev.sh`, colado no venv/docker-compose/manage.py do Django) ficam
  onde estão — não centralizar por centralizar.
- Scripts em `script/` (um nível abaixo da raiz) que precisam achar a raiz do repo usam
  `cd "$(dirname "$0")/.."`; os que só dependem do `$(pwd)` (ex. `snapshot-test.sh`) não precisam
  de ajuste de lógica ao mover, só de texto de uso.
