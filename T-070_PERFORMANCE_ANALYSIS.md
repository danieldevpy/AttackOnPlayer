# T-070: Análise de Diagnóstico — Oscilação de Frame Time / "Ping"

**Data**: 7 de Julho de 2026  
**Observação Inicial**: Game frame time oscila de 1-2ms pra 25ms, exibido como "ping" no overlay de debug (F3)  
**Status**: Causa raiz identificada, múltiplas hipóteses para investigar

---

## 1. Descoberta Crítica

O "ping" exibido no overlay **não é latência de rede pura**. É calculado assim:
- Cliente: `room.send("ping", performance.now())` a cada 2s
- Servidor: `client.send("pong", t)` eco imediato  
- Cliente: `performance.now() - t` quando recebe resposta

**Como JS é single-threaded no browser**: Se a thread principal está bloqueada renderizando um frame pesado quando o `pong` chega, o handler só executa depois que a thread liberta. Resultado: "ping" fica artificialmente inflado mesmo com rede perfeita.

---

## 2. Dados Coletados (Testes Realizados)

### Profiler de Frame Time (window.profiler.printStats())

**Teste 1** (6+ players, sem evento):
```
avg=4.32ms, max=12.30ms, fps=231.4
render: avg=2.135ms, max=9.800ms
syncWorld: avg=0.728ms, max=3.400ms
updateDebugState: avg=1.378ms, max=2.800ms
```

**Teste 2** (6+ players, sem evento):
```
avg=4.52ms, max=14.20ms, fps=221.4
render: avg=2.618ms, max=11.200ms
```

**Teste 3** (6+ players, COM evento ativo):
```
avg=7.37ms, max=18.70ms, fps=135.7  ⚠️ PIOR
render: avg=5.031ms, max=17.900ms ⚠️ RENDER LENTO
```

**Teste 4** (6+ players, COM evento ativo):
```
avg=6.51ms, max=17.30ms, fps=153.5
render: avg=4.155ms, max=15.000ms
```

### Padrão Observado

| Situação | Render avg | Render max | Frame avg | Frame max |
|----------|-----------|-----------|----------|----------|
| Sem evento | 2.1ms | 9.8ms | 4.3ms | 12.3ms |
| Com evento | 4.2-5.0ms | 15-17.9ms | 6.5-7.4ms | 17-18.7ms |

**Correlação**: Quando evento ativo → render mais lento → frame mais lento → "ping" aparece alto

---

## 3. Hipóteses e Evidências

### Hipótese A: Renderização de Múltiplos Personagens

**Evidência**:
- Testes rodados com **6+ personagens visíveis**
- `render` é o label mais lento (~50% do frame time)
- Padrão: múltiplos personagens = render lento

**Possíveis Causas**:
1. Material caro (`MeshStandardMaterial` com iluminação dinâmica × 100+ meshes)
2. Muitos draw calls (cada parte do corpo é mesh separada: 18-20 partes × 6 players = 108-120 meshes)
3. Sem LOD ou frustum culling otimizado
4. Sem baking/batching de geometrias por player

**Como Testar**:
```javascript
// No DevTools console
window.__renderStats.render()
// Ver: Triangles count, Draw Calls, Programs (shaders)

// Contar meshes na cena
window.__renderStats.getMeshCount()  // deve estar 100+
```

---

### Hipótese B: Recálculo Frequente de Zona (buildZoneDarkGeometry)

**Evidência**:
- `updateZoneVisual` toca em geometria (linha 424 em main.ts)
- Correlação: evento ativo → render lento

**Possíveis Causas**:
1. `buildZoneDarkGeometry` sendo recalculada a cada frame (mesmo com guard `ZONE_REDRAW_EPS = 0.5`)
2. Geometria não sendo descartada/cached corretamente
3. Interpolação do raio causando pequenas variações que ultrapassam threshold

**Como Testar**:
```javascript
// Adicionar log em updateZoneVisual pra contar recalcs
// Ou: window.profiler.getStats().labels['updateZoneVisual:end'] - labels['updateZoneVisual:start']
```

---

### Hipótese C: Lógica Pesada em updateEvents / updateRespawnWait

**Evidência**:
- T-067, T-068, T-069 foram adicionadas recentemente (SPEC-0016)
- Problema começou após essas features

**Possíveis Causas**:
1. DOM updates frequentes (criar/remover elementos de DOM)
2. Cálculos geométricos complexos por frame
3. Array/object allocations causando GC pressure

**Como Testar**:
```javascript
// Verificar tempo granular
window.profiler.getStats().labels

// Procurar por labels com max alto mesmo que avg baixo
// Picos ocasionais bastam pra explicar oscilação
```

---

### Hipótese D: Problema de Servidor (não do client)

**Evidência**:
- Revert do commit de geometria de personagem (`6572a62`) não resolveu
- Profiler mostra frame time aceitável na maioria dos casos (avg 4-7ms)
- Picos isolados, não constantes

**Possíveis Causas**:
1. Tick rate do servidor muito alta ou patch size grande
2. Lógica de evento/zona consumindo CPU no servidor
3. Network congestion ou packet loss
4. Colyseus room state muitogrande ou com muitas updates

**Como Testar**:
- Instrumentar `packages/server/src/rooms/ArenaRoom.ts`
- Verificar tempo de processamento de ticks
- Medir tamanho de patches enviadas

---

## 4. Ferramentas Disponíveis para Análise

### Profiler de Frame Time
```javascript
// Usar no DevTools Console
window.profiler.printStats()     // exibir resumo
window.profiler.getStats()       // objeto completo
window.profiler.exportJSON()     // salvar pra análise offline
window.profiler.reset()          // limpar e começar nova medição
```

### Renderer Stats
```javascript
// Diagnóstico de render
window.__renderStats.render()           // imprimir stats
window.__renderStats.getMeshCount()     // contar meshes
window.__renderStats.getAverageVerticesPerMesh()  // verts por mesh
window.__renderStats.export()           // JSON completo
```

### Profiling por Commit
```bash
./scripts/measure-perf.sh [commit]  # medir um commit específico
cat perf-results.csv                 # histórico de medições
```

---

## 5. Próximas Investigações Recomendadas

### Urgência 1: Confirmar números de render
```javascript
window.__renderStats.render()
// Procure por:
// - Triangles: esperado 50k-100k+
// - Draw Calls: esperado 100-150+
// - Programs: esperado 1-3 (shaders únicos)
```

Se Draw Calls > 150, hipótese A é provável.

---

### Urgência 2: Testar sem evento
```
1. Jogar 15-20s SEM evento ativo
2. Rodar window.profiler.printStats()
3. Comparar com medição COM evento

Se sem evento é rápido → problema em updateZoneVisual/updateEvents
Se com evento piora só 20% → problema é render de players, não zona
```

---

### Urgência 3: Testar com poucos players
```
1. Entrar em sala com 1-2 players visíveis
2. Rodar window.profiler.printStats()
3. Comparar com 6+ players

Se frame time cai significativamente → render é o culpado
Se continua lento → problema é server ou lógica fixa
```

---

### Urgência 4: Profile Chrome DevTools
```
1. Abrir DevTools > Performance tab
2. Record 3-5 segundos com jogo rodando
3. Procurar por frame drops:
   - Procure por frames > 16ms (red frame)
   - Verifique se `renderer.render()` é o gargalo
   - Ou se é layout/reflow de DOM
```

---

## 6. Artefatos Criados para Análise

| Arquivo | Propósito |
|---------|-----------|
| `packages/client/src/profiler.ts` | Medição de frame time granular |
| `packages/client/src/renderer-stats.ts` | Diagnóstico de render (draw calls, triangles) |
| `scripts/measure-perf.sh` | Histórico de performance por commit |
| `PROFILING.md` | Documentação de como usar profiler |
| `RENDER_OPTIMIZATION.md` | Catálogo de possíveis otimizações |
| `T-070_PERFORMANCE_ANALYSIS.md` | Este documento |

---

## 7. Resumo para Próximo Modelo

**O quê foi descoberto:**
- "Ping" oscilando não é rede pura — é thread JavaScript bloqueada em render pesado
- Render está demorando 2-5ms normalmente, 4-17ms quando evento ativo + 6+ players
- Culpado provável: renderização de múltiplos personagens com material caro

**Ferramentas prontas:**
- `window.profiler.printStats()` e `window.__renderStats.render()` — diagnóstico completo
- Documentação do que testar e como

**O que NÃO foi feito:**
- Nenhuma correção implementada
- Nenhuma mudança no código de render
- Tudo deixado para o modelo maior analisar e decidir

**Recomendação:**
Usar ferramentas de profiling para confirmar qual das 4 hipóteses é verdadeira, depois implementar otimização apropriada (ou combinar múltiplas).
