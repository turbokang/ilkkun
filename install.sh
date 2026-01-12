#!/bin/bash
set -e

# ilkkun installer script
# Usage: curl -fsSL https://raw.githubusercontent.com/user/ilkkun/main/install.sh | bash
# Or with version: curl -fsSL ... | bash -s -- v1.0.0

REPO="user/ilkkun"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
VERSION="${1:-latest}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Detect OS and architecture
detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)

    case "$OS" in
        linux)
            OS="linux"
            ;;
        darwin)
            OS="darwin"
            ;;
        mingw*|msys*|cygwin*)
            OS="windows"
            ;;
        *)
            error "Unsupported operating system: $OS"
            ;;
    esac

    case "$ARCH" in
        x86_64|amd64)
            ARCH="x64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            error "Unsupported architecture: $ARCH"
            ;;
    esac

    PLATFORM="${OS}-${ARCH}"
    info "Detected platform: $PLATFORM"
}

# Get the download URL
get_download_url() {
    BINARY_NAME="ilkkun-${PLATFORM}"
    if [ "$OS" = "windows" ]; then
        BINARY_NAME="${BINARY_NAME}.exe"
    fi

    if [ "$VERSION" = "latest" ]; then
        DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${BINARY_NAME}"
    else
        DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}"
    fi

    info "Download URL: $DOWNLOAD_URL"
}

# Download and install
install() {
    TMP_DIR=$(mktemp -d)
    TMP_FILE="${TMP_DIR}/ilkkun"

    info "Downloading ilkkun..."
    if command -v curl &> /dev/null; then
        curl -fsSL "$DOWNLOAD_URL" -o "$TMP_FILE" || error "Download failed. Check if the version exists."
    elif command -v wget &> /dev/null; then
        wget -q "$DOWNLOAD_URL" -O "$TMP_FILE" || error "Download failed. Check if the version exists."
    else
        error "Neither curl nor wget found. Please install one of them."
    fi

    chmod +x "$TMP_FILE"

    # Check if we need sudo
    if [ -w "$INSTALL_DIR" ]; then
        mv "$TMP_FILE" "${INSTALL_DIR}/ilkkun"
    else
        info "Installing to $INSTALL_DIR requires sudo..."
        sudo mv "$TMP_FILE" "${INSTALL_DIR}/ilkkun"
    fi

    rm -rf "$TMP_DIR"

    info "ilkkun installed successfully to ${INSTALL_DIR}/ilkkun"
}

# Verify installation
verify() {
    if command -v ilkkun &> /dev/null; then
        info "Verification:"
        ilkkun --version
    else
        warn "ilkkun was installed but is not in PATH"
        warn "Add $INSTALL_DIR to your PATH or run: ${INSTALL_DIR}/ilkkun"
    fi
}

main() {
    echo ""
    echo "  _ _ _    _                 "
    echo " (_) | | _| | ___   _ _ __   "
    echo " | | | |/ / |/ / | | | '_ \  "
    echo " | | |   <|   <| |_| | | | | "
    echo " |_|_|_|\_\_|\_\\\\__,_|_| |_| "
    echo ""
    echo "AI CLI Agent Bridge to Redis"
    echo ""

    detect_platform
    get_download_url
    install
    verify

    echo ""
    info "Installation complete!"
    echo ""
    echo "Quick start:"
    echo "  ilkkun -a claude -p \"Hello\" --no-redis"
    echo ""
    echo "For more information, visit: https://github.com/${REPO}"
    echo ""
}

main
