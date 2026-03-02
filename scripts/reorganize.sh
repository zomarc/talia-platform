#!/bin/bash

# Talia UI Project Reorganization Script
# This script will reorganize the project structure for better organization

set -e  # Exit on any error

echo "🚀 Starting Talia UI Project Reorganization..."

# Navigate to the project directory
cd /Users/russell/Dev/talia

echo "📁 Current directory: $(pwd)"
echo "📋 Current structure:"
ls -la

# Create backup directory
echo "💾 Creating backup directory..."
mkdir -p talia-backup-$(date +%Y%m%d-%H%M%S)

# Step 1: Move the main project from nested structure
echo "📦 Step 1: Moving main project from nested structure..."
if [ -d "talia-ui/talia-ui" ]; then
    echo "   Moving talia-ui/talia-ui/* to talia-ui/"
    # Create temporary directory
    mkdir -p talia-ui-temp
    # Move contents from nested directory
    mv talia-ui/talia-ui/* talia-ui-temp/
    # Remove nested directory
    rm -rf talia-ui/talia-ui
    # Move contents back to main directory
    mv talia-ui-temp/* talia-ui/
    # Remove temp directory
    rmdir talia-ui-temp
    echo "   ✅ Main project moved successfully"
else
    echo "   ⚠️  Nested talia-ui directory not found"
fi

# Step 2: Rename GraphQL server for consistency
echo "🔄 Step 2: Renaming GraphQL server..."
if [ -d "Talia-graphql-server" ]; then
    mv "Talia-graphql-server" "talia-graphql-server"
    echo "   ✅ GraphQL server renamed to talia-graphql-server"
else
    echo "   ⚠️  GraphQL server directory not found"
fi

# Step 3: Create archive directory and move old projects
echo "📚 Step 3: Archiving old projects..."
mkdir -p talia-archive

# Move old project versions to archive
if [ -d "talia-ui/dockview01-2x2Working" ]; then
    mv talia-ui/dockview01-2x2Working talia-archive/
    echo "   ✅ Moved dockview01-2x2Working to archive"
fi

if [ -d "talia-ui/archive" ]; then
    mv talia-ui/archive/* talia-archive/
    rmdir talia-ui/archive
    echo "   ✅ Moved archive contents to talia-archive"
fi

# Step 4: Clean up any remaining nested directories
echo "🧹 Step 4: Cleaning up structure..."
if [ -d "talia-ui/talia-ui" ]; then
    echo "   Removing remaining nested directory..."
    rm -rf talia-ui/talia-ui
fi

# Step 5: Show final structure
echo "🎉 Reorganization complete!"
echo "📁 Final structure:"
ls -la

echo ""
echo "📋 New project structure:"
echo "├── talia-ui/                    # Main project"
echo "├── talia-graphql-server/        # GraphQL server"
echo "├── talia-archive/              # Archived old projects"
echo "└── [other projects]/"
echo ""
echo "✅ Reorganization complete! You can now work from:"
echo "   cd /Users/russell/Dev/talia/talia-ui"
