# PROMPT-0059 — T-059 (SPEC-0015) Seleção no join · 2026-07-06

## Pedido (resumo fiel do CD)
Executar a T-059 (Frente L): o join do Colyseus deve enviar `{nick, classId, skinId, profile}`; o
servidor valida contra `CLASS_REGISTRY` e reflete no estado; bots ganham classe default. Aceite:
testes de join; troca de classe no lobby aparece pros outros players. Servidor autoritativo; cuidado
com mudança de protocolo/schema (risco §9 PROPOSAL-0004) — campo novo só com justificativa.

## Decisões tomadas (e por quem)
- **`profile` cortado do protocolo de join (IA/Lead).** É 100% client-side (perfil de controle
  mouse/kbd/touch), não afeta nada server-authoritative e não tem campo no schema. Enviar seria um
  campo inútil na rede. Persiste só em localStorage/Django (T-058). Decisão registrada aqui + DEVLOG.
- **Sem campo novo no schema (IA/Lead).** `nick` reusa `Player.name` (já sincronizado); `classId`/
  `skinId` já existiam no schema (T-052). Nada novo trafega → zero risco de replay/bots por schema.
- **Precedência de identidade: conta (JWT válido) > nick do lobby / name (bots) > fallback "Guest".**
  O nome vindo da conta (via `verifyAccountToken`, atrás de `PLATFORM_ENABLED`) vence o nick do lobby;
  na ausência de conta usa o nick; nick ausente/malicioso cai pro fallback. Documentado no onJoin.
- **Nick lido do localStorage `aop_lobby_nick` no join, não de `lobbySelection.nick` (IA).** O PUT
  do Django (T-058) é fire-and-forget e pode atualizar o objeto selection depois do join; o
  localStorage é síncrono e já sanitizado localmente. O servidor re-sanitiza de forma autoritativa.
- **Sanitização de nick no servidor Colyseus espelha o Django.** Novo `sanitizeDisplayName` em
  `@aop/shared` com a mesma política do `sanitize_display_name` (charset Unicode `\p{L}\p{N}_ -.`,
  fallback inteiro para nick malicioso, truncagem só de nick válido). Autoridade dupla: o servidor
  nunca confia no cliente (que pode ter sido burlado).
- **Bots mandam `classId` default explícito (IA).** O servidor resolveria pro default de qualquer
  forma via `resolveClassSelection`, mas mandar explícito documenta o contrato.

## Resultado verificado
- **Arquivos:** `packages/shared/src/classes.ts` (+`sanitizeDisplayName`/`NICK_MAX_LEN`/`DEFAULT_NICK`),
  `packages/server/src/rooms/ArenaRoom.ts` (onJoin: nick + precedência), `packages/client/src/main.ts`
  (join envia nick/classId/skinId; passa classId/skinId ao visual), `packages/client/src/visuals.ts`
  (`createPlayerVisual` aceita classId/skinId), `packages/bots/src/bot.ts` (classId default explícito),
  testes em `packages/shared/src/classes.test.ts` e `packages/server/src/rooms/classes.test.ts`.
- **Gates:** tsc server/client/bots limpo · shared 49/49 · server 98/98 · bots 35/35 ·
  `build @aop/client` OK · `npm run bots -- 3 15` sem erro (3 bots entraram/jogaram; join com o
  `classId` novo é compatível).
- **Cobertura de testes de join:** válido / classe inválida / seleção ausente / nick malicioso HTML /
  nick com caractere de controle / nick só-espaços / nick válido longo (truncado em `NICK_MAX_LEN`) /
  acentos preservados / precedência nick>name / bot com classId explícito.
- **Troca de classe/skin aparece pros outros:** o servidor reflete `classId/skinId` do join no estado
  (testado) e o cliente lê `p.classId/p.skinId` em `createPlayerVisual` — os outros players renderizam
  com a seleção correta. Screenshot WebGL não confiável com janela oculta (aviso operacional); validado
  por estado + caminho de código.

## Veredito CD (preencher após teste no browser)
- Testado em: —
- Fluxos: entrar com nick/classe/skin escolhidos; abrir 2 clientes (ou client+bot) e ver a skin do outro
- Resultado: aprovado | ajustes pedidos
- Observações:

## Regras que nascem daqui
- **Campo no join só se for server-authoritative.** Dado puramente client-side (ex.: perfil de
  controle) não trafega no join — persiste em localStorage/Django. Cortar e registrar a decisão.
- **Sanitização de entrada do cliente é dupla e alinhada.** Nick sanitizado no Django E no servidor
  de jogo, com a mesma política (`sanitizeDisplayName` em `@aop/shared` ≙ `sanitize_display_name`).
- **Identidade tem precedência explícita e documentada:** conta > nick do lobby/name > fallback.

## Pendências para o próximo prompt
- T-062: aba de ranking/stats no card do lobby (outro agente).
