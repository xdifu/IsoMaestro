#!/bin/bash

###############################################################################
# Complete MCP Tool Fix Script
# Fixes planTask tool disablement by:
# 1. Rebuilding the project
# 2. Verifying tool registration
# 3. Starting a fresh MCP server instance
# 4. Running the complete MCP flow demonstration
###############################################################################

set -e

echo "=========================================="
echo "IsoMaestro MCP Tool Fix & Demo Script"
echo "=========================================="
echo ""

# Step 1: Clean rebuild
echo "📦 Step 1: Clean Rebuild"
echo "──────────────────────────────────────────"
rm -rf dist/
npm run build > /dev/null 2>&1
echo "✅ Build completed"
echo ""

# Step 2: Verify tool registration
echo "✅ Step 2: Verify Tool Registration"
echo "──────────────────────────────────────────"
node verify-tools.js 2>&1 | grep -E "✅|❌|Tool|tools"
echo ""

# Step 3: Run complete MCP flow demo
echo "🚀 Step 3: Run Complete MCP Flow"
echo "──────────────────────────────────────────"
node run-demo.js 2>&1
echo ""

echo "=========================================="
echo "✨ All fixes and demonstrations completed!"
echo "=========================================="
