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

Você verá algo como:

```
[Profiler] Frame Stats
Frames: 872
Frame Time (ms): avg=2.34, min=1.89, max=25.43, p95=3.21, p99=4.56
FPS: 427.35

Label Timings
render: avg=1.234ms, min=0.891ms, max=2.345ms, total=1076.3ms (n=872)
syncWorld: avg=0.456ms, min=0.234ms, max=1.234ms, total=398.1ms (n=872)
updateHud: avg=0.123ms, min=0.045ms, max=0.567ms, total=107.3ms (n=872)
...
```

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
