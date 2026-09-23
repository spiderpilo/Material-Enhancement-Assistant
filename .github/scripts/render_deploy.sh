#!/usr/bin/env bash
# Deploy one image to a Render image-backed service and wait until it is live.
#
#   render_deploy.sh <image-ref> <public-base-url> <health-path> <expected-version>
#
# Requires RENDER_DEPLOY_HOOK in the environment (a secret; never printed).
# "Live" means <public-base-url><health-path> returns JSON whose "version"
# equals <expected-version> (the commit SHA baked into the image).
set -euo pipefail

image="$1"
base_url="${2%/}"
health_path="$3"
expected_version="$4"
timeout_seconds="${DEPLOY_TIMEOUT_SECONDS:-900}"

if [[ -z "${RENDER_DEPLOY_HOOK:-}" ]]; then
  echo "::error::Render deploy hook secret is not set for this service." >&2
  exit 1
fi
if [[ -z "$base_url" ]]; then
  echo "::error::Public service URL variable is not set; cannot verify the deploy." >&2
  exit 1
fi

encoded_image="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$image")"
separator='?'
[[ "$RENDER_DEPLOY_HOOK" == *\?* ]] && separator='&'

echo "Triggering Render deploy of ${image}"
# --fail makes curl exit non-zero on 4xx/5xx without echoing the hook URL.
response="$(curl --silent --show-error --fail --max-time 30 --retry 3 --retry-all-errors \
  -X POST "${RENDER_DEPLOY_HOOK}${separator}imgURL=${encoded_image}")"
echo "Render accepted the deploy: ${response:-<queued>}"

echo "Waiting up to ${timeout_seconds}s for ${base_url}${health_path} to report version ${expected_version}"
deadline=$((SECONDS + timeout_seconds))
live_version=""
while (( SECONDS < deadline )); do
  body="$(curl --silent --max-time 10 "${base_url}${health_path}" || true)"
  live_version="$(python3 -c 'import json, sys
try:
    print(json.loads(sys.stdin.read()).get("version", ""))
except Exception:
    print("")' <<<"$body")"
  if [[ "$live_version" == "$expected_version" ]]; then
    echo "Live: ${base_url} is serving ${expected_version}"
    exit 0
  fi
  sleep 15
done

echo "::error::Timed out: ${base_url}${health_path} still reports version '${live_version:-unreachable}', expected '${expected_version}'. Check the Render deploy logs; the previous version keeps serving traffic." >&2
exit 1
