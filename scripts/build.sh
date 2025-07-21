#!/bin/bash

# Build script for API Spawner with version information

set -e

echo "🚀 Building API Spawner..."

# Get current timestamp
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Get git commit hash (if available)
GIT_COMMIT=""
if command -v git &> /dev/null; then
    GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
fi

# Set environment variables for the build
export BUILD_TIME="$BUILD_TIME"
export GIT_COMMIT="$GIT_COMMIT"

echo "📅 Build Time: $BUILD_TIME"
if [ ! -z "$GIT_COMMIT" ]; then
    echo "🔗 Git Commit: $GIT_COMMIT"
fi

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Build TypeScript
echo "🔨 Building TypeScript..."
yarn tsc

# Make the CLI executable
echo "🔧 Making CLI executable..."
chmod +x dist/index.js

# Display build info
echo "✅ Build completed successfully!"
echo "📦 Output: dist/"
echo "🚀 Version: $(node -e "console.log(require('./package.json').version)")"

# Optional: Run tests if available
if [ -f "package.json" ] && grep -q '"test"' package.json; then
    echo "🧪 Running tests..."
    yarn test
fi

echo "🎉 Build process completed!" 