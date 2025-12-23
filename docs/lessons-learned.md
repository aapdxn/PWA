# Vault Budget - Lessons Learned Archive

*Categorized bug history and resolution patterns. Reference when encountering similar issues.*

---

## 🔐 SECURITY & ENCRYPTION

### Issue: Plain-text Data Exposure
**Symptom:** Financial data visible in IndexedDB DevTools  
**Root Cause:** Forgot to encrypt before db.add()  
**Solution:** All data persistence must go through SecurityManager.encrypt()  
**Prevention:** Add encryption validation in database.js methods

---

## 🎨 UI/UX PATTERNS

### Issue: Add Bar Showing on All Tabs (Issue #7)
**Root Cause:** Add bar visibility not scoped to Transactions tab  
**Solution:** Conditional show/hide in `showTab()` based on `currentTab`  
**Prevention:** Always scope contextual UI to specific tabs

### Issue: Bottom Nav Scrolling Away (Issue #10)
**Root Cause:** `position: fixed` lost during scroll  
**Solution:** Ensure `position: fixed` with `z-index: 1000` and safe-area padding  
**Prevention:** Test scrolling on all tabs with extensive content

### Issue: Summary Cards Showing Everywhere (Issues #15, #28)
**Root Cause:** Rendered without tab context check  
**Solution:** Only render summary cards when `currentTab === 'budget'`  
**Pattern:** Always check active tab before rendering context-specific UI

### Issue: Chart Not Rendering for Single Category (Issue #14)
**Root Cause:** Donut chart logic assumed multiple categories  
**Solution:** Show full 360° circle when only one category exists  
**Prevention:** Handle edge cases (0, 1, many items) in visualization logic

---

## 📊 DATA MANAGEMENT

### Issue: Income Shown as Negative (Issue #9)
**Root Cause:** Amount sign not adjusted by category type  
**Solution:** Check `category.type` → multiply by -1 for Income/Saving  
**Pattern:** `const displayAmount = category.type === 'Income' ? Math.abs(amount) : amount`  
**Prevention:** Apply sign logic at render time based on category type

### Issue: Month Navigation State Loss (Issue #6)
**Root Cause:** `activeMonth` stored as local variable  
**Solution:** Store as class property (`this.activeMonth`)  
**Prevention:** Use class-level state for all persistent UI state

### Issue: Category Deletion Orphaning Transactions (Issue #18)
**Root Cause:** No relationship integrity check before deletion  
**Solution:** Show migration modal to reassign transactions before deleting category  
**Prevention:** Always validate foreign key relationships before cascading deletes

### Issue: Budget Edits Affecting All Months (Issue #19)
**Root Cause:** No temporal scope selection  
**Solution:** Prompt "This Month Only" vs "This and Future Months"  
**Prevention:** Consider temporal scope for recurring financial data

---

## 📥 CSV IMPORT

### Issue: Column Name Mismatches (Issue #8)
**Root Cause:** Case sensitivity and space variations ("Transaction Date" vs "date")  
**Solution:** Normalize headers to lowercase, support common variations  
**Pattern:** `const normalizedHeader = header.toLowerCase().trim()`

### Issue: Description Field Not Populated (Issue #11)
**Root Cause:** CSV mapping missing `encrypted_description` field  
**Solution:** Ensure `prepareTransaction()` maps all required encrypted fields  
**Prevention:** Test CSV import with reference files before deployment

### Issue: Mappings File Input Not Triggering (Issue #38)
**Root Cause:** Event listener attached before dynamic element creation  
**Solution:** Attach `addEventListener` AFTER innerHTML insertion  
**Pattern:** Always attach listeners immediately after dynamic DOM creation

### Issue: Unmapped Categories in Import (Issue #39)
**Root Cause:** CSV contains category names not in budget  
**Solution:** Show modal for each unmapped category: (1) Map to existing, (2) Create new  
**Prevention:** Provide resolution path for missing reference data vs silent failure

---

## ⚙️ SERVICE WORKER & CACHING

### Issue: Service Worker Not Updating (Issue #1)
**Root Cause:** Browser caches old SW indefinitely  
**Solution:** Increment `CACHE_VERSION` for EVERY code change  
**Pattern:** v2.X.Y → v2.X.(Y+1) for patches, v2.(X+1).0 for features  
**Prevention:** Use aggressive update strategy (`skipWaiting()` + `claim()`)

### Issue: manifest.json 404 (Issue #4)
**Root Cause:** Missing file prevents PWA installation  
**Solution:** Create manifest.json with required fields, add to SW cache  
**Prevention:** Include manifest in service worker `urlsToCache` array

---

## 🗄️ DATABASE OPERATIONS

### Issue: IndexedDB Schema Silent Failures (Issue #5)
**Root Cause:** Added tables without incrementing version  
**Solution:** Always increment `db.version()` in DatabaseManager  
**Pattern:** `db.version(3).stores({ newTable: 'id, field1, field2' })`  
**Prevention:** Document schema changes in git commit messages

---

## 🏗️ ARCHITECTURE & MODULARITY

### Issue: Class Redeclaration Errors (Issue #2)
**Root Cause:** Same class declared in multiple files  
**Solution:** One class per file, no duplicates  
**Prevention:** Follow strict file structure (Section 5 of main instructions)

### Issue: ES Module vs CDN Global Confusion (Issue #32)
**Root Cause:** Attempting to `import Dexie` when loaded as CDN global  
**Solution:** Access as `window.Dexie`, check availability in `waitForDependencies()`  
**Prevention:** Never import CDN libraries - use global variable detection

### Issue: File Size Bloat Breaking AI Processing (Issues #31, #34, #36)
**Root Cause:** Files exceeding 1000 lines cause incomplete modifications  
**Solution:** Refactor at 600-800 line threshold, split by functional domain  
**Pattern:** Extract helpers when methods exceed 30 lines  
**Prevention:** Run file size check before every feature addition

### Issue: Regression to Monolithic Structure (Issue #35)
**Root Cause:** Gradually adding code to existing files without boundary checks  
**Solution:** Monthly file structure review, enforce separation of concerns  
**Prevention:** Use Pre-Code Checklist before modifications

---

## 🎯 FORM & INPUT HANDLING

### Issue: CDN Resources Blocked (Issue #3)
**Root Cause:** Browser tracking prevention blocks third-party CDNs  
**Solution:** Disable tracking prevention for localhost, or download libs locally  
**Prevention:** Add error handling for failed CDN loads

### Issue: Missing Autocomplete Warnings (Issue #25)
**Root Cause:** Form inputs without autocomplete attribute  
**Solution:** Add `autocomplete="off"` (passwords) or appropriate values  
**Prevention:** Include autocomplete on all input elements

---

## 🔀 STATE TRANSITIONS

### Issue: CSV Import Breaking Tab Switching (Issue #37)
**Root Cause:** CSV page added `.hidden` class, but `showTab()` only manages `.active`  
**Solution:** Use `.active` class system consistently for all tab-like UI  
**Pattern:** Remove `.active` from all tabs, add `.active` to current  
**Prevention:** Document class usage patterns, avoid mixing class systems

---

## 📝 SYNTAX & CODE QUALITY

### Issue: Missing Variable Declarations (Issue #21)
**Root Cause:** Implicit globals from missing `let`/`const`  
**Solution:** Always declare variables with `let` or `const`  
**Prevention:** Enable strict mode, use linter

### Issue: Missing Method Definitions (Issue #30)
**Root Cause:** Event listeners referencing undefined methods  
**Solution:** Add method stubs immediately when referenced in listeners  
**Prevention:** Use checklist to verify all referenced methods exist before class close

---

**Archive Started:** 2025-12-23  
**Last Updated:** 2025-12-23  
**Total Issues Documented:** 39
