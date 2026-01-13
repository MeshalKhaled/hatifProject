#!/bin/bash
# Verification script: Ensures no S3 SDK is used in our source code
# Only scans our own source files, excludes node_modules, .pnpm-store, dist, etc.

set -e

echo "🔍 Verifying no S3 SDK usage in source code..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Patterns to search for (case-insensitive)
PATTERNS=(
  "aws-sdk"
  "@aws-sdk"
  "minio/client"
  "from.*aws-sdk"
  "import.*aws-sdk"
  "require.*aws-sdk"
  "from.*@aws-sdk"
  "import.*@aws-sdk"
  "require.*@aws-sdk"
)

# Directories to search (only our source code)
SEARCH_DIRS=(
  "apps/api/src"
  "apps/ui/app"
  "apps/ui/src"
)

# Directories to exclude (build output, dependencies)
EXCLUDE_DIRS=(
  "node_modules"
  ".pnpm-store"
  "dist"
  ".next"
  "build"
  "__pycache__"
  ".git"
)

# Build exclude flags for grep
EXCLUDE_FLAGS=""
for dir in "${EXCLUDE_DIRS[@]}"; do
  EXCLUDE_FLAGS="$EXCLUDE_FLAGS --exclude-dir=$dir"
done

# Track if any matches found
FOUND_MATCHES=0
MATCHES_FILE=$(mktemp)

# Search for each pattern
for pattern in "${PATTERNS[@]}"; do
  for dir in "${SEARCH_DIRS[@]}"; do
    if [ -d "$dir" ]; then
      # Use grep with exclusions
      matches=$(grep -RIn $EXCLUDE_FLAGS --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.json" -i "$pattern" "$dir" 2>/dev/null || true)
      
      if [ -n "$matches" ]; then
        echo -e "${RED}❌ Found potential SDK usage:${NC}"
        echo "$matches" | while IFS= read -r line; do
          echo "  $line"
        done
        echo "$matches" >> "$MATCHES_FILE"
        FOUND_MATCHES=1
      fi
    fi
  done
done

# Check package.json files for SDK dependencies
echo "📦 Checking package.json files for SDK dependencies..."
PACKAGE_FILES=("apps/api/package.json" "apps/ui/package.json" "package.json")
for pkg_file in "${PACKAGE_FILES[@]}"; do
  if [ -f "$pkg_file" ]; then
    if grep -qi "aws-sdk\|@aws-sdk\|minio" "$pkg_file" 2>/dev/null; then
      echo -e "${RED}❌ Found SDK dependency in $pkg_file:${NC}"
      grep -i "aws-sdk\|@aws-sdk\|minio" "$pkg_file" | grep -v "^//" | grep -v "^#" || true
      FOUND_MATCHES=1
    fi
  fi
done

# Cleanup
rm -f "$MATCHES_FILE"

# Final result
echo ""
if [ $FOUND_MATCHES -eq 0 ]; then
  echo -e "${GREEN}✅ Verification passed: No S3 SDK usage found in source code${NC}"
  echo ""
  echo "Our S3 backend uses only:"
  echo "  - Native fetch() API (Node.js 20+)"
  echo "  - Manual AWS Signature V4 implementation"
  echo "  - Raw HTTP requests (no SDK)"
  exit 0
else
  echo -e "${RED}❌ Verification failed: Found S3 SDK usage in source code${NC}"
  echo ""
  echo "Please remove any aws-sdk/@aws-sdk/minio imports and use raw HTTP instead."
  exit 1
fi
