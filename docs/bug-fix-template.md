# Bug Fix Template

**Purpose:** Systematic approach to debugging and fixing issues  
**Use When:** Addressing reported bugs, investigating errors, fixing unexpected behavior  
**Last Updated:** 2025-12-30

---

## STEP 1: ISSUE IDENTIFICATION

### Bug Report
- [ ] **Bug title:** _______________________
- [ ] **Reported by:** User / AI / Testing / Self-discovered
- [ ] **Severity:** Critical / High / Medium / Low
- [ ] **Frequency:** Always / Sometimes / Rare

### Description
- [ ] **What happens (actual behavior):** _______________________
- [ ] **What should happen (expected behavior):** _______________________
- [ ] **Steps to reproduce:** _______________________

### Context
- [ ] **Affected features/pages:** _______________________
- [ ] **State when bug occurs:** Setup / Locked / Unlocked / All
- [ ] **Browser/environment:** _______________________
- [ ] **Error messages (console):** _______________________

---

## STEP 2: PATTERN RECOGNITION

**Check against known issues in [lessons-learned.md](lessons-learned.md):**

### Common Bug Patterns Checklist

- [ ] **Pattern 1: Event Listener Timing** (Issue #38)
  - **Symptom:** Button doesn't work, "element is null" error
  - **Cause:** Listener attached before `innerHTML` creates element
  - **Fix Pattern:** Attach listeners AFTER DOM insertion
  - **Relevant?** Yes / No

- [ ] **Pattern 2: State Guard Missing** (General)
  - **Symptom:** "Encryption key not initialized" error
  - **Cause:** Decrypt operation without unlocked state check
  - **Fix Pattern:** Add `if (!this.security.encryptionKey) return;`
  - **Relevant?** Yes / No

- [ ] **Pattern 3: Category-Aware Amount Signing** (Issue #9)
  - **Symptom:** Income shown as negative, expenses as positive
  - **Cause:** Not checking `category.type` when displaying amount
  - **Fix Pattern:** Use `getAmountClass()` and type-based sign logic
  - **Relevant?** Yes / No

- [ ] **Pattern 4: Service Worker Not Updating** (Issue #1)
  - **Symptom:** Code changes don't appear, old bugs persist
  - **Cause:** `CACHE_VERSION` not incremented
  - **Fix Pattern:** Increment `CACHE_VERSION` in sw.js
  - **Relevant?** Yes / No

- [ ] **Pattern 5: Tab Visibility Logic** (Issues #7, #15, #37)
  - **Symptom:** UI elements showing on wrong tabs
  - **Cause:** Not checking `currentTab` or mixing `.active`/`.hidden`
  - **Fix Pattern:** Use `.active` class system, check tab context
  - **Relevant?** Yes / No

- [ ] **Pattern 6: Month Navigation State Loss** (Issue #6)
  - **Symptom:** Selected month resets unexpectedly
  - **Cause:** Using local variable instead of class property
  - **Fix Pattern:** Use `this.activeMonth` not `let activeMonth`
  - **Relevant?** Yes / No

- [ ] **Pattern 7: CSV Column Mapping** (Issues #8, #11)
  - **Symptom:** CSV data not imported, fields empty
  - **Cause:** Column name mismatch (case sensitivity, spaces)
  - **Fix Pattern:** Normalize headers to lowercase, handle variations
  - **Relevant?** Yes / No

- [ ] **Pattern 8: Orphaned Relationships** (Issue #18)
  - **Symptom:** Transactions break after category deletion
  - **Cause:** No integrity check before delete
  - **Fix Pattern:** Check `getTransactionsByCategory()` first
  - **Relevant?** Yes / No

- [ ] **Pattern 9: File Size Causing Incomplete AI Modifications** (Issues #31, #34, #36)
  - **Symptom:** AI changes only part of file, creates inconsistencies
  - **Cause:** File exceeds ~800 lines
  - **Fix Pattern:** Extract to smaller modules
  - **Relevant?** Yes / No

### Pattern Match Found?
- [ ] **Yes:** Issue matches known pattern #___
  - **Action:** Apply documented fix pattern
  - **Skip to:** Step 4 (Solution Implementation)
  
- [ ] **No:** New issue, requires investigation
  - **Action:** Continue to Step 3 (Root Cause Analysis)

---

## STEP 3: ROOT CAUSE ANALYSIS

### Debugging Strategy

#### 3A: Reproduce the Bug

- [ ] **Can reproduce consistently?**
  - [ ] Yes → Proceed
  - [ ] No → Document repro conditions, try variations

- [ ] **Minimal repro steps:**
  1. _______________________
  2. _______________________
  3. _______________________

#### 3B: Inspect Console Errors

- [ ] **JavaScript errors in console?**
  - [ ] Error message: _______________________
  - [ ] File: _______________________ (Line: ___)
  - [ ] Stack trace analysis: _______________________

#### 3C: Check Network Activity

- [ ] **Failed network requests?**
  - [ ] Which URL: _______________________
  - [ ] Status code: _______________________
  - [ ] Relevant for: CDN resources, external APIs

#### 3D: Verify State Context

- [ ] **What is app state when bug occurs?**
  - [ ] Setup / Locked / Unlocked
  - [ ] Is `encryptionKey` available? Yes / No
  - [ ] Current tab: _______________________

#### 3E: Inspect Database (IndexedDB)

- [ ] **Check database contents:**
  - [ ] Is data encrypted? Yes / No
  - [ ] Are expected records present? Yes / No
  - [ ] Data structure matches schema? Yes / No

#### 3F: Code Review

- [ ] **Review affected files:**
  - [ ] File 1: _______________________
  - [ ] File 2: _______________________
  - [ ] File 3: _______________________

- [ ] **Look for:**
  - [ ] Missing state guards
  - [ ] Event listeners attached too early
  - [ ] Variables declared in wrong scope
  - [ ] Missing error handling
  - [ ] Incorrect class usage (`.active` vs `.hidden`)

---

## STEP 4: SOLUTION IMPLEMENTATION

### 4A: Choose Fix Strategy

Based on root cause, select approach:

- [ ] **Fix Type 1: Add State Guard**
  - Before decrypt operations
  - Before UI rendering with encrypted data

- [ ] **Fix Type 2: Adjust Event Listener Timing**
  - Move `addEventListener()` after `innerHTML`

- [ ] **Fix Type 3: Fix Amount Sign Logic**
  - Check `category.type`
  - Use `getAmountClass()` helper

- [ ] **Fix Type 4: Fix Tab Context Check**
  - Add `if (this.currentTab !== 'targetTab') return;`

- [ ] **Fix Type 5: Fix Scope/Persistence**
  - Change local variable to class property

- [ ] **Fix Type 6: Update Service Worker**
  - Increment `CACHE_VERSION`

- [ ] **Fix Type 7: Extract Large File**
  - Create new module, move functionality

- [ ] **Fix Type 8: Add Validation**
  - Add integrity check before delete/update

- [ ] **Fix Type 9: Other** (specify)
  - Description: _______________________

### 4B: Implement Fix

#### Code Changes

- [ ] **Files modified:**
  - [ ] File 1: _______________________
  - [ ] File 2: _______________________
  - [ ] File 3: _______________________

#### Example Fix Patterns

**Fix Pattern: Add State Guard**
```javascript
// BEFORE (buggy)
async renderData() {
    const data = await this.security.decrypt(encrypted);
}

// AFTER (fixed)
async renderData() {
    // STATE GUARD: Requires unlocked state
    if (!this.security.encryptionKey) {
        console.error('Cannot render: App is locked');
        return;
    }
    
    const data = await this.security.decrypt(encrypted);
}
```

**Fix Pattern: Event Listener Timing**
```javascript
// BEFORE (buggy)
document.getElementById('my-btn').addEventListener('click', handler);
container.innerHTML = '<button id="my-btn">Click</button>';

// AFTER (fixed)
container.innerHTML = '<button id="my-btn">Click</button>';
document.getElementById('my-btn').addEventListener('click', handler);
```

**Fix Pattern: Category-Aware Amount**
```javascript
// BEFORE (buggy)
const displayAmount = amount;

// AFTER (fixed)
const category = await this.db.getCategory(categoryId);
const isIncome = category.type === 'Income';
const displayAmount = isIncome ? Math.abs(amount) : amount;
```

**Fix Pattern: Tab Context Check**
```javascript
// BEFORE (buggy)
renderSummaryCards() {
    // Renders on all tabs
    container.innerHTML = summaryHTML;
}

// AFTER (fixed)
renderSummaryCards() {
    // Only render on budget tab
    if (this.currentTab !== 'budget') return;
    container.innerHTML = summaryHTML;
}
```

**Fix Pattern: Variable Scope**
```javascript
// BEFORE (buggy)
class BudgetUI {
    renderMonth() {
        let activeMonth = '2025-12'; // Lost on re-render
    }
}

// AFTER (fixed)
class BudgetUI {
    constructor() {
        this.activeMonth = '2025-12'; // Persists
    }
}
```

#### Service Worker Update

- [ ] **Increment `CACHE_VERSION` in sw.js:**
  - [ ] Current version: _______
  - [ ] New version: _______
  - [ ] Change type: Patch (bug fix) / Minor (feature)

---

## STEP 5: TESTING

### Test the Fix

- [ ] **Original bug reproduction:**
  - [ ] Follow repro steps
  - [ ] Bug no longer occurs? Yes / No

- [ ] **State testing:**
  - [ ] Setup state: Works / Not applicable
  - [ ] Locked state: Works / Not applicable
  - [ ] Unlocked state: Works / Not applicable

- [ ] **Edge cases:**
  - [ ] Empty data (0 items)
  - [ ] Single item
  - [ ] Many items (100+)
  - [ ] Invalid/corrupted data

- [ ] **Console check:**
  - [ ] No new errors introduced
  - [ ] Original error resolved

- [ ] **Regression testing:**
  - [ ] Other features still work
  - [ ] No new bugs introduced
  - [ ] Related functionality intact

### Service Worker Verification

- [ ] **Cache update confirmed:**
  - [ ] Hard refresh (Ctrl+Shift+R)
  - [ ] Console shows new SW version
  - [ ] Fix appears in app

---

## STEP 6: DOCUMENTATION

### Update Lessons Learned

- [ ] **Is this a new pattern?**
  - [ ] Yes → Add to `lessons-learned.md`
  - [ ] No → Update existing entry if applicable

**If adding to lessons-learned.md:**
```markdown
### Issue: [Bug Title] (Issue #XX)
**Symptom:** [What user sees]
**Root Cause:** [Why it happened]
**Solution:** [How to fix]
**Prevention:** [How to avoid in future]
```

### Update Pre-Flight Checklist (if applicable)

- [ ] **Is this preventable via checklist?**
  - [ ] Yes → Add check to `pre-flight-checklist.md`
  - [ ] No → Skip

**Example addition:**
```markdown
- [ ] Event listeners attached AFTER innerHTML insertion?
- [ ] State guard present before decrypt operations?
```

### Update API Contracts (if behavior changed)

- [ ] **Did method behavior change?**
  - [ ] Yes → Update `api-contracts.md`
  - [ ] No → Skip

### Update Code Comments

- [ ] **Add inline documentation:**
```javascript
// BUG FIX #XX: Add state guard to prevent decrypt when locked
if (!this.security.encryptionKey) {
    console.error('Cannot render: App is locked');
    return;
}
```

---

## STEP 7: POST-FIX REVIEW

### Self-Review Checklist

- [ ] **Root cause eliminated** (not just symptoms)
- [ ] **Fix is minimal** (smallest change that works)
- [ ] **Fix is maintainable** (future developers will understand)
- [ ] **No performance degradation** (doesn't slow down app)
- [ ] **Follows existing patterns** (consistent with codebase)

### Deployment Checklist

- [ ] **Service worker updated** (`CACHE_VERSION` incremented)
- [ ] **No breaking changes** (existing features work)
- [ ] **Console clean** (no new errors)
- [ ] **iOS Safari tested** (if UI-related)

---

## COMMON BUG QUICK FIXES

### Quick Fix 1: Button Doesn't Work
```javascript
// Problem: Event listener attached before element exists
// Solution: Attach AFTER innerHTML
container.innerHTML = '<button id="btn">Click</button>';
document.getElementById('btn').addEventListener('click', handler);
```

### Quick Fix 2: "Encryption Key Not Initialized"
```javascript
// Problem: Missing state guard
// Solution: Check before decrypt
if (!this.security.encryptionKey) return;
const data = await this.security.decrypt(encrypted);
```

### Quick Fix 3: Wrong Amount Sign
```javascript
// Problem: Not checking category type
// Solution: Use type-aware display
const isIncome = category.type === 'Income';
const displayAmount = isIncome ? Math.abs(amount) : amount;
```

### Quick Fix 4: UI Shows on Wrong Tab
```javascript
// Problem: No tab context check
// Solution: Add tab guard
if (this.currentTab !== 'targetTab') return;
// Render tab-specific UI
```

### Quick Fix 5: Service Worker Won't Update
```javascript
// Problem: Cache version not incremented
// Solution: Update sw.js
const CACHE_VERSION = 'v2.X.Y'; // Increment Y for bug fix
```

### Quick Fix 6: State Resets on Re-Render
```javascript
// Problem: Using local variable
// Solution: Use class property
// BEFORE: let activeMonth = '2025-12';
// AFTER: this.activeMonth = '2025-12';
```

---

## TROUBLESHOOTING GUIDE

### Issue: Fix doesn't appear after deploy

**Possible Causes:**
1. Service worker cache not updated
2. Browser cached old version
3. Hard refresh not performed

**Solutions:**
1. Increment `CACHE_VERSION` in sw.js
2. Hard refresh (Ctrl+Shift+R)
3. Clear browser cache manually
4. Check DevTools → Application → Service Workers

---

### Issue: Fix works sometimes, not always

**Possible Causes:**
1. Race condition (async timing)
2. State-dependent bug (works in one state, not others)
3. Event listener attached multiple times

**Solutions:**
1. Add `await` to async operations
2. Test in all states (Setup, Locked, Unlocked)
3. Remove old listeners before adding new ones

---

### Issue: Fix works locally, not in production

**Possible Causes:**
1. Different browser environment
2. Service worker caching old version
3. Environment-specific code path

**Solutions:**
1. Test in target browser (iOS Safari)
2. Force service worker update
3. Check for hardcoded URLs, paths

---

### Issue: Fix creates new bugs

**Possible Causes:**
1. Side effects not considered
2. Shared code affected
3. Missing regression testing

**Solutions:**
1. Review callers of modified function
2. Test all features, not just fixed one
3. Check module dependencies
4. Roll back if critical, redesign fix

---

## BUG FIX LOG TEMPLATE

Document each fix in bug tracker or commit message:

```
BUG FIX #XX: [One-line description]

Issue:
- [What was broken]
- [Steps to reproduce]

Root Cause:
- [Why it was broken]

Solution:
- [What was changed]
- [Files modified]

Testing:
- [How fix was verified]

Related:
- Issue #XX (if duplicate/related)
- Lessons learned entry: [link]

Service Worker:
- Cache version: v2.X.Y → v2.X.(Y+1)
```

---

## PREVENTION STRATEGIES

### How to Avoid This Bug in Future

- [ ] **Add to pre-flight checklist** (preventable via process)
- [ ] **Add linting rule** (preventable via tooling)
- [ ] **Add code comment** (preventable via documentation)
- [ ] **Refactor pattern** (preventable via better architecture)
- [ ] **Add to templates** (preventable via standard patterns)

### Share Knowledge

- [ ] **Update lessons-learned.md** (team knowledge base)
- [ ] **Update copilot-instructions.md** (AI guidance)
- [ ] **Create/update helper functions** (reusable solutions)

---

**Template Version:** 1.0  
**Last Updated:** 2025-12-30  
**Review After:** Every bug fix to improve template
