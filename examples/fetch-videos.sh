#!/bin/bash

# TikTok User Videos Fetcher via Proxy
# Usage: ./fetch-videos.sh [SEC_UID]

SERVER_URL="http://localhost:8080"
PROXY_URL="${PROXY_URL:-}"
SEC_UID="${1:-MS4wLjABAAAAtBazTpLuo5XSFwEiX3gkaeV4ZY7u071I08MUNFL5B_zZoelUkTWrhCVvxK7LqAkr}"
DEVICE_ID=$((RANDOM * RANDOM * RANDOM % 9000000000000000000 + 1000000000000000000))

# Build the API URL
API_URL="https://www.tiktok.com/api/post/item_list/?WebIdLastTime=$(date +%s)&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Linux%20x86_64&browser_version=5.0&channel=tiktok_web&cookie_enabled=true&count=30&coverFormat=0&cursor=0&data_collection_enabled=true&device_id=${DEVICE_ID}&device_platform=web_pc&focus_state=true&history_len=2&is_fullscreen=false&is_page_visible=true&language=en&odinId=7185858543857140779&os=linux&priority_region=US&referer=&region=US&screen_height=1080&screen_width=1920&secUid=${SEC_UID}&tz_name=America/New_York&user_is_login=true&video_encoding=mp4&webcast_language=en"

echo "Fetching signature for secUid: ${SEC_UID:0:30}..."
echo "Device ID: $DEVICE_ID"
echo ""

# Step 1: Get signed URL from signature server
RESPONSE=$(curl -s -X POST "$SERVER_URL/signature" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$API_URL\"}")

# Check if signature was successful
STATUS=$(echo "$RESPONSE" | jq -r '.status')
if [ "$STATUS" != "ok" ]; then
  echo "Error getting signature:"
  echo "$RESPONSE" | jq .
  exit 1
fi

# Step 2: Extract signed_url, user_agent, and cookies
SIGNED_URL=$(echo "$RESPONSE" | jq -r '.data.signed_url')
USER_AGENT=$(echo "$RESPONSE" | jq -r '.data.navigator.user_agent')
COOKIES=$(echo "$RESPONSE" | jq -r '.data.cookies')

echo "Got signed URL"

# Step 3: Fetch from TikTok (via proxy if set)
PROXY_ARGS=""
if [ -n "$PROXY_URL" ]; then
  echo "Using proxy: ${PROXY_URL%%@*}@***"
  PROXY_ARGS="-x $PROXY_URL"
fi
echo ""

curl -s $PROXY_ARGS \
  -H "User-Agent: $USER_AGENT" \
  -H "Cookie: $COOKIES" \
  -H "Accept: application/json" \
  -H "Referer: https://www.tiktok.com/" \
  "$SIGNED_URL" | jq .
