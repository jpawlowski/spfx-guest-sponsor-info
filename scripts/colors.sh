#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
# SPDX-FileCopyrightText: 2026 Julian Pawlowski <https://github.com/jpawlowski>
# SPDX-License-Identifier: AGPL-3.0-only
#
# ANSI colour variables for use in scripts.
#
# Source this file after setting the working directory:
#   # shellcheck source=scripts/colors.sh
#   source "$(dirname "${BASH_SOURCE[0]}")/colors.sh"
#
# Colours are disabled automatically when:
#   - stdout is not a TTY (piped or redirected)
#   - $CI is non-empty (GitHub Actions, Azure DevOps, etc.)
#   - $NO_COLOR is set (https://no-color.org)
#   - $TERM is "dumb"
#
# Available variables (all exported so sub-shells can inherit them):
#   C_RED  C_GRN  C_YLW  C_CYN  C_BLD  C_DIM  C_RST

if [[ -t 1 && "${CI:-}" == "" && "${NO_COLOR:-}" == "" && "${TERM:-}" != "dumb" ]]; then
  C_RED=$'\033[0;31m'
  C_GRN=$'\033[0;32m'
  C_YLW=$'\033[1;33m'
  C_CYN=$'\033[0;36m'
  C_BLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_RST=$'\033[0m'
else
  C_RED=''
  C_GRN=''
  C_YLW=''
  C_CYN=''
  C_BLD=''
  C_DIM=''
  C_RST=''
fi

export C_RED C_GRN C_YLW C_CYN C_BLD C_DIM C_RST
