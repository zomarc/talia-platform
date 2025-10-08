#!/bin/bash

# Talia Netlify Deployment Script
# This script deploys the frontend to Netlify using the correct structure

echo "🚀 Deploying Talia to Netlify..."

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Verify build exists
if [ ! -d "talia-ui/dist" ]; then
    echo "❌ Build directory not found. Building first..."
    npm run build:all
fi

# Deploy using netlify CLI with explicit site selection
echo "📦 Deploying frontend build..."
netlify deploy --prod --dir=talia-ui/dist --site=talia-ui

echo "✅ Deployment complete!"
