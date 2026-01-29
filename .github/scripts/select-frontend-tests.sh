#!/bin/bash
#
# Frontend Test Selection Script
# Analyzes changed files and determines which tests to run.
#
# Outputs (via GITHUB_OUTPUT):
#   skip_tests: "true" if no tests should run
#   run_all: "true" if all tests should run
#   cypress_specs: comma-separated list of Cypress spec patterns (or empty)
#   codecept_tests: comma-separated list of CodeceptJS test patterns (or empty)
#

set -euo pipefail

# Get base branch for comparison (default to develop)
BASE_BRANCH="${BASE_BRANCH:-origin/develop}"

# Get changed files relative to base branch
echo "Comparing against: $BASE_BRANCH"
CHANGED_FILES=$(git diff --name-only "$BASE_BRANCH"...HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD)

echo "Changed files:"
echo "$CHANGED_FILES"
echo "---"

# Filter to only web/ directory changes
WEB_CHANGES=$(echo "$CHANGED_FILES" | grep "^web/" || true)

if [ -z "$WEB_CHANGES" ]; then
    echo "No web/ changes detected - skipping all frontend tests"
    echo "skip_tests=true" >> "$GITHUB_OUTPUT"
    echo "run_all=false" >> "$GITHUB_OUTPUT"
    echo "cypress_specs=" >> "$GITHUB_OUTPUT"
    echo "codecept_tests=" >> "$GITHUB_OUTPUT"
    exit 0
fi

echo "Web changes detected:"
echo "$WEB_CHANGES"
echo "---"

# =============================================================================
# TIER 1: Files that NEVER need tests (skip if ALL changes match these)
# =============================================================================

tier1_skip_patterns() {
    local file="$1"
    
    # Styles - NEVER need functional tests
    if [[ "$file" =~ \.(scss|css|less|sass)$ ]]; then
        return 0
    fi
    
    # Documentation
    if [[ "$file" =~ \.(md|txt)$ ]] || [[ "$file" =~ LICENSE ]]; then
        return 0
    fi
    
    # CI/GitHub configs (but not the test workflows themselves)
    if [[ "$file" =~ ^web/\.github/ ]] || [[ "$file" =~ ^\.github/ ]]; then
        return 0
    fi
    
    # Editor settings
    if [[ "$file" =~ ^web/\.vscode/ ]] || [[ "$file" =~ ^web/\.cursor/ ]]; then
        return 0
    fi
    
    # Type declarations only (no runtime effect)
    if [[ "$file" =~ \.d\.ts$ ]]; then
        return 0
    fi
    
    # Test files themselves (don't trigger OTHER tests)
    if [[ "$file" =~ /__tests__/ ]] || [[ "$file" =~ \.test\.(js|ts|tsx)$ ]] || [[ "$file" =~ \.spec\.(js|ts|tsx)$ ]]; then
        return 0
    fi
    
    # Cypress test files
    if [[ "$file" =~ \.cy\.(js|ts)$ ]]; then
        return 0
    fi
    
    # E2E test files
    if [[ "$file" =~ tests/e2e/tests/ ]]; then
        return 0
    fi
    
    # Examples and storybook
    if [[ "$file" =~ /examples/ ]] || [[ "$file" =~ \.stories\.(js|ts|tsx)$ ]] || [[ "$file" =~ /\.storybook/ ]]; then
        return 0
    fi
    
    # Media/assets
    if [[ "$file" =~ \.(png|jpg|jpeg|gif|svg|ico|mp3|mp4|webm|woff|woff2|ttf|eot)$ ]]; then
        return 0
    fi
    
    # JSON data files (but NOT package.json or tsconfig)
    if [[ "$file" =~ \.json$ ]] && [[ ! "$file" =~ package\.json$ ]] && [[ ! "$file" =~ tsconfig.*\.json$ ]]; then
        return 0
    fi
    
    # YAML/YML configs
    if [[ "$file" =~ \.(yml|yaml)$ ]]; then
        return 0
    fi
    
    return 1
}

# =============================================================================
# TIER 2: Files that need ALL tests (run all if ANY match)
# =============================================================================

tier2_all_tests_patterns() {
    local file="$1"
    
    # Core source code
    if [[ "$file" =~ web/libs/editor/src/core/ ]]; then
        return 0
    fi
    if [[ "$file" =~ web/libs/editor/src/stores/ ]]; then
        return 0
    fi
    if [[ "$file" =~ web/libs/editor/src/mixins/ ]]; then
        return 0
    fi
    
    # Entry points
    if [[ "$file" == "web/libs/editor/src/LabelStudio.tsx" ]]; then
        return 0
    fi
    if [[ "$file" == "web/libs/editor/src/index.js" ]]; then
        return 0
    fi
    if [[ "$file" == "web/libs/editor/src/Component.jsx" ]]; then
        return 0
    fi
    if [[ "$file" == "web/libs/editor/src/configureStore.js" ]]; then
        return 0
    fi
    
    # Shared libraries that affect editor
    if [[ "$file" =~ web/libs/core/src/ ]]; then
        return 0
    fi
    if [[ "$file" =~ web/libs/ui/src/ ]]; then
        return 0
    fi
    
    # Critical config files
    if [[ "$file" == "web/package.json" ]]; then
        return 0
    fi
    if [[ "$file" == "web/yarn.lock" ]]; then
        return 0
    fi
    if [[ "$file" =~ web/tsconfig.*\.json$ ]]; then
        return 0
    fi
    if [[ "$file" == "web/webpack.config.js" ]]; then
        return 0
    fi
    if [[ "$file" == "web/babel.config.json" ]]; then
        return 0
    fi
    if [[ "$file" =~ web/libs/editor/\.babelrc ]]; then
        return 0
    fi
    
    return 1
}

# =============================================================================
# TIER 3: Feature-specific test mapping
# =============================================================================

# Maps source patterns to Cypress test directories
get_cypress_specs() {
    local file="$1"
    local specs=""
    
    # Audio
    if [[ "$file" =~ AudioUltra ]] || [[ "$file" =~ tags/object/Audio ]]; then
        specs="$specs,audio/**,sync/**"
    fi
    
    # Video
    if [[ "$file" =~ VideoCanvas ]] || [[ "$file" =~ tags/object/Video ]]; then
        specs="$specs,video/**"
    fi
    
    # Image segmentation
    if [[ "$file" =~ tags/object/Image ]] || [[ "$file" =~ /tools/ ]] || [[ "$file" =~ regions/.*Region ]]; then
        specs="$specs,image_segmentation/**"
    fi
    
    # NER/Text
    if [[ "$file" =~ tags/object/RichText ]] || [[ "$file" =~ tags/object/Text ]]; then
        specs="$specs,ner/**"
    fi
    
    # Paragraphs
    if [[ "$file" =~ tags/object/Paragraphs ]]; then
        specs="$specs,sync/**,audio/**"
    fi
    
    # TimeSeries
    if [[ "$file" =~ tags/object/TimeSeries ]]; then
        specs="$specs,timeseries/**"
    fi
    
    # Taxonomy
    if [[ "$file" =~ tags/control/Taxonomy ]] || [[ "$file" =~ components/Taxonomy ]]; then
        specs="$specs,control_tags/taxonomy*"
    fi
    
    # Choices
    if [[ "$file" =~ tags/control/Choices ]]; then
        specs="$specs,control_tags/choice*,control_tags/classification/**"
    fi
    
    # TextArea
    if [[ "$file" =~ tags/control/TextArea ]]; then
        specs="$specs,control_tags/textarea*"
    fi
    
    # Outliner
    if [[ "$file" =~ SidePanels/OutlinerPanel ]]; then
        specs="$specs,outliner/**,relations/**"
    fi
    
    # Visual tags
    if [[ "$file" =~ tags/visual ]]; then
        specs="$specs,visual_tags/**,view_all/**"
    fi
    
    # Core/labels
    if [[ "$file" =~ /labels/ ]] || [[ "$file" =~ BottomBar ]] || [[ "$file" =~ TopBar ]]; then
        specs="$specs,core/**,labels/**"
    fi
    
    # Relations
    if [[ "$file" =~ /relations/ ]] || [[ "$file" =~ LinkingMode ]]; then
        specs="$specs,relations/**"
    fi
    
    # Remove leading comma
    echo "${specs#,}"
}

# Maps source patterns to CodeceptJS test files
get_codecept_tests() {
    local file="$1"
    local tests=""
    
    # Audio
    if [[ "$file" =~ AudioUltra ]] || [[ "$file" =~ tags/object/Audio ]]; then
        tests="$tests,audio/**,sync/**"
    fi
    
    # Video
    if [[ "$file" =~ VideoCanvas ]] || [[ "$file" =~ tags/object/Video ]]; then
        tests="$tests,regression-tests/video*.test.js"
    fi
    
    # Image
    if [[ "$file" =~ tags/object/Image ]] || [[ "$file" =~ /tools/ ]] || [[ "$file" =~ regions/.*Region ]]; then
        tests="$tests,image*.test.js,regression-tests/image*.test.js"
    fi
    
    # NER/RichText
    if [[ "$file" =~ tags/object/RichText ]] || [[ "$file" =~ tags/object/Text ]]; then
        tests="$tests,ner*.test.js,rich-text/**"
    fi
    
    # Paragraphs
    if [[ "$file" =~ tags/object/Paragraphs ]]; then
        tests="$tests,paragraphs*.test.js"
    fi
    
    # TimeSeries
    if [[ "$file" =~ tags/object/TimeSeries ]]; then
        tests="$tests,timeseries.test.js"
    fi
    
    # Taxonomy
    if [[ "$file" =~ tags/control/Taxonomy ]] || [[ "$file" =~ components/Taxonomy ]]; then
        tests="$tests,taxonomy.test.js"
    fi
    
    # Choices
    if [[ "$file" =~ tags/control/Choices ]]; then
        tests="$tests,nested-choices.test.js"
    fi
    
    # TextArea
    if [[ "$file" =~ tags/control/TextArea ]]; then
        tests="$tests,text-area.test.js,textarea*.test.js"
    fi
    
    # Outliner
    if [[ "$file" =~ SidePanels/OutlinerPanel ]]; then
        tests="$tests,outliner.test.js"
    fi
    
    # Visual tags
    if [[ "$file" =~ tags/visual ]]; then
        tests="$tests,visual-tags.test.js"
    fi
    
    # Remove leading comma
    echo "${tests#,}"
}

# =============================================================================
# Main logic
# =============================================================================

SKIP_COUNT=0
TIER2_MATCH=false
CYPRESS_SPECS=""
CODECEPT_TESTS=""

# Check each changed file
while IFS= read -r file; do
    [ -z "$file" ] && continue
    
    # Check Tier 1 (skip)
    if tier1_skip_patterns "$file"; then
        echo "TIER1 (skip): $file"
        SKIP_COUNT=$((SKIP_COUNT + 1))
        continue
    fi
    
    # Check Tier 2 (all tests)
    if tier2_all_tests_patterns "$file"; then
        echo "TIER2 (all tests): $file"
        TIER2_MATCH=true
        break  # No need to check further
    fi
    
    # Tier 3 (specific tests)
    echo "TIER3 (mapping): $file"
    
    specs=$(get_cypress_specs "$file")
    if [ -n "$specs" ]; then
        CYPRESS_SPECS="$CYPRESS_SPECS,$specs"
    fi
    
    tests=$(get_codecept_tests "$file")
    if [ -n "$tests" ]; then
        CODECEPT_TESTS="$CODECEPT_TESTS,$tests"
    fi
    
done <<< "$WEB_CHANGES"

# Determine final output
TOTAL_WEB_FILES=$(echo "$WEB_CHANGES" | grep -c "." || echo 0)

echo "---"
echo "Summary:"
echo "  Total web files: $TOTAL_WEB_FILES"
echo "  Tier 1 skip: $SKIP_COUNT"
echo "  Tier 2 match: $TIER2_MATCH"

# Case 1: All files are Tier 1 (skip all tests)
if [ "$SKIP_COUNT" -eq "$TOTAL_WEB_FILES" ] && [ "$TOTAL_WEB_FILES" -gt 0 ]; then
    echo "All changes are Tier 1 - skipping all frontend tests"
    echo "skip_tests=true" >> "$GITHUB_OUTPUT"
    echo "run_all=false" >> "$GITHUB_OUTPUT"
    echo "cypress_specs=" >> "$GITHUB_OUTPUT"
    echo "codecept_tests=" >> "$GITHUB_OUTPUT"
    exit 0
fi

# Case 2: Any Tier 2 match (run all tests)
if [ "$TIER2_MATCH" = true ]; then
    echo "Tier 2 match found - running all frontend tests"
    echo "skip_tests=false" >> "$GITHUB_OUTPUT"
    echo "run_all=true" >> "$GITHUB_OUTPUT"
    echo "cypress_specs=" >> "$GITHUB_OUTPUT"
    echo "codecept_tests=" >> "$GITHUB_OUTPUT"
    exit 0
fi

# Case 3: Specific tests from Tier 3 mapping
# Deduplicate specs
CYPRESS_SPECS=$(echo "$CYPRESS_SPECS" | tr ',' '\n' | sort -u | grep -v "^$" | tr '\n' ',' | sed 's/,$//')
CODECEPT_TESTS=$(echo "$CODECEPT_TESTS" | tr ',' '\n' | sort -u | grep -v "^$" | tr '\n' ',' | sed 's/,$//')

if [ -n "$CYPRESS_SPECS" ] || [ -n "$CODECEPT_TESTS" ]; then
    echo "Targeted tests determined:"
    echo "  Cypress: $CYPRESS_SPECS"
    echo "  CodeceptJS: $CODECEPT_TESTS"
    echo "skip_tests=false" >> "$GITHUB_OUTPUT"
    echo "run_all=false" >> "$GITHUB_OUTPUT"
    echo "cypress_specs=$CYPRESS_SPECS" >> "$GITHUB_OUTPUT"
    echo "codecept_tests=$CODECEPT_TESTS" >> "$GITHUB_OUTPUT"
    exit 0
fi

# Case 4: Fallback to smoke tests (unknown code changes)
echo "No specific mapping found - running smoke tests only"
echo "skip_tests=false" >> "$GITHUB_OUTPUT"
echo "run_all=false" >> "$GITHUB_OUTPUT"
echo "cypress_specs=core/**,view_all/smoke.cy.ts" >> "$GITHUB_OUTPUT"
echo "codecept_tests=smoke.test.js" >> "$GITHUB_OUTPUT"
