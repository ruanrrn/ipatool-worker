#!/usr/bin/env bash
# scripts/deploy.sh — Auto-create KV namespace and deploy to Cloudflare Worker
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

WRANGLER_TOML="wrangler.toml"

need_cmd() { command -v "$1" &>/dev/null || { echo "❌ 需要 $1"; exit 1; }; }
need_cmd npx

# Ensure dependencies
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

create_kv_if_missing() {
  local binding="$1"
  local title="ipatool"

  # Check if id is already filled
  local existing_id
  existing_id=$(grep -A2 "binding = \"${binding}\"" "$WRANGLER_TOML" | grep '^id = ' | head -1 | sed 's/id = "\(.*\)"/\1/')
  if [[ -n "$existing_id" && "$existing_id" != '""' && "$existing_id" != "" ]]; then
    echo "✅ ${binding}: already has id=${existing_id}"
    return
  fi

  echo "🔧 Creating KV namespace: ${title}"
  local output
  output=$(npx wrangler kv namespace create "$title" 2>&1) || {
    # Already exists — try to find its ID
    local existing
    existing=$(npx wrangler kv namespace list 2>&1 | node -e "
      const chunks = [];
      process.stdin.on('data', c => chunks.push(c));
      process.stdin.on('end', () => {
        const list = JSON.parse(Buffer.concat(chunks).toString());
        const ns = list.find(n => n.title === '${title}');
        if (ns) { console.log(ns.id); }
        else { console.log('NOT_FOUND'); process.exit(1); }
      });
    ")
    if [[ "$existing" != "NOT_FOUND" ]]; then
      echo "   Found existing: ${existing}"
      sed -i "s|^\(id = \"\"\)|id = \"${existing}\"|" "$WRANGLER_TOML" 2>/dev/null || \
        sed -i '' "s|^\(id = \"\"\)|id = \"${existing}\"|" "$WRANGLER_TOML"
      return
    fi
    echo "❌ Failed to create KV namespace ${title}"
    echo "$output"
    exit 1
  }

  local ns_id
  ns_id=$(echo "$output" | grep -oE '[a-f0-9]{64}' | head -1)
  if [[ -z "$ns_id" ]]; then
    echo "❌ Could not parse namespace ID from wrangler output"
    echo "$output"
    exit 1
  fi

  echo "   Created: ${ns_id}"
  awk -v binding="$binding" -v ns_id="$ns_id" '
    $0 ~ "binding = \"" binding "\"" { found=NR }
    found && NR==found+1 && /id = ""/ { sub(/id = ""/, "id = \"" ns_id "\""); found=0 }
    { print }
  ' "$WRANGLER_TOML" > "${WRANGLER_TOML}.tmp" && mv "${WRANGLER_TOML}.tmp" "$WRANGLER_TOML"
}

echo "📦 Ensuring KV namespace exists..."
create_kv_if_missing "KV"

echo ""
echo "🚀 Deploying..."
npx wrangler deploy

echo ""
echo "✅ Done!"
