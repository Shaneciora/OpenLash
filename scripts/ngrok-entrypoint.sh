#!/usr/bin/env sh
set -eu

if [ -z "${NGROK_AUTHTOKEN:-}" ]; then
  echo "NGROK_AUTHTOKEN is not set — cross-network tunnel disabled."
  echo "Add your free ngrok token to .env to let phones on other networks join."
  exec sleep infinity
fi

exec ngrok start openlash --config=/etc/ngrok/ngrok.yml --log=stdout
