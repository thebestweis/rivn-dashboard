#!/bin/sh
set -eu

[ "$(id -u)" -eq 0 ] || {
  echo "ERROR: install-docker.sh must run as root" >&2
  exit 1
}

if command -v docker >/dev/null 2>&1; then
  docker compose version >/dev/null 2>&1 || {
    echo "ERROR: Docker exists, but Compose v2 is unavailable" >&2
    exit 1
  }
  echo "Docker Engine and Compose v2 are already installed"
  exit 0
fi

[ -r /etc/os-release ] || {
  echo "ERROR: /etc/os-release is unavailable" >&2
  exit 1
}

# shellcheck disable=SC1091
. /etc/os-release

case "${ID:-}" in
  ubuntu|debian) docker_distribution=$ID ;;
  *)
    echo "ERROR: only Ubuntu and Debian are supported by this installer" >&2
    exit 1
    ;;
esac

codename=${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}
[ -n "$codename" ] || {
  echo "ERROR: distribution codename is unavailable" >&2
  exit 1
}

conflicts=""
for package in \
  docker.io \
  docker-compose \
  docker-compose-v2 \
  docker-doc \
  docker-buildx \
  podman-docker \
  containerd \
  runc; do
  if dpkg-query -W -f='${db:Status-Abbrev}' "$package" 2>/dev/null | grep -q '^ii'; then
    conflicts="${conflicts}${conflicts:+ }${package}"
  fi
done

[ -z "$conflicts" ] || {
  echo "ERROR: conflicting packages detected: $conflicts" >&2
  echo "They were not removed automatically. Review them before continuing." >&2
  exit 1
}

export DEBIAN_FRONTEND=noninteractive

echo "Installing Docker repository prerequisites"
apt-get update -qq
apt-get install -y -qq ca-certificates curl

install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/$docker_distribution/gpg" \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

architecture=$(dpkg --print-architecture)
printf '%s\n' \
  'Types: deb' \
  "URIs: https://download.docker.com/linux/$docker_distribution" \
  "Suites: $codename" \
  'Components: stable' \
  "Architectures: $architecture" \
  'Signed-By: /etc/apt/keyrings/docker.asc' \
  > /etc/apt/sources.list.d/docker.sources

echo "Installing Docker Engine and Compose v2"
apt-get update -qq
apt-get install -y -qq \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

systemctl enable --now docker
docker version --format 'docker_server={{.Server.Version}}'
docker compose version

echo "Docker installation completed. RIVN OS and PM2 were not restarted."
