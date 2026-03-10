#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/railway_deploy_clean.sh <service> [railway-up-args...]

Services:
  api
  feed-refresh
  web

This deploys from a clean temporary clone of the current repository head to avoid
Railway's local "Failed to create code snapshot" error.
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

service_name="$1"
shift

case "$service_name" in
  api)
    service_dir="rss-reader-api"
    ;;
  feed-refresh)
    service_dir="rss-reader-feed-refresh"
    ;;
  web)
    service_dir="rss-reader-web"
    ;;
  *)
    printf 'Unknown service: %s\n\n' "$service_name" >&2
    usage >&2
    exit 1
    ;;
esac

repo_root="$(git rev-parse --show-toplevel)"
status_json="$(mktemp)"
tmpdir="$(mktemp -d /tmp/rss-reader-app-deploy.XXXXXX)"

cleanup() {
  rm -f "$status_json"
  rm -rf "$tmpdir"
}

trap cleanup EXIT

(
  cd "$repo_root"
  railway status --json > "$status_json"
)

project_id="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(data.id);' "$status_json")"
environment_id="$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(data.environments.edges[0].node.id);' "$status_json")"

printf 'Creating clean deploy clone in %s\n' "$tmpdir" >&2
git clone --quiet "$repo_root" "$tmpdir/repo"

(
  cd "$tmpdir/repo/$service_dir"
  railway up -p "$project_id" -e "$environment_id" -s "$service_name" -c "$@"
)
