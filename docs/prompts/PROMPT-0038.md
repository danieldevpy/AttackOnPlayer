# PROMPT-0038 — T-036 (passe visual): coletáveis F2, VFX de cura/escudo, HUD gamificado · 2026-07-05

## Pedido (resumo fiel do CD)
"Uma melhoria visual de algumas coisas": (1) coletáveis com forma geométrica correspondente ao tipo, intuitivos como a bandeira parece bandeira e a árvore parece árvore; (2) melhores efeitos visuais de dano, recuperação de vida, velocidade etc.; (3) design do painel de informações do player mais gamificado. Instrução explícita: "veja se esse pedido complementa outras tasks já criada, desenvolva e documente certinho, faça sem que quebre o jogo, mantendo as boas práticas para o jogo continuar leve e funcional".

## Como complementa o que já existia (checado antes de desenvolver)
- **Coletáveis** → o sistema de fases visuais (ADR-008/`instrucoes/FASES_VISUAIS.md`) já previa a evolução F1 primitiva → **F2 composição**; props (árvore/bandeira) já eram compostos desde a T-002. Só faltava aplicar a MESMA técnica aos coletáveis. Não é sistema novo — é o passo já documentado.
- **VFX** → `docs/mechanics/vfx-juice-backlog.md` é o backlog vivo exato para isto; a regra é "efeito novo = 1 entrada no registry `VFX_DEFS` (T-022)". A SPEC-0010 (cura/escudo) tinha deixado a lacuna de feedback visual — este passe a fecha.
- **HUD** → a T-023 estabeleceu o HUD dev/prod e a regra "HUD só exibe estado"; o pedido é um restyle gamificado por cima disso, sem tocar na lógica.

Registrado como **T-036** (passe visual) no BACKLOG, fora das fases numeradas — é leva de juice a pedido do CD, não reestruturação de plano.

## Decisões tomadas (e por quem)
- **Coletáveis compostos (IA, forma por intuição universal):** `collectibleParts(kind)` retorna poucas primitivas por tipo; `createCollectibleVisual` monta um `THREE.Group`. Formas escolhidas pela leitura imediata: **cruz vermelha=vida** (símbolo universal de saúde), **domo/bolha azul=escudo**, **seta ciano pra cima=velocidade/boost**, **moeda em pé** (o giro do grupo vira o "flip"), **seta dupla verde=2×XP**, **baú (corpo+tampa+fecho dourado)=box/loot**, **gema dourada=xp**. Geometrias/materiais são singletons de módulo — N coletáveis do mesmo tipo compartilham os mesmos objetos (nada alocado por instância; draw calls contidos, "leve sempre" §5).
- **VFX novos mínimos e derivados de eventos existentes:** `heal_pop` (verde) e `shield_gain` (azul) — o servidor já emitia `kill_heal` e `pickup{kind}`, então nenhum evento/tráfego novo. Popup de dano refatorado em `pushPopup` (núcleo comum) para reusar no popup de cura "+X" verde, mantendo o mesmo orçamento de 24 sprites. Escudo temporário entrou no anel de cooldown de buff já existente (`damage_reduction` em `BUFF_RING_COLOR`/`BUFF_DURATION_MS`) — leitura de duração de graça.
- **HUD gamificado sem quebrar a regra (IA):** painel estruturado (badge de nível + barras HP/XP + chips) substitui o `textContent` monoespaçado. Casca montada UMA vez (`buildHudShell`); por frame só mudam `style.width`/`textContent` e os chips só re-renderizam quando o conjunto muda — sem `innerHTML` por frame (perf). Cor da barra de HP por fração (verde>50% / âmbar>25% / vermelho). Comportamento dev/prod da T-023 intacto (atributos só em dev ou segurando [Tab]; roster só em dev). CSS novo isolado em `#hud.hud-panel` no `index.html`.

## Resultado verificado
- **Typecheck** limpo em server/client/bots. **Gates** inalterados: shared 25/25 · server 28/28 · bots 24/24 (só o cliente mudou; nada de server/shared neste passe).
- **HUD conferido em screenshot** via mockup estático servido numa porta livre, usando o **CSS real** extraído do `index.html` (config `hud-mock` no launch.json, removida ao final). Dois cenários confirmados: (a) rico dev/[Tab] — badge Lv7, HP verde 83/130, XP azul, chips ⚡/2×XP/🛡/🚩/level-up, atributos+skills+dica; (b) prod low-HP — badge Lv2, **HP em vermelho 22/100** (troca de cor por fração funcionando), chip 🛡, "[Tab] atributos". Ajuste feito após a 1ª captura: painel estava largo demais (a dica esticava a largura) → fixado em 244px.
- **Não verificado no ambiente:** aparência 3D dos coletáveis compostos e das partículas `heal_pop`/`shield_gain` — são WebGL e o preview headless desta sessão não tem GPU (canvas trava, limitação já registrada em PROMPT-0027+). Marcado **pendente de veredito visual humano**, sem marcar o critério de "sensação" como fechado sozinho.

## Regras que nascem daqui
- **Coletável novo = entrada em `collectibleParts` (composição), nunca uma primitiva solta** — mesma disciplina de `propParts`; geometria/material sempre singleton de módulo (reuso entre instâncias).
- **VFX novo continua nascendo só no registry `VFX_DEFS`** e derivando de evento que o servidor já emite (regra do backlog vivo, T-022) — este passe não abriu exceção.
- **HUD nunca recalcula estado nem escreve `innerHTML` por frame** — casca montada 1×, updates pontuais; chips só quando o conjunto muda. Qualquer widget novo de HUD segue esse molde.

## Pendências para o próximo prompt
- **Veredito visual humano** (CD jogando): formas dos coletáveis compostos, `heal_pop`/`shield_gain`, e a "cara" do HUD gamificado em movimento. Cores/tamanhos ajustáveis por constante/CSS único.
- Personagens seguem em F1 (cápsula) — subir para F2 (composição corpo+cabeça+mãos) ou F3 (sprites) é decisão do CD, fora do escopo deste passe.
- `heal_pop` usa o comportamento genérico do pool de partículas (pop + leve gravidade); se o CD quiser um "subir e sumir" dedicado de cura, é um ajuste no `VfxDef`/pool (anotado, não feito para não inflar o passe).
- Nenhuma pendência de código conhecida para o que foi pedido.
