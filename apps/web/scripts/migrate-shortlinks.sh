#!/bin/bash
# Migrate shortlinks from Storyblok to Shlink
# Run this against the PRODUCTION Shlink instance during Phase 8
#
# Usage: SHLINK_URL=https://y4h.link SHLINK_API_KEY=<key> ./scripts/migrate-shortlinks.sh

set -euo pipefail

SHLINK_URL="${SHLINK_URL:?Set SHLINK_URL (e.g. https://y4h.link)}"
SHLINK_API_KEY="${SHLINK_API_KEY:?Set SHLINK_API_KEY}"

echo "Importing shortlinks into Shlink at $SHLINK_URL..."
echo ""

create_shortlink() {
  local slug="$1"
  local destination="$2"
  local crawlable="${3:-false}"

  echo -n "  /$slug → $destination ... "

  response=$(curl -s -w "\n%{http_code}" -X POST "$SHLINK_URL/rest/v3/short-urls" \
    -H "X-Api-Key: $SHLINK_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"longUrl\": \"$destination\", \"customSlug\": \"$slug\", \"crawlable\": $crawlable, \"forwardQuery\": true}")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)

  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "✓"
  else
    echo "FAILED ($http_code)"
    echo "    $body"
  fi
}

# Shortlinks exported from Storyblok config story (2026-03-19)
create_shortlink "signup"          "https://dashboard.solidarity.tech/sites/393/pages/7950#results"
create_shortlink "training"        "https://the-youth-alliance-for-housing-yah.solidarity.tech/2-day-training-intensive-registration-form"
create_shortlink "campus-training" "https://the-youth-alliance-for-housing-yah.solidarity.tech/2-day-training-intensive-registration-form1"
create_shortlink "sign-in"         "https://the-youth-alliance-for-housing-yah.solidarity.tech/meeting-signin"
create_shortlink "join"            "https://the-youth-alliance-for-housing-yah.solidarity.tech/join"
create_shortlink "whatsapp"        "https://chat.whatsapp.com/LHaR5ojA9ddKbs0T9yj1CS?mode=gi_t"
create_shortlink "donate"          "https://www.every.org/yah" true

echo ""
echo "Done. Verify with: curl -I $SHLINK_URL/<slug>"
echo ""
echo "Add these legacy redirects to your Caddyfile:"
echo ""
echo "y4h.org {"
echo "    # Legacy shortlink redirects (printed QR codes point to y4h.org/<slug>)"
echo "    redir /signup         https://y4h.link/signup permanent"
echo "    redir /training       https://y4h.link/training permanent"
echo "    redir /campus-training https://y4h.link/campus-training permanent"
echo "    redir /sign-in        https://y4h.link/sign-in permanent"
echo "    redir /join            https://y4h.link/join permanent"
echo "    redir /whatsapp       https://y4h.link/whatsapp permanent"
echo "    redir /donate         https://y4h.link/donate permanent"
echo ""
echo "    reverse_proxy sveltekit:3000"
echo "}"
