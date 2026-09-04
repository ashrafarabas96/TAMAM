#!/usr/bin/env bash
# TAMAM — start the whole platform. Run: bash start-mac-linux.sh
set -euo pipefail
cd "$(dirname "$0")"

echo
echo "  =========================================="
echo "     TAMAM - Starting the platform"
echo "  =========================================="
echo

command -v docker >/dev/null 2>&1 || {
  echo "  [X] Docker is not installed."
  echo "      Install Docker Desktop: https://www.docker.com/products/docker-desktop"
  exit 1
}
docker info >/dev/null 2>&1 || {
  echo "  [X] Docker is installed but not running. Start Docker Desktop and try again."
  exit 1
}

echo "  [1/3] Docker is ready."
echo "  [2/3] Building and starting (the first run takes 10-20 minutes)..."
echo
docker compose -f infrastructure/docker/docker-compose.yml up -d --build

echo
echo "  [3/3] Waiting for the system to be ready..."
for _ in $(seq 1 180); do
  if curl -fsS -o /dev/null http://localhost:3000/health/live 2>/dev/null; then
    echo
    echo "  =========================================="
    echo "     TAMAM is running"
    echo "  =========================================="
    echo
    echo "    Admin console :  http://localhost:3001"
    echo "    Email         :  admin@tamam.app"
    echo "    Password      :  TamamAdmin#2026"
    echo
    echo "    API           :  http://localhost:3000"
    echo "    File storage  :  http://localhost:9001  (tamam / tamam-secret)"
    echo
    echo "    To stop:  docker compose -f infrastructure/docker/docker-compose.yml down"
    echo
    (command -v open >/dev/null && open http://localhost:3001) \
      || (command -v xdg-open >/dev/null && xdg-open http://localhost:3001) || true
    exit 0
  fi
  sleep 5
done

echo "  [X] Did not become ready in time. See what happened with:"
echo "      docker compose -f infrastructure/docker/docker-compose.yml logs api"
exit 1
