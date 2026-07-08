#!/bin/bash
# Script para medir performance do jogo e salvar em arquivo CSV
# Uso: ./scripts/measure-perf.sh [commit] [output.csv]

set -e

COMMIT="${1:=$(git rev-parse HEAD)}"
OUTPUT="${2:=perf-results.csv}"

# Normaliza commit hash
COMMIT=$(git rev-parse "$COMMIT")
COMMIT_SHORT=$(git rev-parse --short "$COMMIT")
COMMIT_MSG=$(git log -1 --format=%B "$COMMIT" | head -1)

echo "📊 Medindo performance do commit $COMMIT_SHORT"
echo "   Mensagem: $COMMIT_MSG"
echo ""

# Prepara o arquivo CSV se não existir
if [ ! -f "$OUTPUT" ]; then
  echo "timestamp,commit,commit_short,commit_msg,avg_frame_ms,min_frame_ms,max_frame_ms,p95_frame_ms,p99_frame_ms,fps,syncWorld_ms,followCamera_ms,audio_ms,collectibles_ms,updateDamagePopups_ms,vfx_ms,updateHud_ms,updateEvents_ms,updateZoneVisual_ms,updateRespawnWait_ms,render_ms" > "$OUTPUT"
fi

echo ""
echo "⚠️  INSTRUÇÕES (manual, ~30s):"
echo ""
echo "1. npm run dev (se não estiver rodando)"
echo "2. Abra http://localhost:5173 em um navegador (desktop, não mobile)"
echo "3. Faça login e entre em uma sala (ou spectate)"
echo "4. Deixe rodar por 10-15 segundos com personagem visível"
echo "5. Abra DevTools (F12) > Console"
echo "6. Cole e execute:"
echo ""
echo "   window.profiler.printStats(); console.log(window.profiler.exportJSON())"
echo ""
echo "7. Cole o JSON abaixo:"
echo ""
read -r JSON_OUTPUT

# Parse do JSON
AVG_FRAME=$(echo "$JSON_OUTPUT" | grep -o '"avg":[0-9.]*' | head -1 | cut -d: -f2)
MIN_FRAME=$(echo "$JSON_OUTPUT" | grep -o '"min":[0-9.]*' | head -1 | cut -d: -f2)
MAX_FRAME=$(echo "$JSON_OUTPUT" | grep -o '"max":[0-9.]*' | head -1 | cut -d: -f2)
P95_FRAME=$(echo "$JSON_OUTPUT" | grep -o '"p95":[0-9.]*' | head -1 | cut -d: -f2)
P99_FRAME=$(echo "$JSON_OUTPUT" | grep -o '"p99":[0-9.]*' | head -1 | cut -d: -f2)
FPS=$(echo "$JSON_OUTPUT" | grep -o '"fps":[0-9.]*' | head -1 | cut -d: -f2)

TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S")

echo ""
echo "📈 Resultados:"
echo "   Frame médio: ${AVG_FRAME}ms"
echo "   FPS: ${FPS}"
echo "   Frame min/max: ${MIN_FRAME}ms / ${MAX_FRAME}ms"
echo ""

# Append ao CSV
echo "$TIMESTAMP,$COMMIT,$COMMIT_SHORT,\"$COMMIT_MSG\",$AVG_FRAME,$MIN_FRAME,$MAX_FRAME,$P95_FRAME,$P99_FRAME,$FPS" >> "$OUTPUT"

echo "✅ Salvo em $OUTPUT"
echo ""
echo "Para comparar entre commits, rode:"
echo "   column -t -s, $OUTPUT"
