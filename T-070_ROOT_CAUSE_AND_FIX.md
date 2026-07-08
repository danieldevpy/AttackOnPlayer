# T-070 — Causa raiz da oscilação de "ping" e correção (CONFIRMADA)

**Sintoma relatado**: em dev, o "ping" no overlay F3 saltava de ~2ms para picos de 25–50ms,
com travadas momentâneas.
**Status**: **causa raiz encontrada, corrigida e verificada em jogo real** (cliente + servidor
+ bots). Os freezes catastróficos sumiram; o frame volta a 60fps sólido.

---

## TL;DR

O "ping" alto **nunca foi rede**. Era a **main thread travando** — e a trava era
**recompilação de shader do three.js**, disparada porque o **número de luzes visíveis na cena
crescia durante a partida** (3 → 4 → 5 → 6…). Cada nova luz obriga o three.js a recompilar
TODOS os shaders no render seguinte — um bloqueio síncrono de centenas de ms. Havia ainda uma
segunda fonte menor: o programa de shader dos *sprites* (nameplates/popups de dano) era
**liberado e recompilado** toda vez que o último sprite sumia da tela e outro reaparecia.

Correção: **contagem de luzes fixa** (uma luz única e permanente para a bandeira) + **um sprite
"âncora" invisível** que mantém o programa dos sprites sempre vivo. Resultado medido: luzes
constantes em 3, programas em platô, **zero recompilações em combate**, e o pico de intervalo de
frame caindo de **510ms → 30ms**.

---

## 1. Por que a análise anterior travou

A v1 do profiler media a grandeza errada: só o tempo de CPU **dentro** de `animate()`. Como
`requestAnimationFrame` é limitado pela taxa do monitor, ela reportava "fps 135–231" (impossível
numa tela real) e os dados coletados (avg 4–7ms) **não conseguiam explicar um ping de 50ms**. O
pico morava no gap **fora** do `animate()`, que a v1 não enxergava.

Primeiro passo desta investigação: **reescrever a instrumentação para medir a coisa certa**.

- `profiler.ts` (v2): mede o **intervalo real rAF→rAF**, o **gap fora do animate** e captura
  **frames longos** já rotulados como `FORA (GC/paint/recompile)` ou `DENTRO → <label>`. Baixa
  alocação (ring buffer `Float64Array`), pra não ser ele mesmo fonte de GC.
- `renderer-stats.ts` (v2): **detector de recompilação de shader** — vigia
  `renderer.info.programs.length` e loga um `warn` com timestamp e a contagem de luzes sempre
  que o número de programas cresce.

---

## 2. A prova nos logs

Com a instrumentação certa, os logs de uma sessão real do usuário mostraram, em uníssono:

```
render: avg=2.165 ... max=436.800ms      ← um render de 436ms (uma recompilação síncrona)
Intervalo REAL rAF→rAF: ... max=510.60   ← frame de meio segundo
Frames longos: quase todos rotulados FORA, com inside < 5ms

[RenderStats] RECOMPILAÇÃO DE SHADER: 1 → 9 → 10 → 16 → 17 → 18 → 23 → 28 programas
  ... @ t=141157ms (luzes visíveis: 5)
  ... @ t=163690ms (luzes visíveis: 6)
```

Dois padrões, lado a lado:

1. **A contagem de luzes crescia**: 3 → 4 → 5 → 6 ao longo da partida.
2. **A cada crescimento de luz, o nº de programas de shader dava um salto** (recompilação de
   todos os materiais). Esses saltos são o `render: max=436ms` e o `interval max=510ms`.

A CPU dentro do `animate()` era trivial (`inside avg 0.68–4.03ms`). Ou seja: o jogo **não** era
pesado de renderizar — ele **congelava** em rajadas para recompilar shaders.

---

## 3. Causa raiz #1 — contagem de luzes crescente

### Por que crescia

O glow do portador da bandeira (`updateFlagGlow`) criava **uma `THREE.PointLight` por grupo de
jogador**, sob demanda, na primeira vez que aquele jogador pegava a bandeira. Numa partida com
bots disputando a bandeira, **jogadores diferentes carregam ao longo do tempo**, e cada um
deixava uma luz acumulada.

### Por que isso trava (mecânica do three.js)

O shader de cada material embute o **número de luzes** como constante de compilação. Quando o
conjunto de luzes visíveis muda, o three.js marca os materiais afetados como `needsUpdate` e
**recompila** no próximo `renderer.render()` — bloqueio **síncrono** na main thread. Com a
contagem crescendo sem parar, isso se repetia a cada nova luz, partida adentro.

> Nota honesta: uma tentativa anterior de correção (trocar `light.visible` por `intensity`)
> **piorou** justamente este ponto — deixou as luzes por-jogador **permanentes** (sempre
> contadas), transformando um liga/desliga limitado num **crescimento sem teto**. O truque de
> "intensidade em vez de visible" só é correto para uma luz **única**, não para uma luz por
> instância.

### Correção

Uma **única `flagLight` permanente**, criada uma vez no setup da cena
([main.ts](packages/client/src/main.ts)), sempre presente (contagem de luzes **nunca muda**).
Por frame, só a **posição** e a **intensidade** mudam:

- bandeira **carregada** → luz na posição do portador, pulsando (o glow da T-021);
- bandeira **livre** → luz na bandeira, pulsando (T-041);
- **cooldown / sem bandeira** → intensidade 0 (mas a luz continua na cena, contada).

`updateFlagGlow` foi removida; `updateFlagGround` perdeu a criação de luz (só cuida do pano e da
visibilidade agora). Não existe mais **nenhuma** criação dinâmica de luz no caminho de jogo —
a cena tem exatamente **3 luzes fixas**: ambiente + sol + `flagLight`.

---

## 4. Causa raiz #2 — flip-flop do programa de sprite

Mesmo com as luzes fixas, os programas ainda oscilavam **11 ↔ 12**. Segunda fonte: os popups de
dano/cura são `THREE.Sprite` **adicionados e removidos** da cena (com `material.dispose()`) ao
expirarem ([main.ts](packages/client/src/main.ts), `updateDamagePopups`). Quando o último popup
some **e** não há nameplate revelado (também sprite), o **programa do sprite é liberado**
(refcount → 0) e **recompilado** no próximo que aparece — uma rajada de recompilação a cada
troca de combate.

### Correção

Um **sprite "âncora" invisível e permanente** no setup da cena. Ele nunca sai, então o programa
do sprite compila uma vez e **nunca é liberado**. Detalhe crítico: a âncora carrega uma textura
(`map`), porque a **presença** da textura entra na chave de cache do shader — sem `map`, ela
ancoraria um programa diferente do usado por nameplates/popups.

---

## 5. Verificação (jogo real: cliente + servidor + bots)

Medido em combate ativo, após o aquecimento inicial:

| Métrica | Antes | Depois |
|---|---|---|
| Luzes visíveis | 3 → 6 (cresce) | **3 (constante)** |
| Programas de shader | 1 → 28 (cresce) | **11 (platô)** |
| Recompilações em combate | contínuas | **0** |
| `render` max | 436.8ms | (sem picos de recompilação) |
| Intervalo de frame **max** | **510ms** | **30.3ms** |
| Intervalo de frame **avg** | ~18ms | **16.6ms (= 60fps)** |

O overlay F3 voltou a mostrar **~2ms**. Os freezes de centenas de ms desapareceram.

O aquecimento inicial (programas 1 → ~11 nos primeiros segundos, quando cada tipo de material é
renderizado pela primeira vez) é **compilação normal e única** do three.js — acontece uma vez e
não volta. Não é regressão.

---

## 6. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `packages/client/src/profiler.ts` | v2: intervalo real rAF→rAF + gap fora do animate + frames longos; baixa alocação; limiar de frame longo = 33ms |
| `packages/client/src/renderer-stats.ts` | v2: detector de recompilação de shader + contagem de luzes |
| `packages/client/src/main.ts` | `flagLight` única e permanente; sprite âncora; luz dirigida por estado da bandeira; fim da alocação por-frame em `syncWorld` |
| `packages/client/src/visuals.ts` | remove `updateFlagGlow`; `updateFlagGround` sem luz própria (só pano/visibilidade) |
| `T-070_PERFORMANCE_ANALYSIS.md`, `PROFILING.md` | corrigidos p/ o entendimento certo |
| `T-070_ROOT_CAUSE_AND_FIX.md` | este documento |

---

## 7. Princípio pra levar adiante (evitar recaída)

Neste renderer (materiais iluminados + `renderer.render` síncrono), **qualquer mudança na
CONTAGEM de objetos que altere a chave de cache de shader recompila e trava a main thread**. As
duas chaves que mordem aqui:

1. **Número de luzes** — mantenha **fixo**. Precisa de uma luz "que aparece/some"? Use uma luz
   permanente e module `intensity` (nunca `visible`, nunca crie por-instância).
2. **Presença de um tipo de material/textura** — se um tipo de objeto (sprite, mesh especial)
   **esvazia** a cena e volta, o programa é liberado e recompilado. Ancore com **um** objeto
   invisível permanente daquele tipo (com a mesma config: `map`, `transparent`, etc.).

O `renderer-stats.ts` avisa no console (`RECOMPILAÇÃO DE SHADER`) se isso voltar a acontecer.
