#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
    # Read .env, remove comments and empty lines
    while read -r line; do
        [[ "$line" =~ ^#.*$ ]] && continue
        [[ -z "$line" ]] && continue
        
        # Extract key and value
        key=$(echo "$line" | cut -d'=' -f1)
        value=$(echo "$line" | cut -d'=' -f2-)
        
        # Only export if the variable is not already set in the environment
        if [ -z "${!key}" ]; then
            export "$key=$value"
        fi
    done < .env
fi

if [ -z "$WASHODO_MEMBERS" ] || [ -z "$WASHODO_FRIENDS" ]; then
    echo "Error: WASHODO_MEMBERS or WASHODO_FRIENDS not found in .env"
    exit 1
fi

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${BOLD}Twitch Streamer Status${NC}"
echo "========================================"

check_tier() {
    local tier_name=$1
    local streamers=$2
    local color=$3

    echo -e "\n${color}${BOLD}$tier_name${NC}"
    echo "----------------------------------------"

    # Fetch all statuses in bulk
    PORT=${PORT:-3000}
    RESPONSE=$(curl -s "http://localhost:$PORT/api/status/all")
    
    # Fallback if server is not running
    if [ -z "$RESPONSE" ] || echo "$RESPONSE" | grep -q "Not Found"; then
        echo -e "${RED}API Server not reachable on port $PORT. Fetching from Twitch API directly...${NC}"
        
        # We can't easily do bulk Twitch API calls in bash without an OAuth token, 
        # so we'll fall back to individual public API checks or simply warn the user.
        # However, for a CLI tool, the best "offline" mode is to check if the server is up first.
        
        IFS=',' read -ra ADDR <<< "$streamers"
        for username in "${ADDR[@]}"; do
            # Attempt a simple public check via Twitch's GQL or a helper if available, 
            # but realistically, without the server's OAuth token, we can't check live status.
            echo -e "  ${RED}○${NC} $username (Server Offline - Status Unknown)"
        done
        return
    fi

    IFS=',' read -ra ADDR <<< "$streamers"
    for username in "${ADDR[@]}"; do
        lower_user=$(echo "$username" | tr '[:upper:]' '[:lower:]')
        
        # Use grep to find the block for this user, then parse values from that block
        USER_BLOCK=$(echo $RESPONSE | grep -o "\"$lower_user\":{[^}]*}")
        
        IS_LIVE=$(echo "$USER_BLOCK" | grep -o '"isLive":true')

        if [ ! -z "$IS_LIVE" ]; then
            echo -e "  ${GREEN}●${NC} $username ${GREEN}(LIVE)${NC}"
        else
            echo -e "  ${RED}○${NC} $username (Offline)"
        fi
    done
}

check_tier "Washodo Members" "$WASHODO_MEMBERS" "$PURPLE"
check_tier "Washodo Friends" "$WASHODO_FRIENDS" "$PURPLE"

echo -e "\n========================================"
