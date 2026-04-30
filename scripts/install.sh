#!/usr/bin/env bash
set -euo pipefail

# ipaTool one-click install/upgrade/reset-password script
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ruanrrn/ipaTool/main/scripts/install.sh | bash -s -- install [VERSION]
#   ./scripts/install.sh install [VERSION]
#   ./scripts/install.sh upgrade [VERSION]
#   ./scripts/install.sh reset-password

REPO="ruanrrn/ipaTool"
APP_NAME="ipatool"
SYSTEMD_SERVICE="ipatool"
DEFAULT_INSTALL_DIR="/opt/${APP_NAME}"
GITHUB_API="https://api.github.com"
RELEASES_URL="${GITHUB_API}/repos/${REPO}/releases"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Detect OS and architecture
detect_arch() {
    local os arch
    os=$(uname -s)
    arch=$(uname -m)

    if [ "$os" != "Linux" ]; then
        log_error "Unsupported OS: $os. Currently only Linux is supported."
        exit 1
    fi

    case "$arch" in
        x86_64|amd64)
            echo "amd64"
            ;;
        aarch64|arm64)
            echo "arm64"
            ;;
        *)
            log_error "Unsupported architecture: $arch"
            exit 1
            ;;
    esac
}

# Get latest version from GitHub API if version not specified
get_latest_version() {
    local latest tag
    latest=$(curl -fsSL "${RELEASES_URL}/latest" 2>/dev/null || true)
    if [ -z "$latest" ]; then
        log_error "Failed to fetch latest release from GitHub."
        exit 1
    fi
    tag=$(echo "$latest" | grep -o '"tag_name": *"[^"]*"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
    if [ -z "$tag" ]; then
        log_error "Failed to parse latest release tag."
        exit 1
    fi
    echo "${tag#v}"
}

# Download and verify release
download_release() {
    local version arch pkg_name dl_url
    version="$1"
    arch="$(detect_arch)"
    pkg_name="ipatool-${version}-linux-${arch}.tar.gz"
    dl_url="https://github.com/${REPO}/releases/download/v${version}/${pkg_name}"

    log_info "Downloading ipaTool v${version} (${arch})..."
    log_info "URL: ${dl_url}"

    curl -fsSL -o "/tmp/${pkg_name}" "${dl_url}" || {
        log_error "Download failed. Version v${version} may not exist for ${arch}."
        exit 1
    }

    echo "/tmp/${pkg_name}"
}

# Install from downloaded package
install_package() {
    local pkg_file install_dir version
    pkg_file="$1"
    install_dir="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    version="$2"

    log_info "Installing to ${install_dir}..."

    # Stop existing service if running
    if systemctl is-active --quiet "${SYSTEMD_SERVICE}" 2>/dev/null; then
        log_info "Stopping existing ${SYSTEMD_SERVICE} service..."
        systemctl stop "${SYSTEMD_SERVICE}" || true
    fi

    # Create install directory
    mkdir -p "${install_dir}"

    # Extract package
    tar xzf "${pkg_file}" -C /tmp/
    local extracted_dir="/tmp/ipatool-${version}-linux-$(detect_arch)"

    if [ ! -d "$extracted_dir" ]; then
        # try without arch suffix
        extracted_dir=$(find /tmp -maxdepth 1 -type d -name "ipatool-${version}-*" | head -1)
    fi

    if [ ! -d "$extracted_dir" ]; then
        log_error "Failed to extract package. Expected directory not found."
        exit 1
    fi

    log_info "Copying files to ${install_dir}..."
    # Copy server binary
    cp -f "${extracted_dir}/server" "${install_dir}/server"
    chmod +x "${install_dir}/server"

    # Copy dist (frontend)
    if [ -d "${install_dir}/dist" ]; then
        rm -rf "${install_dir}/dist"
    fi
    cp -r "${extracted_dir}/dist" "${install_dir}/dist"

    # Copy start.sh
    cp -f "${extracted_dir}/start.sh" "${install_dir}/start.sh"
    chmod +x "${install_dir}/start.sh"

    # Cleanup
    rm -rf "$extracted_dir"
    rm -f "$pkg_file"

    log_info "Installation files placed in ${install_dir}"

    # Save version info
    echo "${version}" > "${install_dir}/.version"

    # Setup systemd service
    setup_systemd "${install_dir}"

    log_info "Installation complete!"
    log_info "To view admin password on first run: journalctl -u ${SYSTEMD_SERVICE} -f"
}

# Setup systemd service
setup_systemd() {
    local install_dir="$1"
    local service_file="/etc/systemd/system/${SYSTEMD_SERVICE}.service"

    if [ "$(id -u)" -ne 0 ]; then
        log_warn "Not running as root. Skipping systemd service setup."
        log_info "You can manually run: ${install_dir}/start.sh"
        return
    fi

    log_info "Setting up systemd service..."

    cat > "$service_file" << SERVICE_EOF
[Unit]
Description=ipaTool - IPA download and archive manager
After=network.target

[Service]
Type=simple
ExecStart=${install_dir}/start.sh
WorkingDirectory=${install_dir}
Restart=on-failure
RestartSec=5
# Set admin initial password (optional)
# Environment=IPA_ADMIN_INITIAL_PASSWORD=your-secure-password
# Database path (optional, default is /app/data/ipa-webtool.db inside Docker;
# for bare-metal, uncomment and adjust)
# Environment=DATABASE_PATH=${install_dir}/data/ipa-webtool.db
# Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
SERVICE_EOF

    systemctl daemon-reload
    systemctl enable "${SYSTEMD_SERVICE}" 2>/dev/null || true
    systemctl start "${SYSTEMD_SERVICE}" 2>/dev/null || true

    log_info "Systemd service ${SYSTEMD_SERVICE} installed and started."
    log_info "Check status: systemctl status ${SYSTEMD_SERVICE}"
    log_info "View logs: journalctl -u ${SYSTEMD_SERVICE} -f"
}

# Upgrade to new version
do_upgrade() {
    local version pkg_file install_dir
    version="$1"
    install_dir="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"

    if [ ! -f "${install_dir}/.version" ] && [ ! -f "${install_dir}/server" ]; then
        log_warn "No existing installation found at ${install_dir}. Performing fresh install..."
        do_install "$version"
        return
    fi

    local current_version="unknown"
    if [ -f "${install_dir}/.version" ]; then
        current_version=$(cat "${install_dir}/.version")
    fi

    log_info "Current version: ${current_version}"
    log_info "Upgrading to version v${version}..."

    pkg_file=$(download_release "$version")
    install_package "$pkg_file" "$version"

    log_info "Upgrade complete! v${current_version} -> v${version}"

    # Restart service (install_package already stops it, setup_systemd starts it)
    if systemctl is-active --quiet "${SYSTEMD_SERVICE}" 2>/dev/null; then
        log_info "Service ${SYSTEMD_SERVICE} is running."
    else
        log_warn "Service did not start. Check logs: journalctl -u ${SYSTEMD_SERVICE} -f"
    fi
}

# Fresh install
do_install() {
    local version pkg_file
    version="$1"
    pkg_file=$(download_release "$version")
    install_package "$pkg_file" "$version"
}

# Reset admin password
do_reset_password() {
    local install_dir server_bin
    install_dir="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    server_bin="${install_dir}/server"

    if [ ! -f "$server_bin" ]; then
        log_error "Server binary not found at ${server_bin}. Install first."
        exit 1
    fi

    log_info "Resetting admin password..."
    log_info "Note: This will invalidate all existing admin login sessions."

    # Generate a secure random password
    local new_password
    new_password=$(tr -dc 'A-Za-z0-9!@#$%^&*()_+-=' < /dev/urandom | head -c 16)

    # Use the server binary's reset-admin-password command
    printf '%s' "$new_password" | "$server_bin" reset-admin-password --username admin --password-stdin 2>/dev/null || {
        log_warn "Direct binary call failed, trying with environment..."
        DATABASE_PATH="${install_dir}/data/ipa-webtool.db" printf '%s' "$new_password" | "$server_bin" reset-admin-password --username admin --password-stdin || {
            log_error "Password reset failed. Check that the server binary is functional."
            exit 1
        }
    }

    log_info "Admin password reset successfully!"
    echo ""
    echo "  New admin password: ${new_password}"
    echo ""
    log_warn "Please save this password securely. It will NOT be displayed again."
}

# Main
print_usage() {
    echo "Usage:"
    echo "  $0 install [VERSION]          Install ipaTool (latest if version omitted)"
    echo "  $0 upgrade [VERSION]          Upgrade existing installation (latest if omitted)"
    echo "  $0 reset-password             Reset admin password"
    echo ""
    echo "One-liner (recommended):"
    echo "  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/scripts/install.sh | bash -s -- install"
}

main() {
    if [ $# -lt 1 ]; then
        print_usage
        exit 1
    fi

    local cmd="${1:-}"
    local version="${2:-}"

    case "$cmd" in
        install)
            version="${version:-$(get_latest_version)}"
            log_info "Installing ipaTool v${version}..."
            do_install "$version"
            ;;
        upgrade)
            version="${version:-$(get_latest_version)}"
            log_info "Upgrading ipaTool to v${version}..."
            do_upgrade "$version"
            ;;
        reset-password)
            do_reset_password
            ;;
        --help|-h|help)
            print_usage
            ;;
        *)
            log_error "Unknown command: $cmd"
            print_usage
            exit 1
            ;;
    esac
}

main "$@"
