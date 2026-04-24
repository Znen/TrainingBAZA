#!/bin/bash
# ═══════════════════════════════════════════════
#  Training BAZA — Deploy Script
#  Usage: ./deploy.sh [server_user@host] [project_path]
#
#  Defaults:
#    SERVER = yc-user@93.77.185.161
#    PATH   = ~/TrainingBAZA
# ═══════════════════════════════════════════════

set -e

SERVER="${1:-yc-user@93.77.185.161}"
REMOTE_PATH="${2:-~/TrainingBAZA}"
BRANCH="${3:-main}"

echo ""
echo "┌─────────────────────────────────────────┐"
echo "│       Training BAZA — Deploy            │"
echo "│  Server : $SERVER"
echo "│  Path   : $REMOTE_PATH"
echo "│  Branch : $BRANCH"
echo "└─────────────────────────────────────────┘"
echo ""

# ── Step 1: Pull latest code ──────────────────
echo "▶ [1/4] Pulling latest code from GitHub..."
ssh "$SERVER" "
  cd $REMOTE_PATH &&
  git fetch origin &&
  git reset --hard origin/$BRANCH &&
  echo '✓ Code updated'
"

# ── Step 2: Stop current container ───────────
echo ""
echo "▶ [2/4] Stopping current container..."
ssh "$SERVER" "
  cd $REMOTE_PATH &&
  docker compose down &&
  echo '✓ Container stopped'
"

# ── Step 3: Build new image ───────────────────
echo ""
echo "▶ [3/4] Building new Docker image..."
ssh "$SERVER" "
  cd $REMOTE_PATH &&
  docker compose build --no-cache &&
  echo '✓ Image built'
"

# ── Step 4: Start container ───────────────────
echo ""
echo "▶ [4/4] Starting container..."
ssh "$SERVER" "
  cd $REMOTE_PATH &&
  docker compose up -d &&
  sleep 3 &&
  docker compose ps
"

# ── Done ──────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Deploy complete!"
echo "  🌐 http://93.77.185.161:3000"
echo "═══════════════════════════════════════════"
echo ""
