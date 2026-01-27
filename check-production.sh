#!/bin/bash
# Production Verification Script
# Run this to confirm what's actually deployed and working

echo "🔍 PRODUCTION VERIFICATION CHECKLIST"
echo "====================================="
echo ""

# Check if we're in the right directory
if [ ! -d "pages" ]; then
    echo "❌ Error: Not in project root. Please cd to your project directory."
    exit 1
fi

echo "📋 Step 1: Check Current Branch"
echo "Current branch: $(git branch --show-current)"
echo ""

echo "📋 Step 2: Check files that should be working in PRODUCTION"
echo ""

# Critical files to verify
FILES=(
    "pages/laporan-sesi.js"
    "pages/api/submitReport.js"
    "pages/api/upload-image.js"
    "pages/api/upload-proxy.js"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
        
        # Check last modification
        if command -v stat &> /dev/null; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                mod_time=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file")
            else
                # Linux
                mod_time=$(stat -c "%y" "$file" | cut -d. -f1)
            fi
            echo "   Last modified: $mod_time"
        fi
        
        # Check if file uses upload-image or upload-proxy
        if grep -q "upload-image" "$file" 2>/dev/null; then
            echo "   📡 Uses: /api/upload-image (Google Drive API)"
        fi
        if grep -q "upload-proxy" "$file" 2>/dev/null; then
            echo "   📡 Uses: /api/upload-proxy (Apps Script)"
        fi
        
        echo ""
    else
        echo "❌ $file MISSING!"
        echo ""
    fi
done

echo "📋 Step 3: Check Git Status"
echo ""
git status --short | head -20
echo ""

echo "📋 Step 4: Show Last 10 Commits"
echo ""
git log --oneline -10
echo ""

echo "📋 Step 5: Compare with Production Remote"
echo ""
if git remote | grep -q "origin"; then
    echo "Fetching from remote..."
    git fetch origin main --quiet
    
    AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
    BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
    
    echo "Your local is: $AHEAD commits ahead, $BEHIND commits behind origin/main"
    echo ""
    
    if [ "$AHEAD" != "0" ] && [ "$AHEAD" != "?" ]; then
        echo "⚠️  You have $AHEAD unpushed commits:"
        git log origin/main..HEAD --oneline | head -5
    fi
    
    if [ "$BEHIND" != "0" ] && [ "$BEHIND" != "?" ]; then
        echo "⚠️  Production is $BEHIND commits ahead (you need to pull):"
        git log HEAD..origin/main --oneline | head -5
    fi
else
    echo "⚠️  No 'origin' remote configured"
fi

echo ""
echo "📋 Step 6: Files Modified in Last 24 Commits"
echo ""
git diff --name-only HEAD~24 HEAD 2>/dev/null | grep -E "(laporan|upload|submit)" | sort | uniq
echo ""

echo "✅ Verification Complete!"
echo ""
echo "📝 NEXT STEPS:"
echo "1. Confirm laporan-sesi.js works in production"
echo "2. Identify last commit BEFORE the 24-commit sprint"
echo "3. Create recovery branch from that commit"
echo "4. Rebuild laporan-bangkit.js cleanly"
