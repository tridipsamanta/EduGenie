#!/bin/bash
# Quick Test Commands for EduGenie AI Fix
# Run from project root: /Users/tridipsamanta/Desktop/My\ Projects/Code-Wrangler

echo "🚀 EduGenie AI Quota Fix - Quick Test Guide"
echo "==========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

cd "/Users/tridipsamanta/Desktop/My Projects/Code-Wrangler/backend"

echo -e "${YELLOW}STEP 1: Clean Install${NC}"
echo "rm -rf .next node_modules package-lock.json"
echo "npm install"
echo ""

echo -e "${YELLOW}STEP 2: Start Backend${NC}"
echo "npm run dev"
echo ""

echo -e "${YELLOW}STEP 3: Test API Configuration (in another terminal)${NC}"
echo ""
echo "Check config only:"
echo "curl http://localhost:3000/api/test-ai"
echo ""

echo "Test all providers:"
echo "curl -X POST http://localhost:3000/api/test-ai"
echo ""

echo -e "${YELLOW}STEP 4: Monitor Backend Logs${NC}"
echo "Look for:"
echo "  ✅ 'EDUGENIE BACKEND STARTUP - ENVIRONMENT VERIFICATION'"
echo "  ✅ 'READY! X AI providers configured'"
echo "  ✅ '[Gemini] Successfully received response' (when testing)"
echo ""

echo -e "${YELLOW}STEP 5: Test Course Generation${NC}"
echo "Frontend: My Courses → Create New Course"
echo "Parameters:"
echo "  - Course Name: Test Course"
echo "  - Chapters: 3"
echo "  - Level: Beginner"
echo "  - Duration: 4 weeks"
echo "  - Description: Test course for debugging"
echo ""

echo -e "${YELLOW}EXPECTED LOG OUTPUT:${NC}"
echo ""
echo "  🎓 [Course Generation] Starting curriculum generation..."
echo "  📝 Input: { courseName: 'Test Course', chapterCount: 3, ... }"
echo "  🔄 [Course Gen] Attempting OpenAI..."
echo "  ✅ [Course Gen] Success with OpenAI! Response length: XXXX"
echo "  🔍 [Course Gen] Parsing JSON response..."
echo "  ✅ [Course Gen] Parsed successfully! Chapters: 3"
echo ""

echo -e "${RED}⚠️  IF COURSE GENERATION FAILS:${NC}"
echo ""
echo "1. Check test endpoint:"
echo "   curl -X POST http://localhost:3000/api/test-ai"
echo ""
echo "2. Look for specific errors in response"
echo ""
echo "3. Common issues:"
echo "   - GEMINI_API_KEY not set → Check .env"
echo "   - 'Invalid API key' → Key is expired/invalid"
echo "   - '429 Rate limited' → Daily quota exceeded"
echo "   - '401 Unauthorized' → OpenAI billing needed"
echo ""

echo -e "${GREEN}✅ ALL FIXES APPLIED:${NC}"
echo ""
echo "  ✅ gemini-2.5-flash → gemini-1.5-flash (all 6 files)"
echo "  ✅ Enhanced error logging in callGemini()"
echo "  ✅ Startup environment verification"
echo "  ✅ Test endpoint /api/test-ai"
echo "  ✅ Removed VITE_GEMINI_API_KEY from backend"
echo ""

echo "📖 Full guide: Read AI_QUOTA_FIX_GUIDE.md"
echo ""
