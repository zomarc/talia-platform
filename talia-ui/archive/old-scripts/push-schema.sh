#!/bin/bash

# Push schema to InstantDB
echo "Pushing schema to InstantDB..."

# Use expect to handle interactive prompts
expect << 'EOF'
spawn npx instant-cli@latest push schema
expect "What would you like to do?"
send "\033[B\r"
expect "Which app would you like to import?"
send "\r"
expect eof
EOF

echo "Schema push completed!"
