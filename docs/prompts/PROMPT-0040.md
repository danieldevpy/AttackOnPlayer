# PROMPT-0040 — T-025: CLI de mapas · 2026-07-06

## Pedido (resumo fiel do CD)
"Comece a implementar as tasks a partir da T-025" — retomar a fila V1 original (SPEC-0007) depois
de fechar as pendências T-046/T-047 da SPEC-0011. T-025 é a CLI completa de mapas: `npm run map --
gen|save|save-current|update|list|preview`, prevista desde a spec para fechar o fluxo "gerar →
salvar → reajustar → jogar" sem tocar em código.

## Decisões tomadas (e por quem)
- **`gen` não grava nada; `save` grava (IA, leitura da spec):** a spec lista `gen` e `save` como
  verbos distintos — a leitura mais útil é `gen` = explorar seeds rapidamente (stdout only),
  `save` = persistir uma vez decidido. Evita gravar lixo em `maps/` a cada teste de seed.
- **`update` regenera conteúdo preservando id/name/author (IA):** cobre o "reajustar" do fluxo da
  spec — troca seed/w/h de um mapa já salvo sem perder a identidade (rooms que referenciam esse
  `mapId` continuam válidas). Não é edição manual de instância; para isso o CD edita o JSON direto
  (fluxo já coberto pelo loader + validação, critério de aceite da spec).
- **`save-current` regenera por seed em vez de perguntar ao servidor pelas instâncias (IA, nota da
  própria spec):** a sala expõe `{w,h,seed}` via `/debug/rooms` (adicionado `mapId` a esse mesmo
  endpoint); `buildMap(w,h,seed)` reproduz exatamente o mapa procedural que a sala já está jogando
  (gerador determinístico) — não precisou de nenhum endpoint novo para "baixar" props. Se a sala
  já roda um mapa CURADO (`mapId` setado), `save-current` reempacota o arquivo já existente sob o
  id pedido, em vez de tentar regenerar (não há seed pra regenerar um mapa editado à mão).
- **Preview ASCII sem redução de escala (IA):** mapas de 75x65 imprimem linhas longas no
  terminal — aceito, a spec só pede "legível o suficiente para revisar", não que caiba na tela.
- **CLI sem dependência nova (IA, escopo):** parser de flags `--key value` escrito à mão (~30
  linhas) em vez de puxar `commander`/`yargs` — evita dependência nova pra algo que 6 comandos
  fixos não justificam.

## Resultado verificado
- **Novo em `packages/shared`:** `gameMapToMapFile` (inverso de `mapFileToGameMap`, empacota um
  `GameMap` gerado por seed no formato v1) e `mapFilePreview` (ASCII: paredes/props pelo footprint
  do registry, spawns `S`, bandeira-objetivo `F`) em `mapFile.ts`. 4 testes novos
  (round-trip de colisão, metadado aplicado, dimensão do grid, marcadores S/F) — shared **29/29**.
- **Novo:** `packages/server/src/cli/mapCli.ts` — os 6 comandos (`gen/save/save-current/update/
  list/preview`), script raiz `npm run map --`. `MAPS_DIR` exportado de `mapLoader.ts` (reusa a
  mesma lógica de path, sem duplicar).
- **`/debug/rooms` ganhou `map.mapId`** (server/index.ts) — só exposição de um campo que já existia
  no state; usado por `save-current` pra distinguir sala procedural (regenera por seed) de sala
  curada (reempacota o arquivo).
- **Testado manualmente ponta a ponta:** `gen` (preview sem gravar) → `save arena-cli-teste`
  (grava, recusa sobrescrever sem `--force`) → `list`/`preview` (lêem `arena-teste`, o mapa curado
  da T-024, e o novo) → `update` (regenera preservando name/author) → subida de servidor real na
  porta 2601 + 4 bots headless → `save-current` capturou a sala ao vivo (`arena-live-capture`,
  75x65, mesma seed) → **novo servidor + bots com `BOT_MAP_ID=arena-live-capture` carregaram o
  mapa curado e jogaram normalmente** (log: `mapa 75x65 (curado: arena-live-capture)`, bots
  recebem `map_data`, level up ocorre). Critério de aceite #1 da spec confirmado ao vivo.
- **2 mapas curados no repo:** `maps/arena-teste.map.json` (T-024, à mão) + `maps/arena-live-
  capture.map.json` (T-025, capturado de sessão real) — critério de aceite #3.
- **Gates:** shared **29/29** · server **49/49** · bots **35/35** · `tsc --noEmit` limpo em
  server/client/bots.

## Regras que nascem daqui
- Mapas procedurais capturados via `save-current` não precisam de transporte de instâncias pela
  rede — bastam `(w,h,seed)`, já expostos em `/debug/rooms`; qualquer ferramenta futura que precise
  "ver o mapa de uma sala rodando" pode reusar o mesmo truque (`buildMap` é puro e determinístico).

## Pendências para o próximo prompt
- Critério de aceite #2 da spec ("editar o JSON e jogar a versão ajustada sem tocar em código") já
  é coberto pelo loader+validação da T-024 — não requer código novo, só um teste manual do CD se
  quiser confirmar por conta própria.
- Fila V1: com T-024/T-025 fechadas, F3 (SPEC-0007) está completa. Próxima fase é **F4 —
  Plataforma (SPEC-0008)**: T-026 (telemetria NDJSON) → T-027 (backend Django) → T-028 (auth) →
  T-029 (ADR-012 na conta).
