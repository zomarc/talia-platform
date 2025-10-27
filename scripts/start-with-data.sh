#!/bin/bash

# Talia Platform - Start with Data Integration
# This script helps you start the Talia platform with data integration

echo "🚀 Starting Talia Platform with Data Integration..."
echo ""

# Check if we're in the right directory
if [ ! -f "talia-server/package.json" ]; then
    echo "❌ Please run this script from the talia project root directory"
    exit 1
fi

# Check if Supabase is running
echo "🔍 Checking if Supabase is running at http://127.0.0.1:54323/..."
if curl -s http://127.0.0.1:54323/ > /dev/null; then
    echo "✅ Supabase is running"
else
    echo "⚠️  Supabase is not running. Please start it first:"
    echo "   supabase start"
    echo ""
    echo "   Or if you don't have Supabase CLI installed:"
    echo "   https://supabase.com/docs/guides/cli/getting-started"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies if needed
echo "📦 Installing dependencies..."
cd talia-server
if [ ! -d "node_modules" ]; then
    npm install
fi

# Test data connections
echo "🔍 Testing data connections..."
node scripts/test-data-connection.js

echo ""
echo "🎯 Next steps:"
echo "1. Start the GraphQL server:"
echo "   cd talia-server && npm start"
echo ""
echo "2. Start the UI (in another terminal):"
echo "   cd talia-ui && npm run dev"
echo ""
echo "3. Open the GraphQL Playground:"
echo "   http://localhost:4000/graphql"
echo ""
echo "4. Open the Talia UI:"
echo "   http://localhost:5173"
echo ""
echo "📚 For more information, see DATA-INTEGRATION-GUIDE.md"

