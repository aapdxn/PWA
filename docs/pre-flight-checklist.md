# Pre-Flight Checklist for Vault Budget Code Changes

*Run this checklist BEFORE generating ANY code for this project.*

---

## ✅ THE 5 MANDATORY CHECKS

### 1. SECURITY VALIDATION
- [ ] **Encryption First:** Will this code encrypt ALL financial data before storage?
- [ ] **No Plain-text:** Am I certain no plain-text data touches IndexedDB/LocalStorage?
- [ ] **Key Management:** Is the encryption key ONLY in memory during unlocked state?
- [ ] **State-Aware Decrypt:** Are all decrypt operations checking for unlocked state?

**If ANY checkbox fails:** Stop and redesign to comply with zero-knowledge architecture.

---

### 2. STATE COMPATIBILITY
- [ ] **Setup State:** Will this work correctly on first run (no password set)?
- [ ] **Locked State:** Will this fail gracefully when app is locked?
- [ ] **Unlocked State:** Does this function properly with decryption available?
- [ ] **Transitions:** Are state changes handled via callbacks (`onSetupSuccess`, `onUnlockSuccess`)?

**If ANY checkbox fails:** Add state checks before executing logic.

---

### 3. MODULARITY COMPLIANCE
- [ ] **Correct File:** Am I modifying code in the file that owns this logic?
  - Security.js: ONLY crypto operations
  - Database.js: ONLY Dexie CRUD
  - CSV-importer.js: ONLY import/export logic
  - UI modules: ONLY their designated domain
- [ ] **File Size:** Will this keep the target file under its size limit?
  - If adding >50 lines: Extract to helper function/module
  - If file is >600 lines: Propose refactor BEFORE proceeding
- [ ] **No Duplication:** Am I creating a class that already exists elsewhere?

**If ANY checkbox fails:** Extract to appropriate module or create new helper file.

---

### 4. EVENT HANDLING PATTERNS
- [ ] **Dynamic Elements:** Are listeners attached AFTER `innerHTML` insertion?
- [ ] **Delegation:** Am I using event delegation for repeating elements?
- [ ] **Cleanup:** Are listeners removed during state transitions (if applicable)?

**Pattern Reminder:**
```javascript
// ✅ CORRECT
container.innerHTML = '<button id="my-btn">Click</button>';
document.getElementById('my-btn').addEventListener('click', handler);

// ❌ WRONG
document.getElementById('my-btn').addEventListener('click', handler); // Element doesn't exist yet
container.innerHTML = '<button id="my-btn">Click</button>';
```

---

### 5. SERVICE WORKER & DEPLOYMENT
- [ ] **Cache Version:** Did I increment `CACHE_VERSION` in sw.js?
  - Current: `v2.24.0` (major refactor)
  - Feature addition: Increment MINOR (v2.25.0)
  - Bug fix: Increment PATCH (v2.24.1)
- [ ] **Cache List:** Did I add new files to `urlsToCache` array?

**Deployment Rule:** EVERY code change requires cache version increment.

---

## 🎯 DOMAIN-SPECIFIC CHECKS

### For Data Display (Transactions, Budget):
- [ ] **Category-Aware Signing:** Am I checking `category.type` to adjust amount sign?
  - Income/Saving: Show positive (or absolute value)
  - Expense: Show negative
- [ ] **State Persistence:** Am I using class properties for UI state (not local variables)?

### For CSV Import:
- [ ] **Column Normalization:** Am I normalizing headers to lowercase?
- [ ] **Field Mapping:** Are ALL encrypted fields mapped in `prepareTransaction()`?
- [ ] **Reference Resolution:** Do I provide a path to resolve missing categories/accounts?

### For UI Rendering:
- [ ] **Tab Context:** Am I checking `currentTab` before rendering context-specific UI?
- [ ] **Class Management:** Am I using `.active` class system consistently?
- [ ] **Edge Cases:** Does this handle 0, 1, and many items gracefully?

---

## 🚫 KNOWN ANTI-PATTERNS (Do NOT Commit)

- ❌ Storing `activeMonth` as local variable → Use `this.activeMonth`
- ❌ Adding listeners before `innerHTML` → Attach after insertion
- ❌ Mixing `.active` and `.hidden` class logic → Use `.active` only
- ❌ Treating all amounts as expenses → Check category type
- ❌ Importing CDN libraries → Use global variables (Dexie, Papa, lucide)
- ❌ Methods exceeding 50 lines → Extract helper functions
- ❌ Files exceeding 800 lines → Propose refactor immediately

---

## 📊 FILE SIZE QUICK REFERENCE

| File | Target Max | Status |
|------|-----------|--------|
| transaction-ui.js | 600 | ✅ REFACTORED |
| ui.js (ui-manager.js) | 300 | ✅ REFACTORED |
| csv-engine.js | 250 | ✅ REFACTORED |
| All other modules | 400 | ✅ COMPLIANT |

*Target refactor threshold: 600 lines*

---

**Before submitting code:** Verify all ✅ checkboxes are complete.  
**If ANY check fails:** Revise approach before generating code.
