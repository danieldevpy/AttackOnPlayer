# PROMPT-0058 — T-058 (SPEC-0015): Persistência de settings + nick · 2026-07-06

## Pedido (resumo fiel do CD)

Executar T-058: localStorage sempre; conta Django quando logado (endpoint `GET/PUT /api/v1/accounts/settings`
da T-061, já entregue — `PlayerSettings` com control_profile/volumes/fullscreen); nick sanitizado/limitado
server-side. **Aceite:** settings sobrevivem a reload e a outra máquina (quando logado); nick malicioso vira fallback.

## Decisões tomadas (e por quem)

- **IA:** implementação inteiramente em `packages/client/src/lobby.ts` (bloco T-058 isolado) — sem tocar
  no backend (endpoint pronto pela T-061).
- **IA:** funções `fetchDjangoSettings()` e `saveDjangoSettings()` retornam `Promise<...| null>` para
  garantir que falha de rede nunca propaga exceção para o caller — best-effort explícito.
- **IA:** `djangoBaseUrl()` replica a lógica de `authBaseUrl()` de `auth.ts` em vez de importar —
  evitar acoplamento entre módulos client-only que têm ciclos de vida diferentes.
- **IA:** GET ao abrir card é disparado *após* o `document.body.appendChild(overlay)` — garante que
  os elementos DOM existem quando a promise resolve e os valores são aplicados nos inputs.
- **IA:** PUT ao clicar Jogar é fire-and-forget (`void saveDjangoSettings(...)` não-aguardado)
  para não atrasar o join. O nick sanitizado retornado atualiza `localStorage` e o objeto `selection`
  pela promise, mas o join (T-059) pode usar o valor antes de chegar — aviso adicionado no SESSAO_ATUAL.
- **IA:** backend inalterado — `sanitize_display_name()` já sanitizava nick malicioso (XSS, vazio)
  com fallback para o nick atual. Validado por curl.

## Resultado verificado

- `fetchDjangoSettings()`: GET `/api/v1/accounts/settings` com JWT → retorna `{control_profile,
  volume_master, volume_sfx, fullscreen_pref, display_name}`. Sem token → retorna `null`.
- Merge ao abrir: nick atualiza `#lobby-nick-input` + localStorage; perfil atualiza radio buttons
  + `setProfile()`; volumes atualizam sliders + `setMasterVolume/setSfxVolume`; fullscreen atualiza checkbox.
- `saveDjangoSettings()`: PUT `/api/v1/accounts/settings` com payload completo. Nick sanitizado
  retornado atualiza `localStorage` + `aop_account.display_name`.
- **Nick malicioso `<script>alert(1)</script>`** → servidor retornou fallback "NormalNick" (testado via curl).
- **Nick vazio `"   "`** → servidor retornou fallback "NormalNick" (testado via curl).
- **Falha de rede simulada (Django fora do ar):** curl retorna exit 7 → console.warn, lobby continua.
- **Gates:** tsc ×3 limpo · vite build OK · shared 39/39 · server 89/89 · bots 35/35 ·
  pytest 112/112 · ruff OK · makemigrations --check OK.

## Veredito CD (preencher após teste no browser)

- Testado em:
- Fluxos: settings persistem entre reloads / outra máquina / nick malicioso vira fallback
- Resultado:
- Observações:

## Regras que nascem daqui

1. **best-effort nunca lança:** funções de sync com Django retornam `null` em falha, nunca `throw`.
   Chamadores não precisam de `try/catch`.
2. **DOM-first fetch:** disparar fetch de sync *após* o card estar no DOM para que os callbacks
   de update encontrem os elementos garantidamente.
3. **nick server-side wins:** na leitura do GET, o `display_name` do Django vence o localStorage —
   servidor é autoritativo para conta logada.
4. **fire-and-forget no Jogar:** PUT de settings não bloqueia o fluxo de join — aceite de "best-effort"
   implica que o join não pode esperar I/O de Django.

## Pendências para o próximo prompt

- **T-059:** join envia `{nick, classId, skinId, profile}` no Colyseus. Atenção ao aviso de timing:
  o nick do `selection` pode ser atualizado pela promise do PUT *depois* do join. Mitigação sugerida:
  T-059 lê o nick do `localStorage` (`aop_lobby_nick`) ao montar o join message — já está atualizado
  pelo `saveDjangoSettings` (localStorage é síncrono, fire-and-forget não-aguardado).
- **T-062:** aba ranking no card.
