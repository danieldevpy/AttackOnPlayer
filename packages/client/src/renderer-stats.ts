/**
 * Ferramentas de diagnóstico de render (draw calls, triângulos, shader compilations)
 */

import * as THREE from "three";

export function setupRendererStats(renderer: THREE.WebGLRenderer) {
  const stats = {
    lastReport: 0,
    reportInterval: 2000, // a cada 2s
  };

  const originalRender = renderer.render.bind(renderer);

  renderer.render = function (scene: THREE.Scene, camera: THREE.Camera) {
    originalRender(scene, camera);

    // Expõe stats globais
    const info = renderer.info;
    if (!window.__renderStats) {
      window.__renderStats = {
        render: () => {
          console.group("[Renderer Stats]");
          console.log(`Triangles: ${info.render.triangles}`);
          console.log(`Lines: ${info.render.lines}`);
          console.log(`Points: ${info.render.points}`);
          console.log(`Draw Calls: ${info.render.calls}`);
          console.log(`Textures (in memory): ${info.memory.textures}`);
          console.log(`Geometries (in memory): ${info.memory.geometries}`);
          console.log(`Programs: ${info.programs?.length ?? "N/A"}`);
          console.groupEnd();
        },
        getMeshCount: () => {
          let count = 0;
          scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) count++;
          });
          return count;
        },
        getAverageVerticesPerMesh: () => {
          let totalVerts = 0;
          let meshCount = 0;
          scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh && obj.geometry) {
              const geo = obj.geometry as THREE.BufferGeometry;
              const posAttr = geo.getAttribute("position");
              if (posAttr) {
                totalVerts += posAttr.count;
                meshCount++;
              }
            }
          });
          return meshCount > 0 ? Math.round(totalVerts / meshCount) : 0;
        },
        export: () => ({
          triangles: info.render.triangles,
          lines: info.render.lines,
          points: info.render.points,
          drawCalls: info.render.calls,
          textures: info.memory.textures,
          geometries: info.memory.geometries,
          programs: info.programs?.length ?? 0,
          meshCount: window.__renderStats.getMeshCount(),
          avgVerticesPerMesh: window.__renderStats.getAverageVerticesPerMesh(),
        }),
      };
    }

    return this;
  };

  return stats;
}

declare global {
  interface Window {
    __renderStats: {
      render: () => void;
      getMeshCount: () => number;
      getAverageVerticesPerMesh: () => number;
      export: () => {
        triangles: number;
        lines: number;
        points: number;
        drawCalls: number;
        textures: number;
        geometries: number;
        programs: number;
        meshCount: number;
        avgVerticesPerMesh: number;
      };
    };
  }
}
