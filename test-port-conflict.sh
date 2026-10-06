#!/bin/bash

# Port Conflict Test Script
echo "🚀 Starting Port Conflict Test..."

# 1. Create a temporary entry point for the server
cat <<EOF > .test_entry.ts
import { ApiServer } from './src/server';
const server = new ApiServer();
server.start();
EOF

# 2. Start the first instance in the background
echo "📦 Launching first instance..."
npx ts-node .test_entry.ts > .instance1.log 2>&1 &
INSTANCE1_PID=$!

# Give it a few seconds to bind to the port
sleep 3

if grep -q "API Server running on port" .instance1.log; then
    echo "✅ First instance is up and running."
else
    echo "❌ First instance failed to start. Check .instance1.log"
    kill $INSTANCE1_PID 2>/dev/null
    rm .test_entry.ts .instance1.log .instance2.log
    exit 1
fi

# 3. Start the second instance
echo "📦 Launching second instance (expecting conflict)..."
npx ts-node .test_entry.ts > .instance2.log 2>&1
INSTANCE2_EXIT_CODE=$?

# 4. Verify the result
if grep -q "FATAL ERROR: Port" .instance2.log; then
    echo "✅ SUCCESS: Port conflict detected and handled correctly!"
    echo "Message found: $(grep "FATAL ERROR" .instance2.log)"
else
    echo "❌ FAILURE: Second instance did not report the port conflict."
    cat .instance2.log
fi

echo "Exited with code: $INSTANCE2_EXIT_CODE"

# 5. Cleanup
echo "🧹 Cleaning up..."
kill $INSTANCE1_PID 2>/dev/null
rm .test_entry.ts .instance1.log .instance2.log

if [ $INSTANCE2_EXIT_CODE -eq 1 ]; then
    echo "🎉 Test Passed!"
    exit 0
else
    echo "⚠️ Test Failed (Wrong exit code)."
    exit 1
fi
EOF
