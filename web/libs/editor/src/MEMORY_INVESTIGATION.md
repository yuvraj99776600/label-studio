# Memory Leak Flag Investigation

## Overview

This document summarizes the investigation into memory-related feature flags in the Label Studio Editor:
- `FF_LSDV_4620_3_ML` - Memory leak fixes
- `FF_DEV_3391` - Per-annotation config trees

## FF_LSDV_4620_3_ML (Memory Leak Fixes)

### Current Status: **DISABLED by default**

The flag is explicitly overridden to `false` in `utils/feature-flags.ts`:

```typescript
const override: Record<string, boolean> = {
  fflag_fix_front_lsdv_4620_memory_leaks_100723_short: false,
};
```

With this comment:
> TODO: remove the override + if statement once LSE and LSO start building react the same way

### What the Flag Controls

In `LabelStudio.tsx` (V17 destroy path), when **enabled**:

1. `clearRenderedApp()` - Properly unmounts React before MST destruction
2. `this.store.selfDestroy()` - Walks MST tree and destroys children in order
3. Nulls out `this.store`, `this.destroy`, removes from `LabelStudio.instances`

When **disabled** (current default):

1. ❌ React is NOT unmounted before MST destruction
2. ❌ MST children are not destroyed in order
3. ❌ References are not nulled out → **Memory leaks**

### Why It's Disabled

The comment indicates there's an incompatibility between how:
- Label Studio Enterprise (LSE)
- Label Studio Open Source (LSO)

...build React. The specific issue is not documented, but likely relates to:
- Different React versions (17 vs 18)
- Different bundling configurations
- Race conditions in the unmount/destroy sequence

### Recommended Actions

1. **Test enabling the flag** in LSO-only environment to document exact failures
2. **Identify the React build difference** between LSE and LSO
3. **Fix root cause** rather than keeping the flag disabled
4. Alternatively, implement flag-independent cleanup for critical paths:
   - Always clear `window.Htx` (prevents store retention)
   - Always null out `this.store` after destruction
   - Add `isAlive` guards to all async operations

## FF_DEV_3391 (Per-Annotation Config Trees)

### Status: Feature flag for "View All" mode

This flag enables separate config trees per annotation, required for interactive annotations in View All mode.

### Impact on Memory

When enabled:
- Each annotation gets its own config tree copy
- Memory scales linearly with annotation count
- Helps prevent cross-annotation state pollution

When disabled:
- Single shared config tree
- Lower memory usage
- View All mode is view-only

### Location

Used in `stores/Annotation/Annotation.js` to conditionally create per-annotation root trees.

## Memory Leak Mitigation Without Flags

Even with flags disabled, these patterns help reduce leaks:

### 1. Clear Global References

```javascript
// Always do this in destroy(), regardless of flags
window.Htx = null;
```

### 2. Guard Async Operations

```javascript
setTimeout(() => {
  if (!isAlive(self)) return;  // Guard against destroyed store
  // ... rest of logic
});
```

### 3. Dispose Subscriptions

```javascript
let disposer = onSnapshot(self.areas, callback);
// In beforeDestroy:
disposer?.();
```

### 4. Use Safe References

Where possible, use `types.safeReference()` instead of `types.reference()` to avoid warnings during destruction.

## Testing Recommendations

1. Enable `FF_LSDV_4620_3_ML` in test environment
2. Navigate in/out of labeling interface
3. Monitor:
   - Memory heap snapshots
   - Console warnings
   - JS errors
4. Document exact failure conditions
5. Fix root causes before re-enabling
