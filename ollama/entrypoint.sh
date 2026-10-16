#!/bin/sh
# Start Ollama, then download the model once (it is kept in the ollama_data volume).
set -e

MODEL="${OLLAMA_MODEL:-qwen2.5:1.5b}"

ollama serve &
SERVER_PID=$!

echo "Waiting for Ollama to start..."
until ollama list >/dev/null 2>&1; do sleep 1; done

if ollama list | awk 'NR>1 {print $1}' | grep -qx "$MODEL"; then
  echo "Model $MODEL already present."
else
  echo "Pulling $MODEL (first start only, ~1 GB)..."
  ollama pull "$MODEL"
fi

# Load the model into memory so the first insight is fast.
ollama run "$MODEL" "Reply with OK." >/dev/null 2>&1 || true
echo "Ollama ready with $MODEL"

wait "$SERVER_PID"
