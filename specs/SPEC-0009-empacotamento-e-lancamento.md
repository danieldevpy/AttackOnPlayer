# SPEC-0009 — V1/F5+F6: Docker dev/prod, hardening e lançamento na VPS

**Status:** aprovada · **Marco:** V1 (F5+F6) · **Data:** 2026-07-05
**Origem:** PROPOSAL-0002 (§2, §4, tasks T-030..T-032)

## Problema / objetivo
Hoje o projeto sobe por npm em uma máquina de dev. Para a V1 pública: ambientes dev/prod reproduzíveis por container, script único que sobe e **verifica** tudo, hardening básico e o go-live na VPS com divulgação.

## Comportamento esperado
- **Containers:** Dockerfiles para game-server (Node), client (build Vite → nginx) e backend (Django+gunicorn); `docker-compose.dev.yml` (hot-reload, HUD dev, bots fáceis) e `docker-compose.prod.yml` (TLS via proxy, HUD prod, restart policies, logs rotacionados).
- **Scripts:** `scripts/dev.sh` e `scripts/prod.sh` — sobem, rodam migrações, verificam `/healthz` de cada serviço e portas, e imprimem diagnóstico claro do que falhou (estabilidade bem identificada — P8).
- **Hardening:** `/healthz` nos 3 serviços; rate-limit de mensagens por cliente no Colyseus; limites de sala; backup automático do Postgres com restore testado; `.env.dev`/`.env.prod` segregados.
- **Lançamento:** deploy do compose prod na VPS, domínio + TLS, página inicial mínima (jogar agora, o que é o jogo, privacidade), teste de carga com bots (≥2× o público esperado), checklist go-live (backup, rollback por tag de imagem, monitoração), divulgação no canal escolhido pelo CD e primeiro relatório de telemetria pós-lançamento.

## Fora de escopo
CI/CD completo (GitHub Actions mínima é bônus, não gate), múltiplas regiões, autoscaling, página de status pública.

## Critérios de aceite
- [ ] Máquina limpa: `./scripts/dev.sh` → jogo jogável em dev; `./scripts/prod.sh` → stack prod completa.
- [ ] Falha proposital de um serviço identificada pelo script em <30s com mensagem acionável.
- [ ] Flood de mensagens de um cliente não degrada o tick dos demais.
- [ ] Restore de backup do Postgres executado com sucesso em teste.
- [ ] Desconhecido entra pelo link público e está jogando em <10s (guest).
- [ ] Sessão de lançamento monitorada sem crash; relatório de telemetria gerado no dia seguinte.

## Decisão do Creative Director
Aprovada via PROPOSAL-0002 (2026-07-05). Pendente do CD: canal de divulgação (§7 Q5) — define o alvo do teste de carga.

## Notas da IA
- Lição desta base de código: processos fantasmas seguram portas — os scripts devem detectar e reportar porta ocupada explicitamente.
- Rollback = tag de imagem anterior; nunca "consertar em produção".

## Quebra em tasks
T-030 (compose+scripts) · T-031 (hardening) · T-OPTIONAL 1 (balance final) · T-032 (🚀 go-live) — detalhes no BACKLOG.
