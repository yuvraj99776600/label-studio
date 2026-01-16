# Label Studio Enterprise BEM Migration Prompt

## Context

You are migrating **Label Studio Enterprise (LSE)** from legacy `BemWithSpecifiContext()` wrappers (`<Block/>`, `<Elem/>`) to the modern `cn()` helper function.

**Current Status:**
- ✅ Open Source dependencies migrated:
  - `@humansignal/editor` library - Complete
  - `@humansignal/datamanager` library - Complete
  - `@humansignal/core` - BEM utilities available via `cn()` export
- 🎯 **Now migrating:** Label Studio Enterprise application
  - **140 files** in LSE still using Block/Elem
  - Located in: `/Users/raulmartin/Code/label-studio-enterprise/web/apps/labelstudio/src/`

**Working directory:** `/Users/raulmartin/Code/label-studio-enterprise/web/`

**Key Architecture Note:**
- LSE imports BEM utilities from `@humansignal/core/lib/utils/bem`
- The `bem.tsx` file in LSE is just a re-export wrapper
- All actual BEM logic lives in the core package

---

## 📋 TL;DR - Essential Rules

**For Migrators:**
1. **One file per commit** - Makes review easy
2. **Use this transform:** `<Block name="x">` → `<div className={cn("x").toClassName()}>`
3. **Use this transform:** `<Elem name="y">` → `<div className={cn("parent").elem("y").toClassName()}>`
4. **Chain order:** `cn(block).elem(elem).mod(mod).mix(mix).toClassName()` - NEVER change!
5. **Always end with** `.toClassName()` - NEVER forget!
6. **Test before committing** - Linter + Build must pass
7. **Detailed commit message** - Include testing checklist

**For Reviewers:**
1. Check commit message has component details + testing checklist
2. Verify imports changed: `Block, Elem` → `cn`
3. Verify chain order: elem → mod → mix → toClassName
4. Verify `.toClassName()` present everywhere
5. Verify props preserved (ref, handlers, etc.)
6. Check only one file changed (or small logical group)

**Quick Check:** If you see `cn(` in the code, it must end with `.toClassName()` - no exceptions!

---

## 🎯 Quick Start: Review-Friendly Migration

**Key Principles for Easy Review:**

| Principle | Rule | Why |
|-----------|------|-----|
| **Commit Size** | One file per commit | Easy to review changes in isolation |
| **Commit Message** | Descriptive format with testing checklist | Reviewer knows what changed and it's tested |
| **Testing** | Test after every commit | Catch issues early, never break build |
| **Atomic Changes** | Each commit can stand alone | Can be reverted independently |
| **Consistent Patterns** | Same transformation approach everywhere | Predictable, easy to verify |
| **Progress Tracking** | Maintain checklist of migrations | Reviewers see the big picture |

**For Reviewers:** Each commit should:
- ✅ Migrate exactly one file (or small logical group)
- ✅ Include detailed commit message with component info
- ✅ Pass linter and build
- ✅ Preserve all functionality
- ✅ Generate same CSS classes as before

**See detailed [Commit Strategy](#-commit-strategy-for-easy-review) below.**

---

## LSE-Specific File Structure

### Files to Migrate (140 total)

**Enterprise-specific components** (`components_lse/` - 18 files):
- Drawer, CandidateTaskView, SemanticSearch
- Userpics, StreamModal, UserAssigner, UsersList
- Warning, UserInfo, DatasetsExportToProject/*
- Billing/TrialIndicator, InfiniteList
- DatasetsConfigurationUI/*

**Shared components** (`components/` - 41 files):
- MultiTreeSelect/*, Pagination, Form/*
- SidebarMenu, TrialComponents/*
- Menubar/Notifications, Charts/*
- Slider, Message, ProjectMenu
- Search, Ribbon, ProgressRing, GroupByTimePicker

**Pages** (`pages/` - 81 files):
- Analytics/*, BillingPage/*, CreateProject/*
- DataExplorer/*, DataManager/*, Datasets/*
- Organization/*, Projects/*, Settings/*
- And many more...

---

## ⚠️ CRITICAL LSE-SPECIFIC RULES

### 1. Check Open Source Dependencies

**BEFORE migrating any component**, verify if it's similar to an open source component:

```bash
# Check if component exists in open source
cd /Users/raulmartin/Code/label-studio/web
find . -name "ComponentName.*" ! -path "*/node_modules/*"

# If it exists, check if it was already migrated
grep -r "cn(" apps/labelstudio/src/components/ComponentName/
```

**Decision matrix:**
| Open Source Status | LSE Action |
|-------------------|------------|
| Component doesn't exist in OS | ✅ Migrate independently |
| Component exists, not migrated in OS | ⚠️ Consider migrating OS first |
| Component exists, migrated in OS | ✅ Use OS migration as reference |
| LSE extends OS component | ⚠️ Careful - ensure compatibility |

### 2. LSE BEM Import Structure

**Current import pattern:**
```tsx
// LSE imports from local bem.tsx wrapper
import { Block, Elem } from "../../utils/bem";
```

**After migration:**
```tsx
// Still import from local wrapper (it re-exports cn from @humansignal/core)
import { cn } from "../../utils/bem";
```

**Note:** The `bem.tsx` file in LSE is at:
- `/Users/raulmartin/Code/label-studio-enterprise/web/apps/labelstudio/src/utils/bem.tsx`
- It re-exports from `@humansignal/core/lib/utils/bem`
- Keep using the local import path (don't import directly from @humansignal/core)

### 3. Enterprise-Only Components

Components in `components_lse/` are **LSE-exclusive**:
- No open source dependencies to worry about
- Safe to migrate independently
- Prioritize these for early migration

### 4. Shared Component Considerations

Components in `components/` may have open source equivalents:
- Check if OS has the same component
- If yes, verify OS migration status
- Use OS migration as a reference/template
- Ensure LSE-specific features are preserved

---

## 📝 Commit Strategy for Easy Review

**Goal:** Make every commit easy to review in isolation, allowing reviewers to understand changes quickly and catch issues early.

### Commit Size Guidelines

**✅ PREFERRED: One file per commit**
```bash
# Migrate one file at a time
git add apps/labelstudio/src/components_lse/Drawer/Drawer.tsx
git commit -m "refactor(bem): migrate Drawer component to cn() helper"
```

**✅ ACCEPTABLE: Logically related small files**
```bash
# Group only if files are tightly coupled (e.g., index + component in same folder)
git add apps/labelstudio/src/components/Form/FormRow.tsx
git add apps/labelstudio/src/components/Form/FormActions.tsx
git commit -m "refactor(bem): migrate Form row and actions to cn() helper"
```

**❌ AVOID: Multiple unrelated files**
```bash
# DON'T mix different components
git add apps/labelstudio/src/components/Drawer/*
git add apps/labelstudio/src/components/Modal/*
git commit -m "refactor(bem): migrate multiple components"  # Too broad!
```

### Commit Message Format

**Use consistent, descriptive commit messages:**

```
refactor(bem): migrate [ComponentName] to cn() helper

- Component: [ComponentName] ([path/to/file])
- Blocks migrated: [block-name-1, block-name-2]
- Elements count: [N elem transforms]
- Special handling: [if any: dynamic tags, complex nesting, etc.]

Testing:
- ✓ Linter passes
- ✓ Build succeeds
- ✓ Component renders correctly
- ✓ CSS classes match previous structure
```

**Examples:**

```
refactor(bem): migrate Drawer component to cn() helper

- Component: Drawer (components_lse/Drawer/Drawer.tsx)
- Blocks migrated: drawer
- Elements count: 3 (overlay, content, close-button)
- Special handling: Dynamic visible/size modifiers

Testing:
- ✓ Linter passes
- ✓ Build succeeds
- ✓ Drawer opens/closes correctly
- ✓ CSS classes match previous structure
```

```
refactor(bem): migrate Pagination component to cn() helper

- Component: Pagination (components/Pagination/Pagination.tsx)
- Blocks migrated: pagination
- Elements count: 5 (button, info, select, prev, next)
- Special handling: Button elements with type="button" added

Testing:
- ✓ Linter passes
- ✓ Build succeeds
- ✓ Pagination controls work
- ✓ CSS classes match previous structure
```

### Commit Workflow (Per File)

**Follow this workflow for each file migration:**

```bash
# 1. Ensure clean working directory
git status  # Should be clean

# 2. Create feature branch (if not already on one)
git checkout -b bem-migration/lse-components

# 3. Migrate ONE file (following transformation rules)
# ... edit the file ...

# 4. Verify the migration
yarn biome check apps/labelstudio/src/path/to/Component.tsx --diagnostic-level=error

# 5. Test that it builds
yarn build

# 6. Stage ONLY the migrated file
git add apps/labelstudio/src/path/to/Component.tsx

# 7. Review your changes before committing
git diff --staged

# 8. Commit with descriptive message
git commit -m "refactor(bem): migrate ComponentName to cn() helper

- Component: ComponentName (path/to/Component.tsx)
- Blocks migrated: component-name
- Elements count: 3
- Special handling: None

Testing:
- ✓ Linter passes
- ✓ Build succeeds
- ✓ Component renders correctly
- ✓ CSS classes match previous structure"

# 9. Move to next file
# Repeat steps 3-8 for next component
```

### Review-Friendly Practices

#### 1. Atomic Commits
- Each commit should be self-contained
- Should not break the build
- Should not break tests
- Can be reverted independently

#### 2. Descriptive Commit Bodies
Include in commit message:
- Component name and path
- Number of Block/Elem transforms
- Any special cases handled (dynamic tags, complex nesting, etc.)
- Testing checklist

#### 3. Consistent Patterns
- Same transformation patterns across all files
- Same commit message format
- Same testing approach

#### 4. Group by Logical Units
When grouping multiple files (use sparingly):
- **Related components** in same folder
- **Small utility files** that are used together
- **Page components** with their sub-components

**Example of acceptable grouping:**
```bash
# FormRow and FormActions are tightly coupled
git add apps/labelstudio/src/components/Form/FormRow.tsx
git add apps/labelstudio/src/components/Form/FormActions.tsx
git commit -m "refactor(bem): migrate Form row and actions components

- Components: FormRow, FormActions
- Path: components/Form/
- Blocks migrated: form-row, form-actions
- Elements: 2 (row content, action buttons)

Testing:
- ✓ Linter passes
- ✓ Build succeeds
- ✓ Form components render correctly"
```

### Progress Tracking for Reviewers

**Create a tracking issue/PR description:**

```markdown
## BEM Migration Progress - LSE

### Overview
Migrating 140 files from Block/Elem to cn() helper

### Progress
- [x] Enterprise Components (18/18) ✅
  - [x] Drawer - #PR-001
  - [x] CandidateTaskView - #PR-002
  - [x] SemanticSearch - #PR-003
  - ... (list all)

- [ ] Shared Components (15/41)
  - [x] Pagination - #PR-019
  - [x] Message - #PR-020
  - [ ] MultiTreeSelect - In Progress
  - ... (list all)

- [ ] Pages (0/81)
  - [ ] Analytics - Not started
  - ... (list all)

### Commits
Each component migrated in individual commit for easy review.

### Testing
All commits:
- ✓ Pass linter
- ✓ Build successfully
- ✓ Generate same CSS classes
- ✓ Preserve all functionality
```

### PR Strategy Options

**Option 1: Single PR with many commits (Recommended for small teams)**
```bash
# Create one branch with all migrations
git checkout -b bem-migration/lse-all-components

# Commit each file individually
# ... 140 commits ...

# Push all at once
git push origin bem-migration/lse-all-components

# Create PR with detailed description and commit list
```

**Pros:** 
- Easy to track overall progress
- Can review commits one by one
- Single PR to manage

**Cons:**
- Large PR may be intimidating
- Potential merge conflicts if taking long

**Option 2: Multiple PRs by category (Recommended for large teams)**
```bash
# Create separate PRs for each category
git checkout -b bem-migration/lse-components-enterprise
# ... migrate 18 enterprise components ...
git push && create PR #1

git checkout main
git checkout -b bem-migration/lse-components-shared
# ... migrate 41 shared components ...
git push && create PR #2

git checkout main
git checkout -b bem-migration/lse-pages
# ... migrate 81 pages ...
git push && create PR #3
```

**Pros:**
- Smaller, manageable PRs
- Can merge incrementally
- Easier to review in chunks
- Less merge conflict risk

**Cons:**
- More PRs to manage
- Need to coordinate order

**Option 3: Hybrid - PRs by logical groups**
```bash
# Group by feature area
bem-migration/lse-billing-components     # Billing-related components
bem-migration/lse-datasets-components    # Dataset-related components
bem-migration/lse-analytics-pages        # Analytics pages
bem-migration/lse-organization-pages     # Organization pages
# etc.
```

### Review Checklist for Each Commit

Reviewers should verify:

**Code Changes:**
- [ ] Block → div/appropriate tag with cn()
- [ ] Elem → div/appropriate tag with cn().elem()
- [ ] Chain order correct: elem → mod → mix → toClassName
- [ ] toClassName() always present
- [ ] Parent block names correct for all Elems
- [ ] Dynamic tags use createElement if needed
- [ ] Component tags pass className prop

**Imports:**
- [ ] Removed Block, Elem imports
- [ ] Added cn import
- [ ] Import path correct (../../utils/bem)
- [ ] Added createElement if using dynamic tags

**Props & Behavior:**
- [ ] All props preserved (ref, handlers, etc.)
- [ ] Button elements have type="button"
- [ ] No TypeScript syntax in .jsx files
- [ ] Mods, mixes preserved correctly

**Testing:**
- [ ] Commit message includes testing checklist
- [ ] Build succeeds
- [ ] Linter passes
- [ ] No new console errors

### Quick Review Commands

```bash
# Review a specific commit
git show <commit-hash>

# Review changes to specific file across commits
git log -p -- apps/labelstudio/src/components/Drawer/Drawer.tsx

# See all BEM migration commits
git log --grep="refactor(bem)"

# Review diff for specific commit with context
git show <commit-hash> --unified=10

# Check if any Block/Elem remain in a file
git show <commit-hash>:apps/labelstudio/src/path/to/file.tsx | grep -E "Block|Elem"

# Verify commit doesn't break build
git checkout <commit-hash>
yarn build
```

### Handling Review Feedback

**If changes requested on a specific commit:**

```bash
# Option 1: Amend the specific commit (if not pushed)
git rebase -i <parent-commit>
# Mark commit as 'edit'
# Make changes
git add .
git commit --amend
git rebase --continue

# Option 2: Create fixup commit (if already pushed)
git commit --fixup=<commit-hash>
git rebase -i --autosquash <parent-commit>

# Option 3: Add follow-up commit (simplest)
git commit -m "fix(bem): address review feedback for Drawer component"
```

### Summary: Keys to Easy Review

1. **One file per commit** (or very small logical groups)
2. **Descriptive commit messages** with testing checklist
3. **Consistent patterns** across all migrations
4. **Atomic commits** that don't break the build
5. **Clear PR structure** (single large PR or multiple categorized PRs)
6. **Progress tracking** so reviewers know what to expect
7. **Test after each commit** to catch issues early

---

## Core Transformation Rules

### Block Transformation

```jsx
// Before
<Block name="pagination" mod={{ size }} mix={className} ref={ref} {...props}>
  {children}
</Block>

// After
<div className={cn("pagination").mod({ size }).mix(className).toClassName()} ref={ref} {...props}>
  {children}
</div>
```

### Elem Transformation

```jsx
// Before
<Elem name="button" mod={{ active }} mix={extraClass} />

// After
<div className={cn("parent-block").elem("button").mod({ active }).mix(extraClass).toClassName()} />
```

**Critical:** `"parent-block"` = the name from the nearest parent `<Block name="parent-block">`

### Dynamic Tags

```jsx
// Before
<Block tag={finalTag} name="button">

// After
import { createElement } from "react";

createElement(finalTag, {
  className: cn("button").toClassName(),
  ...props
}, children)
```

### Component Tags

```jsx
// Before
<Elem tag={Userpic} name="pic" mod={{ active }} user={user} />

// After
<Userpic className={cn("parent-block").elem("pic").mod({ active }).toClassName()} user={user} />
```

---

## ⚠️ CRITICAL Rules

### 1. Elem WITHOUT name Prop

```jsx
// Before
<Elem mod={{ active }}>Content</Elem>  // NO name prop!

// After - NO .elem()!
{/* NOTE: Original Elem had no name prop - using parent block class directly */}
<div className={cn("parent-block").mod({ active }).toClassName()}>Content</div>
```

### 2. Sacred Chain Order

**NEVER change this order:**
```javascript
cn(block)
  .elem(elem)      // Only if Elem has name prop
  .mod(mod)
  .mix(mix)
  .toClassName()   // Always required!
```

### 3. TypeScript Syntax in .jsx Files

**DON'T use `as any` in `.jsx` files - causes JSDoc errors!**

```jsx
// Wrong (.jsx file)
<div ref={myRef as any}>

// Correct (.jsx file)
<div ref={myRef}>

// OK in .tsx files
<div ref={myRef as any}>
```

### 4. Button Elements Need type="button"

```jsx
// Before
<Elem tag="button" name="btn" onClick={handler}>

// After - Add type="button"!
<button type="button" className={cn("parent").elem("btn").toClassName()} onClick={handler}>
```

### 5. Nested Blocks Create New Scope

```jsx
// Before
<Block name="outer">
  <Elem name="item" />        // Uses "outer"
  <Block name="inner">
    <Elem name="item" />      // Uses "inner" - NEW SCOPE!
  </Block>
</Block>

// After
<div className={cn("outer").toClassName()}>
  <div className={cn("outer").elem("item").toClassName()} />
  <div className={cn("inner").toClassName()}>
    <div className={cn("inner").elem("item").toClassName()} />  {/* Different block! */}
  </div>
</div>
```

### 6. ⚠️ NEVER Use .mix() with Raw Utility Classes

**The `.mix()` method is ONLY for mixing BEM classes, NOT raw utility classes!**

```jsx
// ❌ WRONG - DON'T pass raw utility classes to .mix()
<div className={cn("progressBar").elem("text").mix("flex gap-1 align-center").toClassName()}>

// ✅ CORRECT - Use template literals for utility classes
<div className={`${cn("progressBar").elem("text").toClassName()} flex gap-1 align-center`}>

// ✅ CORRECT - .mix() is fine for BEM classes or className props
<div className={cn("button").mix(externalClassName).toClassName()}>
<div className={cn("button").mix("some-bem-class").toClassName()}>
```

**Why:** `.mix()` is designed to add BEM classes (like other block names or external className props). Raw utility classes (Tailwind-style: `flex`, `gap-1`, `align-center`) should be concatenated using template literals.

**Detection:** If you see `.mix()` with space-separated classes that look like utilities (flex, gap-, items-, justify-, etc.), it's wrong!

---

## Import Changes

**Remove:**
```jsx
import { Block, Elem } from "../../utils/bem";
// or
import { BemWithSpecifiContext } from "../../utils/bem";
const { Block, Elem } = BemWithSpecifiContext();
```

**Add:**
```jsx
import { cn } from "../../utils/bem";
```

**Keep if needed:**
- `CNTagName` - for dynamic tag types
- `BemComponent` - for component type definitions
- Add `createElement` from "react" if using dynamic tags

---

## Skip Rules (Conservative)

**SKIP a file if:**

1. **Dynamic Block/Elem names:**
   ```jsx
   <Block name={variableName} />  // ❌ SKIP
   <Elem name={dynamicName} />    // ❌ SKIP
   ```

2. **Cross-file Elem overlaps:**
   If same Elem name appears under different Block names in different files → SKIP both files

3. **Cannot prove uniqueness:** When in doubt, SKIP

4. **Component accepts children AND those children use Block/Elem:** SKIP until children are migrated

5. **Complex BemWithSpecifiContext usage:** If component creates custom BEM contexts, coordinate with team

---

## Step-by-Step Migration Process

### Phase 0: Discovery & Planning

```bash
# 1. Find all files to migrate in LSE
cd /Users/raulmartin/Code/label-studio-enterprise/web
grep -r "import.*Block.*bem\|import.*Elem.*bem" apps/labelstudio/src/ \
  --include="*.tsx" --include="*.jsx" -l | sort > lse-migration-files.txt

# 2. Categorize by directory
echo "=== Enterprise-specific components ===" > lse-migration-plan.txt
grep "components_lse" lse-migration-files.txt >> lse-migration-plan.txt

echo "=== Shared components ===" >> lse-migration-plan.txt
grep "components/" lse-migration-files.txt | grep -v "components_lse" >> lse-migration-plan.txt

echo "=== Pages ===" >> lse-migration-plan.txt
grep "pages/" lse-migration-files.txt >> lse-migration-plan.txt

# 3. Check for open source equivalents
cd /Users/raulmartin/Code/label-studio/web
# For each component, check if it exists in OS
```

### Phase 1: Migrate Enterprise-Specific Components (18 files)

**Priority:** Start with `components_lse/` - these are LSE-exclusive

Components to migrate:
- Drawer, CandidateTaskView, SemanticSearch
- Userpics, StreamModal, UserAssigner
- UsersList, Warning, UserInfo
- DatasetsExportToProject/*, Billing/TrialIndicator
- InfiniteList, DatasetsConfigurationUI/*

**Why start here:**
- No open source dependencies
- Self-contained
- Lower risk of breaking changes

### Phase 2: Migrate Shared Components (41 files)

**Check open source first** for each component:
- MultiTreeSelect/*, Pagination, Form/*
- SidebarMenu, Charts/*, Menubar/*
- Slider, Message, ProjectMenu, etc.

**Strategy:**
1. Check if component exists in OS
2. If yes, check OS migration status
3. Use OS migration as template
4. Migrate LSE-specific features

### Phase 3: Migrate Pages (81 files)

**Large surface area** - break down by page group:
- Analytics/* (high priority - data visualization)
- Organization/* (largest group - 209 files)
- Projects/*, Settings/*
- BillingPage/*, CreateProject/*
- DataManager/*, Datasets/*

**Strategy:**
1. Start with smaller page groups
2. Migrate page components bottom-up
3. Test each page after migration

### Phase 4: Update Tests & Cleanup

- Update test mocks
- Verify all imports
- Run linters
- Build and test

---

## For Each File Migration:

**Follow this checklist for every file** (see detailed [Commit Workflow](#commit-workflow-per-file) above):

1. **Pre-checks:**
   ```bash
   # Ensure clean working directory
   git status
   
   # Check if component exists in OS
   cd /Users/raulmartin/Code/label-studio/web
   find . -name "ComponentName.*" ! -path "*/node_modules/*"
   
   # Check children usage
   cd /Users/raulmartin/Code/label-studio-enterprise/web
   grep -A 20 "ComponentName" apps/labelstudio/src/**/*.{jsx,tsx} | grep -E "<Elem|<Block"
   ```

2. **Read the file:**
   - Identify all Block and Elem usage
   - Note parent Block names for each Elem
   - Check for dynamic names
   - Check for BemWithSpecifiContext usage
   - Count transforms (for commit message)

3. **Apply transformations:**
   - Update imports (keep using local `../../utils/bem`)
   - Transform Block components
   - Transform Elem components (with correct parent names)
   - Handle dynamic tags with createElement
   - Handle component tags with className props

4. **Verify:**
   - Order: elem → mod → mix → toClassName
   - No TypeScript syntax in .jsx files
   - Button elements have type="button"
   - Refs preserved
   - Handlers preserved
   - All props preserved

5. **Test:**
   ```bash
   # Run linter on this file
   cd /Users/raulmartin/Code/label-studio-enterprise/web
   yarn biome check apps/labelstudio/src/path/to/Component.tsx --diagnostic-level=error
   
   # Build (ensure no breakage)
   yarn build
   
   # Run tests (if applicable)
   yarn test
   ```

6. **Stage and review:**
   ```bash
   # Stage ONLY this file
   git add apps/labelstudio/src/path/to/Component.tsx
   
   # Review your changes
   git diff --staged
   ```

7. **Create individual commit:**
   ```bash
   git commit -m "refactor(bem): migrate ComponentName to cn() helper

   - Component: ComponentName (path/to/Component.tsx)
   - Blocks migrated: component-name
   - Elements count: X
   - Special handling: [None OR describe: dynamic tags, complex nesting, etc.]
   
   Testing:
   - ✓ Linter passes
   - ✓ Build succeeds
   - ✓ Component renders correctly
   - ✓ CSS classes match previous structure"
   ```

8. **Push regularly:**
   ```bash
   # Push after every 5-10 commits to avoid losing work
   git push origin bem-migration/your-branch-name
   ```

9. **Move to next file** and repeat steps 1-8

**Important:** Follow the [Commit Strategy](#-commit-strategy-for-easy-review) guidelines to ensure easy review!

---

## LSE-Specific Testing Checklist

After migrating each component:

- [ ] Component renders without errors
- [ ] CSS classes match previous structure
- [ ] Enterprise features work (billing, RBAC, etc.)
- [ ] No console errors
- [ ] Linter passes
- [ ] Tests pass
- [ ] Build succeeds

**For critical components:**
- [ ] Test in development environment
- [ ] Verify with QA team
- [ ] Check Sentry for errors after deployment

---

## Common LSE Patterns Reference

### Pattern 1: Enterprise Drawer Component

```jsx
// Before
<Block name="drawer" mod={{ visible, size }}>
  <Elem name="overlay" onClick={onClose} />
  <Elem name="content">
    {children}
  </Elem>
</Block>

// After
<div className={cn("drawer").mod({ visible, size }).toClassName()}>
  <div className={cn("drawer").elem("overlay").toClassName()} onClick={onClose} />
  <div className={cn("drawer").elem("content").toClassName()}>
    {children}
  </div>
</div>
```

### Pattern 2: Billing Components with Feature Flags

```jsx
// Before
<Block name="trial-indicator" mod={{ variant }}>
  <Elem name="icon">{icon}</Elem>
  <Elem name="text">{text}</Elem>
</Block>

// After
<div className={cn("trial-indicator").mod({ variant }).toClassName()}>
  <div className={cn("trial-indicator").elem("icon").toClassName()}>{icon}</div>
  <div className={cn("trial-indicator").elem("text").toClassName()}>{text}</div>
</div>
```

### Pattern 3: Organization Pages with Complex Layouts

```jsx
// Before
<Block name="org-settings">
  <Elem name="sidebar">
    <Block name="sidebar-menu">
      <Elem name="item" mod={{ active }}>
    </Block>
  </Elem>
  <Elem name="content">{content}</Elem>
</Block>

// After
<div className={cn("org-settings").toClassName()}>
  <div className={cn("org-settings").elem("sidebar").toClassName()}>
    <div className={cn("sidebar-menu").toClassName()}>
      <div className={cn("sidebar-menu").elem("item").mod({ active }).toClassName()}>
    </div>
  </div>
  <div className={cn("org-settings").elem("content").toClassName()}>{content}</div>
</div>
```

---

## Expected Results

**For Label Studio Enterprise:**
- Files to migrate: **140**
- Enterprise-specific: **18** (components_lse/)
- Shared components: **41** (components/)
- Pages: **81** (pages/)
- Files to skip: Minimize (aim for < 5%)
- Individual commits: One per file (or logical group for small files)
- Breaking changes: **0** (coordinate if needed)
- CSS changes: **0**

---

## Progress Tracking

Create a migration tracker:

```bash
# Track progress
echo "# LSE BEM Migration Progress" > lse-migration-progress.md
echo "" >> lse-migration-progress.md
echo "## Enterprise Components (18 files)" >> lse-migration-progress.md
echo "- [ ] Drawer" >> lse-migration-progress.md
echo "- [ ] CandidateTaskView" >> lse-migration-progress.md
# ... add all components

# Update after each migration
# Mark completed: - [x] ComponentName
```

---

## Rollback Plan

If issues arise:

1. **Per-component rollback:**
   ```bash
   git revert <commit-hash>
   ```

2. **Full rollback:**
   ```bash
   git revert <first-commit>..<last-commit>
   ```

3. **Identify issue:**
   - Check browser console for errors
   - Check CSS class names in DevTools
   - Compare before/after class strings
   - Check component props/behavior
   - Check Sentry for production errors

---

## 👀 Quick Review Guide (For Code Reviewers)

### What to Check in Each Commit

**Use this checklist when reviewing BEM migration commits:**

#### 1. Commit Message Quality ⭐
- [ ] Follows format: `refactor(bem): migrate [ComponentName] to cn() helper`
- [ ] Includes component name and path
- [ ] Lists blocks migrated and element count
- [ ] Notes special handling if any
- [ ] Includes testing checklist

#### 2. Import Changes ⭐
- [ ] ❌ Removed: `import { Block, Elem } from "../../utils/bem"`
- [ ] ❌ Removed: `import { BemWithSpecifiContext } from "../../utils/bem"`
- [ ] ✅ Added: `import { cn } from "../../utils/bem"`
- [ ] ✅ Added: `import { createElement } from "react"` (only if using dynamic tags)
- [ ] Import path is correct (local `../../utils/bem`, not `@humansignal/core`)

#### 3. Block Transformations ⭐
```diff
- <Block name="component-name" mod={{ variant }} mix={className}>
+ <div className={cn("component-name").mod({ variant }).mix(className).toClassName()}>
```

**Check:**
- [ ] Block name preserved in `cn("component-name")`
- [ ] Tag changed to appropriate HTML element (usually `div`)
- [ ] All mods preserved: `.mod({ ... })`
- [ ] All mixes preserved: `.mix(...)`
- [ ] `.toClassName()` is present
- [ ] All other props preserved (ref, onClick, etc.)

#### 4. Elem Transformations ⭐
```diff
- <Elem name="button" mod={{ active }} mix={cls}>
+ <div className={cn("parent-block").elem("button").mod({ active }).mix(cls).toClassName()}>
```

**Check:**
- [ ] Parent block name correct in `cn("parent-block")`
- [ ] Elem name preserved: `.elem("button")`
- [ ] All mods preserved: `.mod({ ... })`
- [ ] All mixes preserved: `.mix(...)`
- [ ] `.toClassName()` is present
- [ ] Tag changed appropriately

**Special case - Elem without name:**
```diff
- <Elem mod={{ active }}>
+ <div className={cn("parent-block").mod({ active }).toClassName()}>
```
- [ ] NO `.elem()` called when original had no name prop
- [ ] Uses parent block name directly

#### 5. Chain Order ⭐
**CRITICAL:** Always in this order:
```javascript
cn(block)
  .elem(elem)      // Only if Elem has name prop
  .mod(mod)        // If any mods
  .mix(mix)        // If any mixes
  .toClassName()   // ALWAYS required!
```

- [ ] Order is correct
- [ ] `.toClassName()` is always present
- [ ] No `.elem()` on Block transforms
- [ ] No double `.elem()` calls

#### 6. Special Cases

**Dynamic tags:**
```diff
- <Block tag={DynamicTag} name="component">
+ {createElement(DynamicTag, {
+   className: cn("component").toClassName(),
+   ...props
+ }, children)}
```
- [ ] Uses `createElement` for dynamic tags
- [ ] All props spread correctly
- [ ] Children handled correctly

**Component tags:**
```diff
- <Elem tag={Userpic} name="pic" user={user} />
+ <Userpic className={cn("parent").elem("pic").toClassName()} user={user} />
```
- [ ] Component receives `className` prop
- [ ] All other props preserved

**Button elements:**
```diff
- <Elem tag="button" name="btn" onClick={handler}>
+ <button type="button" className={cn("parent").elem("btn").toClassName()} onClick={handler}>
```
- [ ] `type="button"` added to button elements
- [ ] onClick and other handlers preserved

#### 7. Props Preservation ⭐
- [ ] `ref` preserved
- [ ] Event handlers preserved (onClick, onChange, etc.)
- [ ] Data attributes preserved
- [ ] Aria attributes preserved
- [ ] All custom props preserved

#### 8. No Breaking Changes
- [ ] No logic changes (only BEM transformation)
- [ ] No behavior changes
- [ ] No prop renames
- [ ] No new functionality added

#### 9. File-Specific Checks
- [ ] `.jsx` files don't use TypeScript syntax (no `as any`)
- [ ] `.tsx` files can use TypeScript syntax
- [ ] No new linter errors
- [ ] No new console.log or debug code

#### 10. CSS Classes Match
**Verify generated CSS classes are identical:**

Before:
```html
<div class="component component--active component__element">
```

After:
```html
<div class="component component--active component__element">
```

- [ ] Block classes match: `component`
- [ ] Modifier classes match: `component--active`
- [ ] Element classes match: `component__element`
- [ ] Mix classes preserved

### Quick Approval Checklist

**A commit is ready to approve if:**
- ✅ Commit message is clear and complete
- ✅ Only one file changed (or small logical group)
- ✅ All imports updated correctly
- ✅ All Block/Elem removed from file
- ✅ Chain order correct everywhere
- ✅ `.toClassName()` present everywhere
- ✅ Props preserved
- ✅ No logic changes
- ✅ Build passes (mentioned in commit message)
- ✅ Linter passes (mentioned in commit message)

### Red Flags 🚩

**Request changes if you see:**
- 🚩 Missing `.toClassName()`
- 🚩 Wrong chain order (mod before elem, etc.)
- 🚩 Wrong parent block name for Elem
- 🚩 Missing imports or unused imports
- 🚩 TypeScript syntax in .jsx files
- 🚩 Button elements without `type="button"`
- 🚩 Props lost or modified
- 🚩 Logic changes mixed with BEM migration
- 🚩 Multiple unrelated files in one commit
- 🚩 Incomplete testing checklist

### Fast Review Commands

```bash
# Review the commit diff
git show <commit-hash>

# Check for any remaining Block/Elem
git show <commit-hash> | grep -E "import.*Block.*bem|import.*Elem.*bem"

# Verify all cn calls have toClassName
git show <commit-hash> | grep "cn(" | grep -v "toClassName()"

# Check for proper imports
git show <commit-hash> | grep "import.*cn.*bem"

# See before/after side by side
git show <commit-hash> --color-words

# Test the commit
git checkout <commit-hash>
yarn build  # Should succeed
```

### Common Review Feedback Templates

**Missing toClassName:**
```
Missing `.toClassName()` on line X. All cn() chains must end with .toClassName().
```

**Wrong chain order:**
```
Chain order incorrect on line X. Should be: cn(block).elem(...).mod(...).mix(...).toClassName()
```

**Wrong parent block:**
```
Elem on line X uses wrong parent block. Should be "actual-parent" not "wrong-parent".
```

**Props lost:**
```
The `ref` prop from line X in the original was not preserved in the migration.
```

**Too many files:**
```
This commit changes X files. Please split into one commit per file for easier review.
```

---

## Success Criteria

- [ ] All 140 files migrated OR documented reason if skipped
- [ ] Individual commit per file (or logical group)
- [ ] No TypeScript errors
- [ ] No linter errors
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Same CSS classes generated (verify in DevTools)
- [ ] Enterprise features still work (billing, RBAC, etc.)
- [ ] No breaking changes to public APIs
- [ ] No Sentry errors in production

---

## Quick Reference Commands

```bash
# Find all Block/Elem usage in LSE
cd /Users/raulmartin/Code/label-studio-enterprise/web
grep -r "import.*Block.*bem\|import.*Elem.*bem" apps/labelstudio/src/ \
  --include="*.tsx" --include="*.jsx" -l

# Count files by category
grep "components_lse" lse-migration-files.txt | wc -l  # Enterprise-specific
grep "components/" lse-migration-files.txt | grep -v "components_lse" | wc -l  # Shared
grep "pages/" lse-migration-files.txt | wc -l  # Pages

# Check open source equivalent
cd /Users/raulmartin/Code/label-studio/web
find . -name "ComponentName.*" ! -path "*/node_modules/*"

# Check for children with Block/Elem
cd /Users/raulmartin/Code/label-studio-enterprise/web
grep -r "children" apps/labelstudio/src/ --include="*.jsx" --include="*.tsx" -l | \
  xargs grep -l "Block\|Elem"

# Run tests
yarn test

# Run linter
yarn biome check . --diagnostic-level=error

# Build
yarn build
```

---

## Communication with Team

**Before starting migration:**
- Notify team about BEM migration
- Create tracking document
- Set up regular progress updates

**During migration:**
- Commit frequently (one file at a time)
- Update progress tracker
- Report blockers immediately

**After migration:**
- Full QA testing
- Monitor Sentry for errors
- Document any skipped files

---

## Notes

- LSE has **140 files** using Block/Elem (vs ~95 in OS editor+datamanager)
- LSE imports BEM from `@humansignal/core` via local wrapper
- Enterprise-specific components (components_lse/) are safest to migrate first
- Many components may have open source equivalents - check before migrating
- Organization pages are the largest group (209 files in Organization/)
- Goal: 100% migration, 0 breaking changes
- Conservative approach: when in doubt, SKIP and document

---

## Support

If you encounter:
- **Dynamic Block/Elem names**: SKIP, document in migration report
- **Complex BemWithSpecifiContext usage**: Coordinate with team
- **Breaking changes**: STOP, reassess approach, coordinate with team
- **Unclear parent Block**: SKIP, document, revisit after parent is migrated
- **Enterprise feature issues**: Test thoroughly, coordinate with QA

Good luck! 🚀

