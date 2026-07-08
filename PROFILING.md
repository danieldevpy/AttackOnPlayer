# Profiling de Performance

## Usando o Profiler

O profiler está sempre ativo em modo dev e coleta métricas de frame time, latência de cada função e FPS.

### Método rápido (DevTools Console)

1. Abra o jogo em http://localhost:5173
2. Faça login e entre em uma sala (ou spectate)
3. Deixe rodar por **10-15 segundos** com o personagem e ação visível
4. Pressione F12 para abrir DevTools
5. Na aba Console, digite:

```javascript
window.profiler.printStats()
```

Você verá algo como (profiler **v2** — mede o intervalo REAL entre frames, não só a CPU):

```
[Profiler v2] Frame Stats
Frames: 600
Intervalo REAL rAF→rAF (ms): avg=16.67 min=16.6 max=48.20 p95=16.9 p99=33.4
FPS real: 60.0
CPU dentro do animate (ms): avg=4.32 max=17.90 p99=9.80
Gap FORA do animate (avg): 12.35ms — GC/paint/rede/recompilação
Labels (por total)
render: avg=2.135 min=0.891 max=9.800 total=1281.0ms (n=600)
syncWorld: avg=0.728 ...
Frames longos (interval > 20ms) — 4
#312: interval=48.2ms inside=6.1ms outside=42.1ms → culpado: FORA (GC/paint/recompile) (...)
```

> **Leitura correta**: o número que importa é o **Intervalo REAL rAF→rAF** e o **FPS real** —
> comparados ao orçamento do seu monitor (60Hz=16.6ms, 144Hz=6.9ms). A "CPU dentro do animate"
> é só a fatia de trabalho; se um frame longo tem `outside >> inside`, o pico está FORA do
> `animate()` (GC, paint, decode de rede ou recompilação de shader) — veja
> `window.__renderStats.recompiles()`. A v1 reportava um "FPS" de 200–400 que era ficção
> (media só a CPU, não o intervalo real). Ver `T-070_PERFORMANCE_ANALYSIS.md` §0.

### Exportar dados para análise

Para salvar os dados do profiler em JSON:

```javascript
copy(window.profiler.exportJSON())
```

Isso copia o JSON para a clipboard. Cole em um arquivo `.json` para análise.

### Resetar profiler

Se quiser começar a medir de novo (descartar dados antigos):

```javascript
window.profiler.reset()
```

### Desabilitar/habilitar profiler

Para parar de coletar dados (economiza memória em sessões longas):

```javascript
window.profiler.disable()
window.profiler.enable()
```

## Medindo performance a cada commit

### Método semi-automático

Use o script `scripts/measure-perf.sh`:

```bash
./scripts/measure-perf.sh
```

O script:
1. Detecta o commit atual
2. Dá instruções para coletar dados manualmente
3. Salva resultados em `perf-results.csv`

### Medindo um commit específico

```bash
# Medir o commit atual
./scripts/measure-perf.sh

# Medir um commit anterior
./scripts/measure-perf.sh 6572a62 perf-results.csv

# Comparar histórico
column -t -s, perf-results.csv
```

## Interpretando resultados

### Métricas importantes

- **avg_frame_ms**: Tempo médio de frame. Ideal: <5ms (200 FPS)
- **p95/p99**: Percentil 95 e 99. Detecta picos ocasionais
- **max_frame_ms**: Frame mais lento. >16ms causa drops visíveis (60 FPS)
- **fps**: FPS calculado (1000 / avg_frame_ms)

### Analisando funções lentas

Se um label (ex: `render`, `updateHud`) tem tempo alto, é gargalo:

```
render: avg=8.234ms ← LENTO! Reduz FPS em 20-30%
updateHud: avg=0.023ms ← Normal
```

## Casos de uso comuns

### 1. Identificar regressão após commit

```bash
# Antes do commit X
./scripts/measure-perf.sh main
# Resultado: avg=2.34ms

# Depois do commit X
./scripts/measure-perf.sh HEAD
# Resultado: avg=5.67ms ← 2.4x mais lento!
```

### 2. Verificar se change melhorou performance

```bash
# Versão antiga
git checkout old-commit
./scripts/measure-perf.sh old-commit perf.csv

# Versão nova
git checkout main
./scripts/measure-perf.sh main perf.csv

# Comparar
cat perf.csv
```

### 3. Encontrar gargalo em função específica

Se `updateHud` é lento:

```javascript
// No console, rode várias vezes
window.profiler.reset()
// ... deixe rodar ...
window.profiler.printStats()
```

Procure pelo label `updateHud` e anote o tempo.

## Performance esperada

| Métrica | Target | Crítico |
|---------|--------|---------|
| Frame médio | < 5ms | > 16ms |
| FPS | > 120 | < 60 |
| p95 frame | < 8ms | > 16ms |
| max frame | < 20ms | > 33ms |

## Notas

- Profiler em dev mode: ~1-2% overhead
- Colete dados com **personagem visível** (renderiza múltiplos chars)
- Evite outras abas/janelas abertas (competem por recursos)
- Resultados podem variar por hardware
- Use commit hash (não branch) para histórico comparável

## Debug avançado

Para entender melhor, inspecione o objeto completo:

```javascript
console.log(window.profiler.getStats())
```

Retorna estrutura completa com todos os labels e histograma de frames.
