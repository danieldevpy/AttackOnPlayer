# Fases visuais (Debug First aplicado à arte) — ADR-008

O jogo evolui visualmente em 4 fases. Nunca pule fases: cada uma valida algo antes de investir na próxima. O ponto de troca é ÚNICO no código: `packages/client/src/visuals.ts` (constante `VISUAL_PHASE` + fábricas `createPlayerVisual` / `createCollectibleVisual`). Trocar de fase = editar um arquivo.

## F1 — Primitivas (ATUAL para personagens)
Cápsula = player, cubo = parede.
**Valida:** mecânica, legibilidade, performance base.

> **Nota (T-036, passe visual 2026-07-05):** cenário e coletáveis já usam **F2 (composição)**
> mesmo com os personagens ainda em F1 — props compostos desde a T-002 (árvore = tronco+copa,
> bandeira = haste+pano) e **coletáveis compostos** desde a T-036 (cruz=vida, domo=escudo,
> seta=velocidade, moeda em pé, baú=box, gema=xp — `collectibleParts` em `visuals.ts`). Isso
> não fere a "regra de ouro": a mistura proibida é personagem GLTF (F4) com cenário cubo — não
> composição de primitivas coerente entre si. Personagens sobem para F2/F3 quando o CD pedir.

## F2 — Composição de primitivas
Ainda sem assets: personagem = cápsula (corpo) + esfera (cabeça) + cubos (mãos), agrupados num `THREE.Group`. Dá silhueta e direção (saber para onde o boneco olha) sem custo de arte.
**Valida:** leitura de orientação, animação básica por código (balanço ao andar, "squash" ao coletar via `scale`).

```ts
// exemplo em createPlayerVisual:
const g = new THREE.Group();
g.add(corpo /* capsule */, cabeca /* sphere y=1 */, maoE, maoD /* boxes */);
return g;
```

## F3 — "Sprites 3D" (billboards)
Personagem vira uma imagem 2D que sempre encara a câmera — visual estiloso e MUITO leve (2 triângulos por personagem). É o truque de Crossy Road/Don't Starve.

Duas técnicas em Three.js:
1. `THREE.Sprite` + `SpriteMaterial` — billboard automático, mais simples.
2. `PlaneGeometry` + rotação manual para a câmera a cada frame — permite bilboard só no eixo Y (não deita quando a câmera inclina; melhor para top-down).

Animação: spritesheet (várias poses numa textura) trocando `texture.offset` por frame — andar = 4 poses, 8 fps já convence.

```ts
const tex = new THREE.TextureLoader().load("/sprites/player.png");
tex.magFilter = THREE.NearestFilter;           // pixel art nítida
const mat = new THREE.SpriteMaterial({ map: tex });
const sprite = new THREE.Sprite(mat);
sprite.scale.set(1, 1.4, 1);
// direção: espelhar com sprite.scale.x = -1 quando andar para a esquerda
```

Regras da F3: texturas em `packages/client/public/sprites/`, potência de 2 (ex. 256×256), 1 spritesheet por entidade. Sombra fake: círculo escuro transparente no chão (mesmo objeto do anel de inimigo).
**Valida:** identidade visual, leitura em mapa grande, custo quase zero.

## F4 — Low-poly 3D + animação
Modelos GLTF (< 2k triângulos por personagem), `AnimationMixer` para walk/idle. Só entra quando F3 provar que o jogo é divertido e a identidade estiver definida.
**Valida:** produto final.

## Regra de ouro
Coletáveis, paredes e efeitos seguem a MESMA fase dos personagens — nada de misturar um GLTF bonito com cubos (quebra a coerência e engana o playtest).
