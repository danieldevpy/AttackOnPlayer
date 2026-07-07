# PROMPT-0057 — T-057 (SPEC-0015): Janela pré-sala (lobby)

**Data:** 2026-07-06
**Sessão:** 40 (agente worker, Frente L)
**Task:** T-057 〔G〕 — Janela pré-sala

---

## Pedido (resumo fiel)

Implementar o card único pré-sala conforme SPEC-0015, antes do join Colyseus. Seções:
identidade (guest/conta, nick editável), seleção de classe com preview 3D girando
(`createCharacterVisual` da T-053), settings (perfil de controle ADR-015, volumes T-051,
fullscreen T-048), botão **Jogar**. Regra de ouro: 1 clique com defaults sensatos.
Escopo: client-only. Não mexer em schema, protocolo, server, shared, bots.

---

## Decisões tomadas

1. **`showLobby()` retorna `Promise<LobbySelection>`** em vez de callback — padrão mais limpo
   para código assíncrono top-level de módulo ESM. O `connect()` é chamado no `.then()`.

2. **Posicionamento no main.ts:** o lobby é iniciado APÓS toda a inicialização (renderer,
   profileManager, audio) para que o card referencie esses objetos. O `connect()` call original
   foi removido e substituído pelo `.then(selection => connect())` ao fim do arquivo.

3. **Preview 3D:** renderer Three.js separado com canvas próprio no card (sem reutilizar a cena
   do jogo principal — mais simples, zero interferência com o loop principal). Iluminação
   dedicada. `createCharacterVisual` + `updateCharacterAnimation` da T-053 reutilizados.
   `dispose()` chamado ao fechar o lobby para liberar contexto WebGL.

4. **CSS injetado dinamicamente** via `<style id="lobby-styles">` — sem arquivo `.css` avulso,
   consistente com a abordagem do projeto (index.html inline). Injetado uma única vez.

5. **Persistência no lobby:** `aop_lobby_nick`, `aop_lobby_class`, `aop_lobby_skin` em
   localStorage (além dos já existentes de volumes/profile no AudioSystem/ProfileManager).
   Sync com Django delegado à T-058.

6. **`#profile-selector` antigo:** escondido via `style.display = "none"` enquanto o lobby está
   visível; reexibido após o clique em Jogar. Não removido — ainda serve como controle rápido
   durante a partida.

7. **Nick no join:** `name: lobbySelection?.nick` passado para `joinOrCreate` por enquanto.
   Envio completo de `{nick, classId, skinId, profile}` é a T-059.

---

## Resultado verificado

- `npx tsc --noEmit` (client + server + bots): limpo
- `npm run build -w @aop/client`: OK (1.56s, sem erro TypeScript)
- `npm run test -w @aop/shared`: 39/39
- `cd packages/server && npx vitest run`: 89/89
- `cd packages/bots && npx vitest run`: 35/35
- **Verificação funcional (preview DOM):**
  - Card exibido ao abrir — snapshot confirmou: nick gerado, 3 opções de perfil, sliders
    Master/SFX em 100%, checkbox fullscreen, botão Archer, skins Default/Verde/Cinza, canvas
    do preview, botão "▶ JOGAR".
  - 1 clique em Jogar removeu o overlay e exibiu o HUD de jogo com o #profile-selector.
  - Screenshot timeout esperado (WebGL/rAF bloqueia captura, aviso operacional documentado).

---

## Arquivos criados/modificados

- `packages/client/src/lobby.ts` — **novo** (card completo)
- `packages/client/src/main.ts` — integração: import + showLobby após profileManager
- `docs/BACKLOG.md` — T-057 marcada ✅
- `docs/DEVLOG.md` — Sessão 40 adicionada
- `docs/SESSAO_ATUAL.md` — substituído
- `docs/prompts/PROMPT-0057.md` — este arquivo

---

## Pendências para tasks seguintes

- **T-058:** localStorage completo (persistência de todos os settings) + sync Django
  (`PUT /api/v1/accounts/settings`); nick sincronizado entre máquinas ao logar.
- **T-059:** join envia `{nick, classId, skinId, profile}`; servidor valida e reflete no estado;
  outros players veem a classe escolhida; bots ganham classe default.
- **T-062:** aba "Ranking" no card (consumir `GET /stats/me` + `GET /ranking`).

---

## Regras que nascem daqui

- Overlay de lobby deve ser resolvido via Promise — o game loop e o connect ficam separados e
  o lobby pode ser removido/reaproveitado sem refatoração de `main.ts`.
- Preview 3D de personagem em overlay: sempre renderer separado com `dispose()` no fechamento;
  nunca reusa a cena principal (evita interferência com o loop do jogo).
