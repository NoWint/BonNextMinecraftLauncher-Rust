#!/usr/bin/env bash
# BonNext Linux Build Script (Ubuntu 22.04+ / Debian 12+)
# Usage: chmod +x scripts/build-linux.sh && ./scripts/build-linux.sh

set -euo pipefail

echo "=== BonNext Linux Build ==="
echo ""

# Check Ubuntu/Debian
if ! command -v apt-get &>/dev/null; then
    echo "Error: This script requires Ubuntu or Debian."
    echo "For other distros, install the equivalent packages listed below."
    exit 1
fi

# --- System dependencies ---
echo "[1/5] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
    build-essential \
    curl \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    libgtk-3-dev \
    libjavascriptcoregtk-4.1-dev \
    libsoup-3.0-dev \
    libasound2-dev \
    libssl-dev

# --- Rust ---
if ! command -v rustup &>/dev/null; then
    echo "[2/5] Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "[2/5] Rust already installed"
fi

# --- Node.js + pnpm ---
if ! command -v pnpm &>/dev/null; then
    echo "[3/5] Installing Node.js + pnpm..."
    if ! command -v node &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y -qq nodejs
    fi
    npm install -g pnpm
else
    echo "[3/5] pnpm already installed"
fi

# --- Frontend deps ---
echo "[4/5] Installing frontend dependencies..."
pnpm install --frozen-lockfile

# --- Build ---
echo "[5/5] Building Tauri (Linux)..."
pnpm tauri build

echo ""
echo "=== Build Complete ==="
echo "Artifacts:"
find src-tauri/target/release/bundle -type f -name "*.deb" -o -name "*.AppImage" 2>/dev/null || \
    echo "  Binary: src-tauri/target/release/bonnext"
echo "  DEB:    src-tauri/target/release/bundle/deb/"
echo "  AppImage: src-tauri/target/release/bundle/appimage/"
