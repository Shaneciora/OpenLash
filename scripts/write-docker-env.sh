#!/usr/bin/env bash
set -euo pipefail

detect_lan_ip() {
  if command -v ipconfig >/dev/null 2>&1; then
    for iface in en0 en1 en2 bridge0; do
      ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
      if [ -n "$ip" ]; then
        echo "$ip"
        return
      fi
    done
  fi

  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}'
    return
  fi

  echo ""
}

detect_lan_ip
