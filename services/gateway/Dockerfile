FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
EXPOSE 3000
# Generous timings: on the 2-vCPU VM, Ollama loading the model can starve the CPU for minutes.
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --start-interval=5s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
