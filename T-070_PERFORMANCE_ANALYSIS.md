# T-070: Análise de Frame Time / Oscilação de "Ping"

**Observação**: em dev, o "ping" no overlay F3 saltava de ~2ms para picos de 25–50ms.
**Status**: ✅ **RESOLVIDO e VERIFICADO** — a causa raiz (recompilação de shader por crescimento
da contagem de luzes + flip-flop do programa de sprite) foi confirmada em jogo real e corrigida.
Ver **`T-070_ROOT_CAUSE_AND_FIX.md`** para o relato completo, a prova nos logs e os números
antes/depois. Este documento fica como o registro do MÉTODO de diagnóstico.

---

## 0. Correção fundamental da análise anterior (leia primeiro)

A v1 do profiler **media a grandeza errada** e por isso a conclusão anterior ("render de
múltiplos personagens") não se sustenta nos próprios dados.

- A v1 media só o **tempo de CPU DENTRO de `animate()`** (`start()` no topo, `end()` após o
  render). Isso **não é o frame time real**: `requestAnimationFrame` é limitado pela taxa do
  monitor (60Hz→16.6ms, 144Hz→6.9ms).
- Por isso ela reportava **"fps 135–231"** — número impossível para uma tela real. Era
  "quantos frames caberiam SE só existisse o trabalho do animate", não FPS.
- Consequência: os dados coletados (avg 4–7ms, max 17ms) **não conseguem explicar um ping de
  50ms**. O pico mora exatamente onde a v1 era cega: **no gap entre o fim de um render e o
  próximo rAF** — GC, layout/paint do browser, decode dos patches binários do Colyseus e
  **recompilação de shader** (o suspeito nº1 de picos momentâneos).

O "ping" do overlay, aliás, **não é latência de rede pura** (isso a v1 já tinha certo): é
`performance.now() - t` de um eco `pong`, processado na main thread. Se a thread está travada
quando o `pong` chega, o valor infla. **Ping alto aqui = latência de agendamento da main
thread**, não rede.

---

## 1. O que o profiler v2 mede agora

`window.profiler.printStats()` passou a reportar:

- **Intervalo REAL rAF→rAF** (avg/min/max/p95/p99) — o frame time de verdade e o stutter
  percebido. É isto que tem que ser comparado ao orçamento do monitor.
- **CPU dentro do animate()** — o que a v1 chamava (erradamente) de frame time.
- **Gap FORA do animate()** = intervalo − inside. Onde GC/paint/rede/recompilação se escondem.
- **Frames longos** (intervalo > 20ms): cada um vem rotulado como `FORA` (GC/paint/recompile)
  ou `DENTRO → <label>` com o trecho de `animate()` culpado.

E `window.__renderStats` ganhou o **detector de recompilação de shader**: sempre que
`renderer.info.programs.length` cresce após o aquecimento inicial, loga um `console.warn` com
timestamp e a contagem de luzes visíveis. `window.__renderStats.recompiles()` lista todos.

---

## 2. Procedimento de confirmação (UMA sessão)

1. Abra o jogo, entre numa sala com 6+ players/bots, deixe o console aberto.
2. Jogue ~20s **sem** evento, rode `window.profiler.printStats()` e `window.__renderStats.render()`.
3. Dispare um evento, jogue ~20s **com** evento ativo, repita os dois comandos.
4. Leia o veredito direto dos números:

| Sintoma nos dados | Causa | Onde olhar |
|---|---|---|
| `console.warn` de RECOMPILAÇÃO aparece junto dos picos | Recompilação de shader | luzes entrando/saindo da cena |
| Frames longos rotulados **FORA** e sem recompile | GC ou paint/decode de rede | alocações por frame, tamanho do state |
| Frames longos **DENTRO → render** | Render genuinamente pesado | draw calls / triângulos (`__renderStats`) |
| Frames longos **DENTRO → updateZoneVisual** | Rebuild de geometria da zona | `buildZoneDarkGeometry` durante o shrink |
| Intervalo p99 ≈ orçamento do monitor e SEM frames longos | Não há regressão real | o "ping" era artefato de amostragem |

Este último caso é plausível: amostrar latência de main thread a cada 2s, com o overlay F3
aberto (que faz `innerHTML` a ~10fps), produz "oscilação" mesmo num jogo saudável.

---

## 3. Hipóteses ranqueadas (por leitura de código)

**H1 — Recompilação de shader ao alternar luzes (CORRIGIDA).**
`updateFlagGlow`/`updateFlagGround` alternavam `light.visible`. Isso muda a contagem de luzes
visíveis → three.js recompila shaders. Trocado por modulação de `intensity` (contagem fixa).
Confirmar via ausência de novos warns de recompile.

**H2 — Pressão de GC por alocação em loop (PARCIALMENTE CORRIGIDA).**
`syncWorld` alocava um array por player por frame (`Array.from(p.effects)`) — removido. Restam
`new Set()` × 3 por frame (seenP/seenC/seenProj) e o overhead do próprio profiler (v2 reduziu
para ~zero alocação). Confirmar via frames longos rotulados **FORA** sem recompile.

**H3 — Rebuild da geometria da zona durante o shrink.**
`buildZoneDarkGeometry` re-triangula (earcut) a cada mudança de raio > 0.5 tile. Guardado, mas
periódico durante o `active`. Provavelmente 1–3ms, não 50ms. Confirmar via frames longos
rotulados **DENTRO → updateZoneVisual**.

**H4 — Render pesado com muitos personagens.**
A hipótese original. Só é a causa se os frames longos forem **DENTRO → render** E o intervalo
real estourar o orçamento do monitor. Os números da v1 (max 17ms) sugerem que é secundária.

---

## 4. Correções já aplicadas nesta passagem

- `profiler.ts` reescrito: mede intervalo real + gap + frames longos, baixa alocação.
- `renderer-stats.ts`: detector de recompilação de shader + contagem de luzes.
- `visuals.ts`: luzes da bandeira modulam `intensity` em vez de alternar `visible` (H1).
- `main.ts`: removida a alocação de array por player por frame em `syncWorld` (H2).

Nada no caminho de render de personagem foi alterado — isso fica para DEPOIS da confirmação,
para não otimizar às cegas.

---

## 5. Se a confirmação apontar render pesado (H4)

Ver `RENDER_OPTIMIZATION.md`. Ordem de custo/benefício: (1) confirmar draw calls com
`__renderStats.render()`; (2) instanciar partes de personagem repetidas; (3) reduzir segmentos
de geometria; (4) desligar `antialias` em telas de alta densidade. Só depois de os números
justificarem.
