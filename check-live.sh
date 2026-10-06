#!/bin/bash

# Check Streamer Status Script
# Usage: ./check-live.sh <username>

if [ -z "$1" ]; then
    echo "Usage: $0 <username>"
    echo "Example: $0 washodo"
    exit 1
fi

USERNAME=$1
PORT=3000
URL="http://localhost:$PORT/api/status/$USERNAME"
API_KEY_FILE=".env"

# Try to extract API_KEY from .env if it exists
API_KEY=""
if [ -f "$API_KEY_FILE" ]; then
    API_KEY=$(grep API_KEY "$API_KEY_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
fi

echo "Checking status for $USERNAME..."

# Perform the request
# We use -s for silent and -S to show errors
if [ -n "$API_KEY" ]; then
    RESPONSE=$(curl -s -H "X-API-KEY: $API_KEY" "$URL")
else
    RESPONSE=$(curl -s "$URL")
fi

# Check if curl failed
if [ $? -ne 0 ]; then
    echo "❌ Error: Could not connect to the API server at $URL"
    echo "Make sure your server is running (npm start / npx ts-node src/index.ts)"
    exit 1
fi

# Check for server-side error messages
if echo "$RESPONSE" | grep -q "error"; then
    echo "❌ API Error: $RESPONSE"
    exit 1
fi

# Parse JSON response (using grep/sed to avoid dependency on jq)
IS_LIVE=$(echo "$RESPONSE" | grep -o '"isLive":[^,}]*' | cut -d ':' -f2 | tr -d ' ')
LAST_LIVE=$(echo "$RESPONSE" | grep -o '"lastLive":"[^"]*"' | cut -d '"' -f4)

if [ "$IS_LIVE" = "true" ]; then
    echo "🟢 $USERNAME is currently LIVE!"
else
    echo "🔴 $USERNAME is offline."
    if [ -n "$LAST_LIVE" ] && [ "$LAST_LIVE" != "Unknown" ]; then
        echo "Last seen live: $LAST_LIVE"
    fi
fi
