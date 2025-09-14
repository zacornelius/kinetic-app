#!/bin/bash

echo "🔍 KINETIC APP - Setup Verification"
echo "=================================="

# Check current branch
echo "📋 Current Branch:"
git branch --show-current

# Check if we're on main
if [ "$(git branch --show-current)" = "main" ]; then
    echo "✅ Currently on main branch"
else
    echo "❌ NOT on main branch - please switch to main"
    exit 1
fi

# Check if main is up to date
echo ""
echo "🔄 Checking if main is up to date:"
git fetch origin
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
    echo "✅ Main branch is up to date with origin"
else
    echo "❌ Main branch is not up to date - please pull latest changes"
    exit 1
fi

# Check for baseline tag
echo ""
echo "🏷️ Checking for baseline tag:"
if git tag -l | grep -q "KINETICAPP-NEW-BASELINE-v1.0"; then
    echo "✅ Baseline tag found: KINETICAPP-NEW-BASELINE-v1.0"
else
    echo "❌ Baseline tag not found"
    exit 1
fi

# Check for consolidated API
echo ""
echo "🔧 Checking for consolidated API:"
if [ -f "src/app/api/customers/consolidated/route.ts" ]; then
    echo "✅ Consolidated customer API found"
else
    echo "❌ Consolidated customer API not found"
    exit 1
fi

# Check for workflow documentation
echo ""
echo "📚 Checking for workflow documentation:"
if [ -f "DEVELOPMENT_WORKFLOW.md" ]; then
    echo "✅ Development workflow documentation found"
else
    echo "❌ Development workflow documentation not found"
    exit 1
fi

echo ""
echo "🎉 SETUP VERIFICATION COMPLETE!"
echo "✅ Main branch is active and ready for development"
echo "✅ All baseline components are in place"
echo "✅ Documentation is available"
echo ""
echo "🚀 Ready to start development from main branch!"
