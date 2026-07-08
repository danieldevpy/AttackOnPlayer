/**
 * Ferramentas de diagnóstico de render (draw calls, triângulos, recompilação de shaders).
 *
 * A adição-chave da v2 é o DETECTOR DE RECOMPILAÇÃO DE SHADER: em three.js, quando o número
 * de luzes visíveis na cena muda (uma PointLight entra/sai, ou `light.visible` alterna), o
 * renderer marca todos os materiais afetados como `needsUpdate` e recompila os shaders no
 * próximo render — um bloqueio síncrono de 10–50ms na main thread. É a explicação mais
 * provável dos "picos de ping" momentâneos. Aqui vigiamos `renderer.info.programs.length`:
 * qualquer crescimento após o aquecimento inicial = uma recompilação, logada com timestamp
 * para casar com o pico observado.
 */

import * as THREE from "three";

export function setupRendererStats(renderer: THREE.WebGLRenderer) {
  const state = {
    lastProgramCount: 0,
    recompiles: [] as { t: number; from: number; to: number; lights: number }[],
    warmupFrames: 120, // ~2s: ignora o aquecimento inicial (materiais compilando pela 1ª vez)
    frame: 0,
  };

  const originalRender = renderer.render.bind(renderer);

  renderer.render = function (scene: THREE.Scene, camera: THREE.Camera) {
    originalRender(scene, camera);
    const info = renderer.info;

    // Detector de recompilação: cresceu o nº de programas depois do aquecimento?
    const programCount = info.programs?.length ?? 0;
    state.frame++;
    if (state.frame > state.warmupFrames && programCount > state.lastProgramCount) {
      const rec = { t: performance.now(), from: state.lastProgramCount, to: programCount, lights: countLights(scene) };
      state.recompiles.push(rec);
      if (state.recompiles.length > 100) state.recompiles.shift();
      console.warn(
        `[RenderStats] ⚠️ RECOMPILAÇÃO DE SHADER: ${rec.from} → ${rec.to} programas @ t=${rec.t.toFixed(0)}ms ` +
          `(luzes visíveis: ${rec.lights}). Isto trava a main thread — provável pico de ping.`
      );
    }
    state.lastProgramCount = programCount;

    if (!window.__renderStats) {
      window.__renderStats = {
        render: () => {
          console.group("[Renderer Stats]");
          console.log(`Triangles: ${info.render.triangles}`);
          console.log(`Draw Calls: ${info.render.calls}`);
          console.log(`Programs (shaders): ${info.programs?.length ?? "N/A"}`);
          console.log(`Luzes visíveis na cena: ${countLights(scene)}`);
          console.log(`Textures: ${info.memory.textures} | Geometries: ${info.memory.geometries}`);
          console.log(`Meshes: ${window.__renderStats.getMeshCount()}`);
          console.log(`Recompilações desde o load: ${state.recompiles.length}`);
          console.groupEnd();
        },
        recompiles: () => state.recompiles.slice(),
        countLights: () => countLights(scene),
        getMeshCount: () => {
          let count = 0;
          scene.traverse((o) => {
            if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) count++;
          });
          return count;
        },
        export: () => ({
          triangles: info.render.triangles,
          drawCalls: info.render.calls,
          programs: info.programs?.length ?? 0,
          lights: countLights(scene),
          textures: info.memory.textures,
          geometries: info.memory.geometries,
          meshCount: window.__renderStats.getMeshCount(),
          recompiles: state.recompiles.length,
        }),
      };
    }

    return this;
  };

  return state;
}

function countLights(scene: THREE.Scene): number {
  let n = 0;
  scene.traverse((o) => {
    if ((o as THREE.Light).isLight && o.visible) n++;
  });
  return n;
}

declare global {
  interface Window {
    __renderStats: {
      render: () => void;
      recompiles: () => { t: number; from: number; to: number; lights: number }[];
      countLights: () => number;
      getMeshCount: () => number;
      export: () => {
        triangles: number;
        drawCalls: number;
        programs: number;
        lights: number;
        textures: number;
        geometries: number;
        meshCount: number;
        recompiles: number;
      };
    };
  }
}
