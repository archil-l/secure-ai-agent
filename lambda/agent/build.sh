#!/bin/bash

# Build script for agent lambda

echo "Building agent lambda..."

# Create dist directory if it doesn't exist
mkdir -p dist

# Compile TypeScript files
echo "Compiling TypeScript..."
npx tsc

# Copy any non-TypeScript files to dist
echo "Copying additional files..."
cp -r src/*.json dist/ 2>/dev/null || :

echo "Build complete!"
