# PROMPT-0053 — T-056 (SPEC-0014): Skins por paleta · 2026-07-06

## Pedido (resumo fiel)

Executor de task (agente worker) recebeu **T-056** do BACKLOG (Frente C — Personagens/classe/
skin, PROPOSAL-0004, shared+client): variações de cor por `skinId` (tabela em `classes.ts`),
aplicadas na fábrica de personagens; gancho pronto pra classes futuras (guerreiro/mago = nova
entrada no registry). **Contexto:** `packages/shared/src/classes.ts` ·
`packages/client/src/characters.ts`. Depende de T-053 (já ✅).

## Decisões tomadas (e por quem)

- **IA:** `ClassDef` ganhou `skinTints: Record<string, number>` — tabela separada de `skinIds`.
  `skinIds` continua sendo só a lista de ids válidos (contrato de rede/validação da T-052,
  `isValidSkinId`/`resolveClassSelection` — nenhum dos dois mudou de assinatura); `skinTints`
  é a nova tabela de cor por id. Manter os dois campos separados evita reabrir o contrato de
  join (T-059 ainda vai consumir só `skinId` como string).
- **IA:** `archer.skinTints.default === archer.baseTint` — a skin default reproduz exatamente o
  visual já aprovado (couro/madeira, ADR-008), zero regressão pra quem não escolhe skin (hoje
  ninguém escolhe de verdade — a seleção de rede é T-059). Duas skins novas de exemplo pra provar
  o mecanismo: `verde` (couro esverdeado) e `cinza` (couro acinzentado).
- **IA:** `paletteFor(classId, skinId)` em `characters.ts` — o parâmetro já existia mas era
  ignorado (`_skinId`, prefixo de "não usado" da T-053/T-054/T-055). Agora lê
  `def.skinTints[skinId] ?? def.baseTint` como o tint que alimenta as sombras derivadas
  (`shade()` pra couro/gola/cinto); pele/cabelo/madeira/metal continuam fixos — são o "material"
  do arqueiro, não a cor da roupa. O cache por `classId:skinId` (`paletteCache`/`segCache`) já
  existia desde a T-053/V2 e não precisou mudar — só passou a produzir paletas distintas de
  verdade por chave.
- **IA:** gancho pra classes futuras já estava no formato do registry (T-052) — guerreiro/mago
  só precisam de uma entrada nova em `CLASS_REGISTRY` com seu próprio `baseTint`/`skinIds`/
  `skinTints`; nada no `characters.ts` referencia `archer` por nome.
- **Fora de escopo (não tocado):** ligar o `skinId` real da rede (`Player.skinId`, já existe
  desde T-052) no `createPlayerVisual` — `visuals.ts` continua fixo em `DEFAULT_CLASS_ID` + skin
  default (comentário existente já aponta isso pra T-059/lobby). UI de seleção de skin é T-057.

## Resultado verificado

- `packages/shared/src/classes.ts`: `ClassDef.skinTints` novo; `archer` ganha `verde`/`cinza`.
- `packages/client/src/characters.ts`: `paletteFor` lê `def.skinTints[skinId] ?? def.baseTint`.
- `packages/shared/src/classes.test.ts`: +1 teste — toda skin do registro tem cor em
  `skinTints`, e a skin default usa exatamente o `baseTint`.
- Sem mudança em schema/protocolo/servidor — `Player.classId`/`skinId` (T-052) intactos.
- `tsc --noEmit` limpo em `server`/`client`/`bots` (`shared` não tem tsconfig próprio; é coberto
  via `include: ["src", "../shared/src"]` dos dois primeiros).
- `npm run test -w @aop/shared` 39/39 (+1) · `(cd packages/server && npx vitest run)` 80/80 ·
  `(cd packages/bots && npx vitest run)` 35/35 — nenhuma regressão.
- **Smoke real:** servidor de dev de outra sessão paralela já estava rodando em `:2567` (`tsx
  watch`, recarrega sozinho com as edições); em vez de derrubá-lo (regra de trabalho paralelo do
  AGENTS.md), rodei os bots reais contra ele: `npm run start -w @aop/bots -- 3 8` — 3 bots
  entraram e saíram da sala sem erro, sem regressão de join.
- Sem alteração observável no browser além da cor do boneco (que hoje é sempre a skin default,
  já que a seleção de rede é T-059) — não abri preview visual; a mudança de cor não é exercitável
  ainda pela UI atual.
- `npm run aci -- index` rodado ao final.

## Regras que nascem daqui

- Quando um campo de contrato (`skinIds`, validado no join) e um campo de apresentação (cor por
  skin) evoluem em paralelo, prefira uma tabela nova (`skinTints`) a estender o campo existente —
  mantém a validação de rede (T-052/T-059) estável enquanto o visual (T-056/T-057) evolui.
- Trabalho paralelo confirmado na prática: outra sessão tinha `dev:server` no ar (`:2567`,
  `tsx watch`); a instrução do AGENTS.md/skill de "nunca derrubar processo de outro agente" foi
  seguida — usei o servidor já ativo pro smoke em vez de subir um novo (que teria dado
  `EADDRINUSE` de qualquer forma).
