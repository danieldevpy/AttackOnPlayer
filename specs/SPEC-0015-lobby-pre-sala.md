# SPEC-0015 — Lobby pré-sala: identidade, classe e settings

**Status:** aprovada · **Marco:** V1 (Frente L, PROPOSAL-0004 §5) · **Data:** 2026-07-06
**Origem:** PROPOSAL-0004 §5 — Frente L, evolução de `#profile-selector` + pill de auth (T-028).

## Problema / objetivo
Hoje o jogador cai direto na sala sem interagir com nenhuma tela pré-jogo: não escolhe nick (fica anônimo), não vê/seleciona classe, não acessa settings ou dados da conta. O lobby consolidará essas escolhas críticas numa **janela única antes do join**, permitindo 1 clique para entrar (defaults sensatos) ou customização sem sair do card.

## Comportamento esperado
O lobby é um **card único** (nunca cadeia de modais) dividido em 4 seções + botão **Jogar**:

### 1. Identidade (guest/conta + nick editável)
- **Guest:** apoio de account anônimo (localStorage), nick padrão `"Guest#{5 dígitos aleatórios}"`; editável no card.
- **Logado:** mostra nome da conta (obtenção anterior por T-028); nick herdado da conta ou editável localmente (persistência em localStorage; sincroniza com Django em `PUT /api/v1/accounts/settings`).
- **Indicador visual:** ícone ou badge (ex.: "👤 anônimo" vs. "✔️ [nome da conta]"); link logado → logout nesta tela (não no meio do jogo).
- **Nick:** input de texto, max 20 caracteres visíveis (sanitização server-side em T-059), soa bem e sem ofensas (validação simples: sem `<`, `>`, caracteres de controle; mínimo 1 char não-espaço). Limite sugerido: 20 chars.

### 2. Seleção de classe + preview 3D girando
- **Seleção:** radiobuttons ou cards visuais (um por classe disponível — V1 só `archer`).
- **Preview 3D:** visual do personagem (`createCharacterVisual(classId, skinId)`) em pequena viewport Three.js, **girando automaticamente** (seno por tempo, ~2s volta). Integra diretamente com T-053.
- **Skins:** se a classe tiver skins (V1 archer tem), dropdown ou botões pequenos ("vermelho", "azul", etc.) — cor aplicada na fábrica do T-056.
- **Defaults:** `archer` como única classe V1 (guardrail contra validação server-side); primeira skin como padrão.

### 3. Settings (3 subseções)
- **Perfil de controle** (ADR-015): radio buttons — "Mouse" (WASD + mira 360°), "Teclado" (mira por setas), "Touch" (twin-stick virtual em mobile). Auto-detecta e marca como padrão; persistido em localStorage.
- **Volumes:** sliders para **Master** e **SFX** (reusa volume da T-051); persistidos em localStorage; refletem em audio vivo (WebAudio master gain).
- **Fullscreen:** toggle "Entrar em tela cheia" — ativa a Fullscreen API (T-048), ícone ⛶ no botão ou checkbox; reflete estado atual do navegador.

### 4. Botão **Jogar**
- Enviar `{nick, classId, skinId, profile}` ao servidor via join message (T-059). Nick é sanitizado server-side; classe inválida cai pro default.
- Feedback: spinne r ou "Conectando..." enquanto aguarda resposta do servidor.
- Erro de conexão: toast discreta com retry automático ou botão "Tentar novamente".

### Regra de ouro: **1 clique com defaults sensatos**
Um jogador novo chega ao lobby, vê o card com:
- Nick = "Guest#XXXXX" (gerado)
- Classe = "Archer" (única V1)
- Skin = primeira (cor padrão)
- Perfil = detectado (mouse/teclado/touch)
- Volumes = 100% Master, 100% SFX
- Fullscreen = off

**Clica "Jogar" e entra.** Tudo mais é opcional (editar nick, trocar classe/skin, ajustar perfil/volumes).

### Persistência & sincronização
- **localStorage:** nick, perfil de controle, volumes. Sempre lido ao abrir o lobby.
- **Django (quando logado):** endpoint `GET /api/v1/accounts/settings` traz nick da conta; `PUT` com novo nick (se editado). Sincronização é **eventual** — cliente não espera resposta, logging discreto de falha.
- **Nick no servidor (T-059):** join valida comprimento + caracteres; falha silenciosa → nick fallback (`"Guest"` ou token truncado).

### Ranking / stats em aba discreta (T-062)
**Opcional no V1 pré-implementação de T-060/T-061.** Plano: abinha ao lado ou abaixo do card ("Ranking") que mostra:
- Seus stats: KDA (kills/deaths atuais), XP total, posição no ranking (se logado).
- Top 10 por kills/deaths (paginado).
- Consumir `GET /api/v1/stats/me` + `GET /api/v1/ranking` do Django (T-060/T-061).
- Guardable pro V1.1 se a integração de T-060/T-061 estiver incompleta na data de T-057.

---

## Wireframe em texto

### Desktop (>= 600px de largura)
```
╔═══════════════════════════════════════════════════════════════╗
║                   ATTACK ON PLAYER — LOBBY                    ║
║                                          ✔ Logado | Logout    ║
╠═══════════════════════════════════════════════════════════════╣
║                                                                 ║
║  ┌─────────────────────┐  ┌──────────────────────────────┐   ║
║  │ Seu Nick            │  │  Classe: Archer (única V1)   │   ║
║  │ [Guest#12345    _]  │  │  ○ Archer                    │   ║
║  │                     │  │                              │   ║
║  │ Perfil de Controle  │  │  Skin: [▼ Padrão]            │   ║
║  │ ○ Mouse (WASD)      │  │                              │   ║
║  │ ○ Teclado (setas)   │  │  ┌──────────────────────┐    │   ║
║  │ ○ Touch (dual)      │  │  │     [3D Preview]     │    │   ║
║  │                     │  │  │    (Archer girando)  │    │   ║
║  │ Áudio               │  │  │                      │    │   ║
║  │ Master: ═══●═════== │  │  │     [↺ auto]        │    │   ║
║  │ SFX:    ════●═══════│  │  └──────────────────────┘    │   ║
║  │                     │  │                              │   ║
║  │ ☐ Tela cheia (⛶)    │  │                              │   ║
║  └─────────────────────┘  └──────────────────────────────┘   ║
║                                                                 ║
║                  ┌────────────────────────┐                   ║
║                  │   ▶ JOGAR (Conectar)   │                   ║
║                  └────────────────────────┘                   ║
║                                                                 ║
║  [Ranking] tab (aba discreta, conteúdo por T-062)             ║
║                                                                 ║
╚═══════════════════════════════════════════════════════════════╝
```

### Mobile (<= 599px de largura)
```
┌──────────────────────────────────┐
│      ATTACK ON PLAYER LOBBY      │
│                                  │
│  ✔ Logado | Logout               │
├──────────────────────────────────┤
│                                  │
│  Seu Nick                        │
│  [Guest#12345       ]            │
│                                  │
│  Classe: Archer                  │
│  ○ Archer                        │
│                                  │
│  Skin: [▼ Padrão]                │
│                                  │
│  ┌────────────────────┐          │
│  │  [3D Preview]      │          │
│  │   (Archer girando) │          │
│  └────────────────────┘          │
│                                  │
│  Perfil: [▼ Mouse (WASD)]        │
│                                  │
│  Master: ═══●═════ 100%          │
│  SFX:    ════●════ 100%          │
│                                  │
│  ☐ Tela cheia                    │
│                                  │
│  ┌────────────────┐              │
│  │  ▶ JOGAR       │              │
│  └────────────────┘              │
│                                  │
│  [Ranking] (aba discreta)        │
│                                  │
└──────────────────────────────────┘
```

**Notas do wireframe:**
- Preview 3D ocupa ~150×150px (desktop) ou full-width (mobile) com mín 120px de altura.
- Inputs de nick e sliders responsivos (font escala, margin adjust).
- Botão "JOGAR" destaca-se com cor (verde/blue), full-width em mobile.
- Aba de ranking (se implementada) abre ao clique ou hover, substituindo a view (ou lado a lado em desktop).
- Spinne r no botão durante conexão (`... ⊙`).

---

## Critérios de aceite

- [ ] **T-057 — Card pré-jogo**
  - [ ] Aparece antes de qualquer tela de jogo (substitui `#profile-selector` + pill).
  - [ ] Nick editável; class/skin selecionáveis; perfil, volumes, fullscreen acessíveis **sem sair do card**.
  - [ ] Preview 3D carrega e gira (usa `createCharacterVisual` da T-053).
  - [ ] 1 clique com defaults entra no jogo.
  - [ ] Mobile ok: layout adapta, botões tocáveis, inputs menores.
  - [ ] Nenhuma cadeia de modais (nunca sai de view única).

- [ ] **T-058 — Persistência de settings + nick**
  - [ ] Nick, perfil, volumes persistem em localStorage e sobrevivem a reload.
  - [ ] Se logado, nick sincroniza com Django (`PUT /api/v1/accounts/settings` via T-061).
  - [ ] Nick malicioso no servidor cai para fallback (sem crash).
  - [ ] Settings transferem entre máquinas (ao logar em outra).

- [ ] **T-059 — Seleção no join**
  - [ ] Join envia `{nick, classId, skinId, profile}`.
  - [ ] Servidor valida contra `CLASS_REGISTRY`; classe inválida → default (T-052).
  - [ ] Outros players veem a classe escolhida no personagem visual.
  - [ ] Bots ganham `classId` default; join headless funciona.

- [ ] **T-062 — Ranking/stats no lobby** (opcional V1.0, guardável pro V1.1)
  - [ ] Aba "Ranking" acessível no card sem modal.
  - [ ] Mostra stats pessoais se logado (`GET /api/v1/stats/me`).
  - [ ] Top 10 ranking consumido de `GET /api/v1/ranking` (T-060).
  - [ ] Paginação funciona; sem freeze se Django lento (timeout 3s → fallback).

---

## Fora de escopo

- **Não é menu de jogo completo.** Sem opções de áudio global (T-051 é durante o jogo), sem configuração avançada de gráficos (fica para SPEC-0009/V1.1), sem histórico de partidas (será painel só em T-061+).
- **Não toca em economia.** Sem compra de skins, sem battle pass, sem shop — skins são só coloridas (T-056).
- **Não bloqueia entry.** Django fora do ar ou lento: guest entrar continua 1 clique; sync de nick é best-effort.
- **Google OAuth não entra.** Autenticação manual ou guest (T-028 com adiamento de T-028-google para post-V1).
- **Sem matchmaking por nível.** Jogo aleatório continua; ranking é só display.

---

## Decisão do Creative Director

Aprovada via PROPOSAL-0004 §5 (2026-07-06): "Janela única pré-sala: identidade, classe e settings. Regra: 1 clique. Texto em wireframe deve capturar layout."

---

## Notas da IA

### Arquitetura & integração
- **T-057 implementa** o card (`packages/client/src/lobby.ts` novo, montado em `main.ts` antes de qualquer Game loop); consume `createCharacterVisual` da T-053 e `platforms/authClient.ts` da T-028.
- **T-058** persiste via localStorage sempre; lazy-sync com Django em background (sem await no join).
- **T-059** valida no servidor; aceita `{nick, classId, skinId, profile}` no join message do Colyseus.
- **T-062** é consumidor puro de endpoints existentes (T-060 e T-061); design graceful degrade se Django lento.

### Riscos & guardables
- **Preview 3D:** se `createCharacterVisual` não ficar pronto antes de T-057, placeholder rotina em HTML (CSS 3D ou SVG estático girado); T-053 = gargalo.
- **Django sync lento:** nick malicioso em servidor — server sempre vence (fallback); cliente não bloqueia.
- **Ranking em V1.0:** se T-060/T-061 atrasarem, aba fica escondida/disabled; ativa só quando endpoints existem.
- **Mobile:** touch-action já protegida pela T-048; inputs de nick devem ter `autocomplete` do browser habilitado (UX).

### Testes manuais obrigatórios
1. Novo player anônimo entra com 1 clique.
2. Guest logado: nick da conta aparece; editar e recarregar mantém novo nick.
3. Preview 3D gira (verifica sem headless — ou screenshot).
4. Trocar classe no lobby → outro player vê a classe nova.
5. Mobile: touch em radios/botão funciona; inputs menores mas legíveis.
6. Erro de conexão: retry automático ou botão visível.
7. Ranking aba (se ativo): timeout 3s → "carregando..." sem travamento.

### Alinhamento com tasks paralelas
- Depende criticamente de **T-053** (preview), **T-052** (class registry), **T-028** (auth pill), **T-061** (endpoint settings), **T-060** (stats/ranking).
- Nunca cruza T-048 (fullscreen é só toggle, já existe na imersion.ts).
- Não toca em `BACKLOG` exceto marcar T-D15 como ✅ quando spec estiver pronta.

---

## Quebra em tasks

- **T-057** 〔G〕 Construir o card completo (seções 1–3, botão Jogar, preview).
- **T-058** 〔M〕 localStorage + endpoint de settings (T-061).
- **T-059** 〔M〕 Join envia seleções; servidor valida.
- **T-062** 〔P〕 Aba ranking (guarável se endpoints atrasarem).
