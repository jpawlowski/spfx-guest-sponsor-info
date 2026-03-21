FROM mcr.microsoft.com/devcontainers/base:bookworm

ARG NODE_VERSION=22.14.0
ARG TARGETARCH

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  bat \
  build-essential \
  ca-certificates \
  curl \
  fd-find \
  fzf \
  git \
  jq \
  python-is-python3 \
  python3 \
  ripgrep \
  unzip \
  xz-utils \
  yq \
  && rm -rf /var/lib/apt/lists/*

RUN arch="${TARGETARCH:-$(dpkg --print-architecture)}" \
  && case "${arch}" in \
  amd64|x86_64) node_arch="x64" ;; \
  arm64|aarch64) node_arch="arm64" ;; \
  *) echo "Unsupported architecture: ${arch}" >&2; exit 1 ;; \
  esac \
  && curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" \
  && curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" \
  && grep " node-v${NODE_VERSION}-linux-${node_arch}.tar.xz$" SHASUMS256.txt | sha256sum -c - \
  && tar -xJf "node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -C /usr/local --strip-components=1 --no-same-owner \
  && rm "node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" SHASUMS256.txt \
  && corepack enable \
  && npm install --global yo @microsoft/generator-sharepoint@1.22.2 \
  && npm cache clean --force

# PowerShell — needed to run the azure-function/infra/*.ps1 setup scripts locally.
# Installed from the Microsoft package repository for Debian 12.
RUN curl -fsSL https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb \
  -o /tmp/ms-prod.deb \
  && dpkg -i /tmp/ms-prod.deb \
  && rm /tmp/ms-prod.deb \
  && apt-get update \
  && apt-get install -y --no-install-recommends powershell azure-cli \
  && rm -rf /var/lib/apt/lists/*

# Azure Functions Core Tools v4 — enables `func start` for local function development.
RUN npm install --global azure-functions-core-tools@4 \
  && npm cache clean --force

# Bicep CLI — compiles azure-function/infra/main.bicep → azuredeploy.json.
# Architecture-aware: matches the same amd64/arm64 handling as the Node install above.
RUN arch="${TARGETARCH:-$(dpkg --print-architecture)}" \
  && case "${arch}" in \
  amd64|x86_64) bicep_arch="x64" ;; \
  arm64|aarch64) bicep_arch="arm64" ;; \
  *) echo "Unsupported architecture: ${arch}" >&2; exit 1 ;; \
  esac \
  && curl -fsSLo /usr/local/bin/bicep \
  "https://github.com/Azure/bicep/releases/latest/download/bicep-linux-${bicep_arch}" \
  && chmod +x /usr/local/bin/bicep

