# Análise de Performance de Render — T-070 (Pingue Oscilando)

## Diagnóstico

A oscilação de "ping" (apareça no overlay F3 como 1-2ms a 25ms) **não é rede pura** — é inflação causada pela thread JavaScript estar bloqueada em operação de render pesada.

### Dados Coletados (7 de Julho)

```
Situação: 6+ personagens renderizados, evento ativo com zona
Resultado: avg frame time = 4-7ms, max = 12-18ms
Culpado: renderer.render() → avg=2-5ms, max=9-17ms
```

Quando `renderer.render()` bate em 15-18ms:
- A thread fica bloqueada naquele tempo
- Se o `pong` do servidor chegar nesse momento, o handler espera a thread desocupar
- Resultado: "ping" mostra 15-25ms em vez do ~1-2ms real

### Por que render está lento

1. **Muitos meshes**: ~100-120 meshes (6 players × 18-20 parts cada)
2. **Material caro**: `MeshStandardMaterial` com iluminação dinâmica (sol + ambient) × muitos meshes
3. **Sem otimizações**: Não há LOD, frustum culling, ou batching de meshes

## Otimizações Recomendadas

### 1️⃣ Diagnóstico: Confirmar números (rápido)

No DevTools console, rode:

```javascript
window.__renderStats.render()
// Procure por:
// - Triangles: quanto
// - Draw Calls: quanto (suspeita: 150+)
// - Meshes: quantidade

// Exportar em JSON pra análise:
copy(JSON.stringify(window.__renderStats.export(), null, 2))
```

---

### 2️⃣ **Otimização A: Simplificar Material** (mais rápido)

**Problema**: `MeshStandardMaterial` tem iluminação cara com múltiplas luzes.

**Solução**: Usar `MeshPhongMaterial` ou `MeshBasicMaterial com vertex colors`.

**Arquivo**: `packages/client/src/characters.ts:30`

```typescript
// ATUAL (caro)
const CHAR_MAT = new THREE.MeshStandardMaterial({ 
  vertexColors: true, 
  flatShading: true, 
  roughness: 0.9, 
  metalness: 0 
});

// OPÇÃO 1: MeshPhongMaterial (mais rápido, visual ok)
const CHAR_MAT = new THREE.MeshPhongMaterial({ 
  vertexColors: true, 
  flatShading: true,
  shininess: 10
});

// OPÇÃO 2: MeshBasicMaterial (mais rápido ainda, visual pior)
// const CHAR_MAT = new THREE.MeshBasicMaterial({ 
//   vertexColors: true, 
//   flatShading: true 
// });
```

**Ganho esperado**: ~30-40% mais rápido (render de 5ms → 3ms)

**Trade-off**: Menos realismo, mais cartoon

---

### 3️⃣ **Otimização B: Baking de Geometrias por Player** (mais complexo)

**Problema**: Cada player tem 18-20 meshes separadas (cabeça, torso, braços, etc), cada uma é um draw call.

**Solução**: Quando o player é criado, fazer merge de todas as geometrias em um único mesh.

**Onde**: `packages/client/src/characters.ts:301-330` (`createCharacterVisual`)

```typescript
// ATUAL: retorna THREE.Group com 18-20 meshes filho
export function createCharacterVisual(classId: string, skinId: string): THREE.Group {
  const group = new THREE.Group();
  // ... adiciona 18-20 THREE.Mesh ao group
  return group;
}

// OTIMIZADO: retorna um único mesh com geometria merged
export function createCharacterVisual(classId: string, skinId: string): THREE.Group | THREE.Mesh {
  const meshes: THREE.Mesh[] = [];
  // ... cria os 18-20 meshes
  
  // Merge todas as geometrias em uma
  const mergedGeo = THREE.BufferGeometryUtils.mergeGeometries(
    meshes.map(m => m.geometry),
    false // ignorar materiais (todos usam CHAR_MAT mesmo)
  );
  
  const merged = new THREE.Mesh(mergedGeo, CHAR_MAT);
  return merged;
}
```

⚠️ **Impacto**: Quebra `updateCharacterAnimation` que espera pivôs (rig) para animar partes separadas. Precisa redesenhar animação.

**Ganho esperado**: ~60% mais rápido (6 players × 18 meshes = 108 draw calls → 6)

---

### 4️⃣ **Otimização C: LOD (Level of Detail)** (médio)

**Problema**: Players longe da câmera renderizam com mesma complexidade que players perto.

**Solução**: Usar `THREE.LOD` — players longe usam modelo simplificado.

**Implementação**: Criar versão simplificada de `createCharacterVisual` (ex: só corpo, sem capuz/cabelo) e usar LOD.

**Ganho esperado**: ~20-30% (depende de quantos players estão longe)

---

### 5️⃣ **Otimização D: Frustum Culling** (rápido)

**Problema**: Todos os meshes são renderizados mesmo se fora da câmera.

**Solução**: `THREE.WebGLRenderer` já faz frustum culling automático se `geometry.boundingSphere` estiver correto.

**Check**: Ver se `THREE.BufferGeometry` está computando bounding sphere:

```javascript
// Em characters.ts, na função createCharacterVisual, adicione:
geometry.computeBoundingSphere();  // já é automático, mas assegura
```

**Ganho esperado**: ~5-10% em cenas de zoom afastado

---

## Recomendação Final

**Curto prazo (hoje):**
1. ✅ Rodar `window.__renderStats.render()` pra confirmar números
2. ✅ Trocar `MeshStandardMaterial` por `MeshPhongMaterial` (30-40% ganho, 10min)

**Médio prazo (esta semana):**
3. 🔄 Investigar se é aceitável simplificar material (feedback visual)
4. 🔄 Considerar LOD pra players distantes (20-30% ganho adicional)

**Longo prazo (próxima sprint):**
5. 🔧 Baking de meshes (maior ganho, maior refactor)

---

## Teste de Validação

Após cada otimização:

1. Abra o jogo com 6+ players
2. Deixe rodar 15s com evento ativo
3. Rode `window.profiler.printStats()`
4. Verifique:
   - `render` avg < 3ms (ideal)
   - `max` < 8ms (sem picos)
   - "ping" no overlay fica 1-3ms (steady)

Se "ping" normalizar pra 2-3ms e não oscilar pra 20ms+ → problema resolvido.
