#!/bin/bash

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set defaults if not provided in .env
PORT=${PORT:-3000}
API_KEY=${API_KEY:-"your_api_key_here"}

echo "Testing webhooks on port $PORT..."

# Execute the POST request to the test endpoint
RESPONSE=$(curl -s -X POST \
     -H "X-API-KEY: $API_KEY" \
     -H "Content-Type: application/json" \
     "http://localhost:$PORT/api/test-webhook")

echo "Response: $RESPONSE"

if [[ $RESPONSE == *"sent successfully"* ]]; then
    echo "✅ Test notification sent successfully!"
else
    echo "❌ Test failed. Please check your API_KEY and server logs."
fi
