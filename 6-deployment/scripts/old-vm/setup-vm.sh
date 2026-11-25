#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 22.04/24.04 Azure VM.
# Run on the VM:  bash setup-vm.sh
set -euo pipefail

echo "==> Installing Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "==> Adding 2 GB swap (helps the AI model on small VMs)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Creating ~/ayu-ai/.env"
mkdir -p ~/ayu-ai/ollama
if [ ! -f ~/ayu-ai/.env ]; then
  PASS=$(openssl rand -hex 24)
  cat > ~/ayu-ai/.env <<EOF
POSTGRES_USER=ayu
POSTGRES_PASSWORD=${PASS}
POSTGRES_DB=ayu
OLLAMA_MODEL=qwen2.5:1.5b
HTTP_PORT=80
GHCR_OWNER=dineshrawal013
TAG=latest
EOF
  chmod 600 ~/ayu-ai/.env
  echo "Created .env with a random database password."
else
  echo ".env already exists, leaving it alone."
fi

echo
echo "Done. Log out and back in (so the docker group applies), then push to main on GitHub to deploy."
