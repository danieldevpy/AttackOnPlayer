# PROMPT-0065 — Login/registro migram pro lobby

**Data:** 2026-07-07 · **Sessão:** 48 · **Task:** fora do backlog formal, pedido direto do CD

## Pedido do CD

> "Tarefa fora de escopo do projeto: Agora que o jogo tem o lobby ao entrar no site, quero que
> o login/registro passe a ficar no lobby/menu."

## Contexto encontrado

- `auth.ts` (T-028c, SPEC-0008) implementava um widget de conta fixo no canto da tela
  (`#auth-widget`/`#auth-panel`/`#auth-pill` em `index.html`), sempre presente no DOM — inclusive
  durante a partida em andamento. `initAuth()` era chamado uma única vez no boot (`main.ts`),
  independente do lobby.
- `lobby.ts` (T-057, SPEC-0015) já existia como card pré-sala mostrado antes do `connect()`
  (uma única vez, no boot) e já tinha um badge discreto de guest/conta com botão de logout
  (T-062, aba de ranking), mas nenhum formulário de login/registro embutido — a única forma de
  logar/registrar continuava sendo o widget flutuante separado.
- `getAuthToken()` era consumido por `main.ts` (join com `authToken`) e por `lobby.ts`
  (`fetchDjangoSettings`/`saveDjangoSettings`/`fetchPlayerStats`), cada um duplicando a leitura
  direta de `localStorage` com as mesmas chaves (`aop_jwt`, `aop_account`).

## Decisões

1. **`auth.ts` vira DOM-free.** Removidas todas as referências a elementos do widget antigo
   (`#auth-widget`, tabs, form, pill). Módulo agora só expõe rede + persistência:
   `login(email, password)`, `register(email, password, displayName)`, `getAuthToken()`,
   `getAccount()`, `clearSession()`, `updateAccountDisplayName()`, `ensureGuestRegistered()`.
2. **UI de login/registro passa a morar no lobby.** `lobby.ts` ganhou um painel colapsável
   (`#lobby-auth-panel`) dentro do card, com as mesmas tabs Entrar/Registrar do widget antigo —
   abre ao clicar em "entrar" no badge do header, fecha com "✕" ou após sucesso. Nunca é modal;
   ocupa espaço só dentro do card do lobby, que já é a única tela antes do `connect()`.
3. **Consolidação da leitura de sessão.** `lobby.ts` parou de duplicar `JWT_KEY`/`ACCOUNT_KEY`
   e ler `localStorage` diretamente — passou a importar `getAuthToken`/`getAccount` de
   `auth.ts`. `saveDjangoSettings` (T-058) usa o novo `updateAccountDisplayName()` exportado em
   vez de mexer no JSON da conta na mão. Não é escopo novo: é a mesma responsabilidade
   (gerenciar sessão) só que num único lugar, necessário pra login/registro non-DOM funcionar
   sem duplicar estado.
4. **Sync pós-login reusa o merge servidor→UI existente.** O bloco que aplicava
   `DjangoSettings` (nick/perfil/volumes/fullscreen) ao carregar o card já logado virou a
   função nomeada `applyRemoteSettings()`, chamada tanto no carregamento inicial quanto logo
   após um login/registro bem-sucedido na mesma sessão de lobby — evita duas implementações do
   mesmo merge.
5. **Nick adota o nome da conta só se ainda for o guest gerado.** Ao logar/registrar com
   sucesso, se o nick atual começa com `Guest#` (nunca foi customizado pelo jogador), adota o
   `display_name` da conta. Se o jogador já tinha customizado o nick antes de logar, mantém —
   consistente com o comportamento já existente no carregamento inicial (`storedNick` sempre
   vence).
6. **`index.html`/`main.ts` perdem o widget antigo.** Todo o markup/CSS de `#auth-widget` saiu
   de `index.html`; `initAuth()` (e seu import) saiu de `main.ts` — a função só existia pra
   inicializar a UI do widget, que não existe mais. `getAuthToken`/`ensureGuestRegistered`
   continuam usados normalmente (join e registro de guest no Django).

## Nota de processo (entrelaçamento de sessões)

`main.ts` e `index.html` já tinham mudanças não commitadas de uma sessão anterior concluída
(PROMPT-0064, mobile HUD/fullscreen) quando comecei — entrelaçadas linha a linha com as minhas
(ex.: uma linha de CSS `body.mobile-layout #auth-widget {...}` adicionada pelo PROMPT-0064 foi
removida por mim, já que o widget deixou de existir). Perguntei ao CD como proceder; a escolha
foi separar em dois commits. Reconstruí manualmente o estado intermediário (arquivo só com as
mudanças do PROMPT-0064, sem as minhas) comparando contra `git show HEAD` e os diffs de cada
edição, conferindo que a reconstrução batia exatamente nos dois sentidos (`diff` contra HEAD e
contra o estado combinado) antes de commitar. Resultado: um commit só do PROMPT-0064 (mobile),
depois este commit só com a relocação de login/registro.

## Gates

- `tsc --noEmit -p packages/client` — limpo.
- `npm run build -w @aop/client` (vite build) — OK.
- `npm run test -w @aop/shared` — 49/49 (não afetado, só confirma que nada vazou).
- Preview (`client`, porta 5173): lobby carrega com badge "anônimo · entrar"; clique em
  "entrar" abre o painel com tabs Entrar/Registrar; alternar pra Registrar mostra o campo de
  nome e troca o texto do botão; submit sem Django rodando mostra erro inline ("Failed to
  fetch") sem quebrar a UI; cancelar ("✕") fecha o painel e limpa o form; console sem erros
  relevantes (só ruído do Electron/Vite do sandbox).

## Não testado

- Login/registro reais contra o backend Django (não estava rodando no ambiente de preview) —
  só o caminho de erro de rede foi exercitado. Recomendo o CD confirmar o fluxo feliz (login,
  registro, herdar stats do guest via `/auth/link`, logout) contra o backend real antes do
  próximo deploy.

## Arquivos

`packages/client/src/{auth,lobby,main}.ts`, `packages/client/index.html`.
