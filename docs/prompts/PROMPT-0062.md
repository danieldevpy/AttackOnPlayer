# PROMPT-0062 — Hotfix: lobby não montava após regressão de integração T-057×T-062

**Data:** 2026-07-07
**Tipo:** hotfix / regressão de integração
**Arquivo afetado:** `packages/client/src/lobby.ts`

---

## Bug reportado

O jogo não iniciava; console exibia:

```
Uncaught (in promise) NotFoundError: Failed to execute 'insertBefore' on 'Node':
The node before which the new node is to be inserted is not a child of this node.
    at lobby.ts:765  /  showLobby (lobby.ts:577)  /  main.ts:1100
```

A Promise de `showLobby` rejeitava antes de conectar ao servidor, impedindo qualquer partida.

---

## Causa raiz

Regressão de integração entre T-057 (estrutura original do lobby) e T-062 (tabs Principal/Ranking).

A T-062 reestruturou o DOM do card:

- Antes (T-057): `card` → `header` → `body` (filho direto)
- Depois (T-062): `card` → `header` → `panels` → `mainPanel` → `body`

Porém a linha ~765 manteve `card.insertBefore(tabs, body)` da estrutura antiga — onde `body` era
filho direto de `card`. Como `body` passou a ser filho de `mainPanel` (neto de `card`), o
`insertBefore` lançava `NotFoundError`.

A linha ~818 (`card.insertBefore(panels, card.lastElementChild)`) também era frágil por depender
do estado corrente do card em vez de uma montagem explícita.

---

## Correção aplicada

Substituídos os dois `insertBefore` frágeis por montagem linear e explícita ao final da construção
do DOM, na ordem visual pretendida:

```
card: header (já appendado) → tabs → panels → footer
```

Linha 765 (antes):
```ts
card.insertBefore(tabs, body);
```
Substituída por comentário + montagem adiada.

Linhas 816-818 (antes):
```ts
panels.appendChild(mainPanel);
panels.appendChild(rankingPanel);
card.insertBefore(panels, card.lastElementChild);
card.appendChild(footer);
```

Substituídas por:
```ts
panels.appendChild(mainPanel);
panels.appendChild(rankingPanel);
// Montagem linear explícita: header → tabs → panels → footer
card.appendChild(tabs);
card.appendChild(panels);
card.appendChild(footer);
```

---

## Verificação funcional

Gates executados:

- `tsc --noEmit` (server, client, bots): limpo
- `npm run build -w @aop/client`: OK (675 kB / 1.65 s)
- `npm run test -w @aop/shared`: 49 tests passed
- `vitest run (server)`: 98 tests passed
- `vitest run (bots)`: 35 tests passed

Validação funcional via preview (port 5299):

- Console: **sem NotFoundError nem outros erros** (apenas warnings de CSP do Electron, pré-existentes)
- DOM snapshot confirmou estrutura correta: header → tabs (PRINCIPAL / RANKING) → panels (nick,
  perfil, classe, skin, preview) → footer (▶ JOGAR)
- Tab Ranking clicada via `preview_eval`: `lobby-panel-ranking` ganhou classe `active`,
  `lobby-panel-main` perdeu — alternância OK
- Retorno para Principal: `lobby-panel-main` voltou a `active` — OK
