# PROMPT-0047 — T-052 (SPEC-0014): Registry de classes (contrato) · 2026-07-06

## Pedido (resumo fiel)

Executor de task (agente worker) recebeu **T-052** do BACKLOG (Frente C — Personagens/classe/
skin, PROPOSAL-0004, shared+server): `packages/shared/src/classes.ts` com `ClassDef { id,
launcherIds, baseTint, skinIds }` e `CLASS_REGISTRY` contendo só `archer` (os 3 launchers
atuais — `basic_shot`/`heavy_shot`/`rapid_shot` — viram os "projéteis da classe"); `Player.
classId`/`skinId` no schema (`ArenaState.ts`); join valida contra `CLASS_REGISTRY`
(inválido/ausente ⇒ default, nunca rejeita). Aceite: testes de join com classe válida/
inválida/ausente; bots sem regressão; tsc ×3.

## Decisões tomadas (e por quem)

- **IA:** contrato modelado como `Record<string, ClassDef>` + funções puras
  `isValidClassId`/`isValidSkinId`/`resolveClassSelection` — mesmo padrão de `SKILLS`/
  `combinedSkillMods` (T-017) e de `WEAPON_PICKUP_LAUNCHERS`/`weaponRespawnDelay` (T-039):
  registro data-driven + função de resolução pura e testável, nada de lógica de validação
  solta no `Room`.
- **IA:** `resolveClassSelection` cobre os 3 casos do aceite num único helper (classe/skin
  válidas passam; classe inválida cai pro default; skin inválida CROSS-classe ou inexistente
  cai pra 1ª skin da classe resolvida) — `ArenaRoom.onJoin` só chama a função e atribui,
  mantendo a regra "join nunca rejeita" (mesmo espírito do `authToken` opcional da T-028b).
- **IA:** `baseTint` do `archer` é placeholder (`0x6b4f2a`, tom couro/madeira) — decisão de
  cor final fica pra T-053 (visual procedural) com referência do CD; aqui é só o contrato.
- **IA:** `Player.skinId` no schema usa `CLASS_REGISTRY[DEFAULT_CLASS_ID].skinIds[0]` como
  default em vez de repetir a string `"default"` — se a 1ª skin da classe archer mudar de
  nome no futuro, o schema não precisa de edição manual em paralelo.
- **Fora de escopo (fica pra outras tasks já mapeadas no BACKLOG):** trocar o `launcher`
  ativo do player com base em `classId` (só existe 1 classe, sem efeito prático ainda);
  protocolo completo de join `{nick, classId, skinId, profile}` e troca de classe pós-join
  visível a outros players (T-059); visual procedural/skins por paleta (T-053/T-056).

## Resultado verificado

- `packages/shared/src/classes.ts` novo (`ClassDef`, `CLASS_REGISTRY` com `archer`,
  `DEFAULT_CLASS_ID`, `isValidClassId`, `isValidSkinId`, `resolveClassSelection`); exportado
  em `packages/shared/src/index.ts`.
- `packages/server/src/state/ArenaState.ts`: `Player.classId`/`Player.skinId` novos, default
  vindo do registro.
- `packages/server/src/rooms/ArenaRoom.ts`: `onJoin` aceita `classId?`/`skinId?` nas options e
  resolve via `resolveClassSelection` antes de atribuir ao `Player`.
- Testes novos: `packages/shared/src/classes.test.ts` (8 casos — registro, validadores,
  resolução válida/inválida/ausente/skin-cruzada) e `packages/server/src/rooms/classes.test.ts`
  (4 casos de `onJoin` — válida, classe inválida, ausente, bot sem regressão).
- Gates: `npm run test -w @aop/shared` 38/38 · `cd packages/server && npx vitest run` 80/80
  (nenhum teste pré-existente quebrou) · `tsc --noEmit` limpo em `server`/`client`/`bots`
  (shared não tem `tsconfig.json` próprio, típico do pacote). Smoke manual: `npm run dev:server`
  + `npm run bots -- 3 8` — 3 bots entraram, subiram de nível, saíram sem erro (classe default
  aplicada silenciosamente, sem quebrar o fluxo de bot que não envia `classId`).
- `npm run aci -- index` rodado ao final.

## Regras que nascem daqui

- Contrato de classe segue o mesmo molde de `SKILLS`/`WEAPON_PICKUP_LAUNCHERS`: registro
  central + função pura de resolução, nunca validação ad-hoc dentro do `Room`. Task futura de
  classe nova (guerreiro/mago) é só 1 entrada em `CLASS_REGISTRY` — nenhum outro arquivo desta
  task deveria precisar mudar.
