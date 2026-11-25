# Ollama with the model baked in, for Azure Container Apps (no volume to download into).
# Docker Compose (the VM and local runs) does not use this file: it runs ollama/ollama with a volume.
FROM ollama/ollama:latest

ARG OLLAMA_MODEL=qwen2.5:1.5b
ENV OLLAMA_MODEL=${OLLAMA_MODEL} \
    OLLAMA_KEEP_ALIVE=24h \
    OLLAMA_NUM_PARALLEL=2

# Download the model at build time (~1 GB), so a new replica starts without the internet.
RUN set -e; \
    ollama serve >/tmp/ollama.log 2>&1 & pid=$!; \
    until ollama list >/dev/null 2>&1; do sleep 1; done; \
    ollama pull "$OLLAMA_MODEL"; \
    kill "$pid"; wait "$pid" || true; rm -f /tmp/ollama.log

# Same start script as Compose: it finds the model present, skips the pull and warms it up.
COPY entrypoint.sh /ayu/entrypoint.sh
EXPOSE 11434
ENTRYPOINT ["/bin/sh", "/ayu/entrypoint.sh"]
