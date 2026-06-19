#!/usr/bin/env bash
# Build the plugin inside a golang container (no local Go needed) and package the bundle.
# The .tar.gz is created with GNU tar INSIDE the container to avoid the pax headers that
# macOS BSD tar injects, which break Mattermost's "Unable to find manifest" extraction.
set -euo pipefail

PLUGIN_ID="co.baxu.channel-guard"
PLUGIN_PKG="mattermost-plugin-channel-guard"
VERSION="1.1.0"
GO_IMAGE="golang:1.26"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

echo "==> Building and packaging via Docker ($GO_IMAGE)…"
docker run --rm \
  -u "$(id -u):$(id -g)" \
  -e HOME=/tmp -e GOCACHE=/tmp/go-build -e GOPATH=/tmp/go -e CGO_ENABLED=0 -e GOTOOLCHAIN=auto \
  -v "$HERE":/src -w /src \
  "$GO_IMAGE" bash -c "
    set -e
    go mod tidy
    rm -rf server/dist && mkdir -p server/dist
    build() {
      echo \"   - \$1-\$2\"
      GOOS=\$1 GOARCH=\$2 go build -trimpath -ldflags '-s -w' -o \"server/dist/plugin-\$1-\$2\$3\" ./server
    }
    build linux   amd64 ''
    build linux   arm64 ''
    build darwin  amd64 ''
    build darwin  arm64 ''
    build windows amd64 '.exe'

    echo '   packaging bundle (GNU tar)…'
    rm -rf /tmp/bundle && mkdir -p '/tmp/bundle/${PLUGIN_ID}/server/dist' '/tmp/bundle/${PLUGIN_ID}/webapp/dist'
    cp plugin.json LICENSE NOTICE '/tmp/bundle/${PLUGIN_ID}/'
    cp -r server/dist/. '/tmp/bundle/${PLUGIN_ID}/server/dist/'
    cp webapp/dist/main.js '/tmp/bundle/${PLUGIN_ID}/webapp/dist/main.js'
    mkdir -p dist
    rm -f 'dist/${PLUGIN_PKG}-${VERSION}.tar.gz'
    tar -C /tmp/bundle -czf 'dist/${PLUGIN_PKG}-${VERSION}.tar.gz' '${PLUGIN_ID}'
  "

echo "==> Done: plugins/${PLUGIN_PKG}/dist/${PLUGIN_PKG}-${VERSION}.tar.gz"
