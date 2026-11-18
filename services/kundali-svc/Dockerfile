# ---- build stage: compile native modules (Swiss Ephemeris) ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

# ---- runtime stage ----
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER node
EXPOSE 3002
# Generous timings: on the 2-vCPU VM, Ollama loading the model can starve the CPU for minutes.
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --start-interval=5s --retries=5 \
  CMD node -e "fetch('http://localhost:3002/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
