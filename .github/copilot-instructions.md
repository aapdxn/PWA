# Copilot Instructions: Vault Budget (Secure, Local-First PWA)

You are acting as a Senior Frontend Architect and Security Specialist. All code generated for this project must strictly adhere to these architectural and security constraints.

## 1. Core Architecture
- **Environment:** Strictly Client-Side (No Node.js, No Firebase, No Backend).
- **Persistence:** IndexedDB via Dexie.js (CDN).
- **Offline Support:** Service Worker (sw.js) for PWA functionality.
- **Platform Focus:** iOS Safari (PWA "Add to Home Screen" optimized).

## 2. Security & Encryption Standards (Non-Negotiable)
- **Engine:** Use the native Web Crypto API (window.crypto.subtle).
- **Key Derivation:** Use PBKDF2 with at least 100,000 iterations and a random salt to derive keys from the user's master password.
- **Encryption Algorithm:** AES-GCM 256-bit.
- **Zero-Knowledge:** Plain-text data must NEVER be stored in IndexedDB or LocalStorage. All financial data must be encrypted before storage and decrypted only in memory during the "Unlocked" state.
- **Password Safety:** Do not store the password. Store only a salted PBKDF2 hash for verification.

## 3. Database Schema (Dexie.js)
- **Settings Table:** `{ key, value }` (Stores salted password hash and UI preferences).
- **Categories Table:** `{ id, encrypted_name, encrypted_limit, type }` (type: Income, Expense, Saving, Transfer).
- **Transactions Table:** `{ id, encrypted_date, encrypted_amount, encrypted_description, encrypted_account, categoryId, encrypted_note, encrypted_custom_fields }`.
- **Mappings Tables:**
  - `mappings_accounts`: `{ account_number (key), encrypted_name }`.
  - `mappings_descriptions`: `{ description (key), encrypted_category, encrypted_payee }`.
- **Relational Logic:** Use categoryId as a foreign key to link transactions to categories.
- **Version Management:** Increment `db.version()` when adding new tables or indexes.

## 4. UI/UX Requirements
- **Aesthetic:** Native iOS "San Francisco" font stack, safe-area-insets (handling the notch), and "standalone" PWA display.
- **Interactions:** Mobile-first, bottom-aligned navigation, prevent zoom on input focus.
- **State Management:** Handle three distinct application states:
  1. **Setup** (First run, set password).
  2. **Locked** (Password entry required).
  3. **Unlocked** (Decrypted session active).
- **Navigation:** Bottom navigation bar with 4 tabs: Transactions, Budget, Mappings, Settings.
- **Add Bar:** Top bar with 60% width, centered, containing "Add Transaction" and "Import CSV" buttons.

## 5. Development Guidelines
- Use Vanilla JavaScript (ES6+).
- Use modular Class-based structures: `SecurityManager`, `DatabaseManager`, `CSVImporter`, and main `App` class.
- **File Structure:**
  - `/app.js` - Main application controller (no class declarations, only App class).
  - `/js/security-manager.js` - SecurityManager class only.
  - `/js/database.js` - DatabaseManager class only.
  - `/js/csv-importer.js` - CSVImporter class only.
- Ensure all external libraries (Dexie, Lucide, PapaParse) are called via CDN.
- **Never duplicate class declarations** across files - each class lives in exactly one file.

## 6. Continuous Learning & Troubleshooting

### 6.1 Root Cause Retention
Whenever a bug is fixed or behavior is corrected, immediately document it here to prevent recurrence:

#### Known Issues & Solutions

**Issue 1: Service Worker Not Updating**
- **Root Cause:** Browser caches old service worker indefinitely.
- **Solution:** Always increment `CACHE_VERSION` in `sw.js` when making code changes.
- **Prevention:** Use aggressive update strategy (see 6.2).

**Issue 2: Class Redeclaration Errors**
- **Root Cause:** Same class declared in multiple JavaScript files.
- **Solution:** Each class must live in exactly one file. `app.js` should only contain the `App` class.
- **Prevention:** Follow the file structure defined in Section 5.

**Issue 3: CDN Resources Blocked by Tracking Prevention**
- **Root Cause:** Modern browsers block third-party CDN resources.
- **Solution:** For development, disable tracking prevention for localhost. For production, download libraries locally.
- **Prevention:** Add error handling for failed CDN loads and log warnings.

**Issue 4: manifest.json 404 Errors**
- **Root Cause:** Missing manifest file causes PWA installation failures.
- **Solution:** Always create `manifest.json` in root directory with minimum required fields.
- **Prevention:** Include `manifest.json` in service worker cache list.

**Issue 5: IndexedDB Schema Migrations**
- **Root Cause:** Adding new tables without incrementing version number causes silent failures.
- **Solution:** Always increment `db.version()` number in DatabaseManager when adding tables/indexes.
- **Prevention:** Document schema changes in git commits.

**Issue 6: Month Navigation State Loss**
- **Root Cause:** activeMonth state not persisting across renders.
- **Solution:** Store activeMonth as class property, not local variable.
- **Prevention:** Use class-level state for all persistent UI state.

### 6.2 PWA Refresh Strategy (Aggressive Update Mode)

All Service Worker updates must use the following aggressive strategy to ensure immediate code deployment:

```javascript
// In sw.js install event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting()) // ← Force immediate activation
    );
});

// In sw.js activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(
                names.map(name => name !== CACHE_NAME ? caches.delete(name) : null)
            ))
            .then(() => self.clients.claim()) // ← Take control immediately
    );
});

// In index.html registration
navigator.serviceWorker.register('sw.js')
    .then(reg => {
        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Notify user of update or auto-reload
                    if (confirm('New version available. Reload now?')) {
                        window.location.reload();
                    }
                }
            });
        });
    });
```

**Cache Versioning Rules:**
- Increment `CACHE_VERSION` (e.g., `v2.2.1` → `v2.2.2`) for ANY code change.
- Use semantic versioning: `vMAJOR.MINOR.PATCH`
  - MAJOR: Breaking changes to data structure or security model.
  - MINOR: New features (CSV import, new tabs, etc.).
  - PATCH: Bug fixes, style tweaks, minor refactors.

### 6.3 Validation First Protocol

Before suggesting ANY code change, validate against these checkpoints:

**Security Validation:**
- [ ] Does this change expose any plain-text financial data in IndexedDB?
- [ ] Are all new database fields encrypted using SecurityManager?
- [ ] Is the encryption key properly cleared on lock?
- [ ] Does this preserve zero-knowledge architecture?

**State Management Validation:**
- [ ] Does this work correctly in Setup state?
- [ ] Does this work correctly in Locked state?
- [ ] Does this work correctly in Unlocked state?
- [ ] Are state transitions handled properly?

**UI/UX Validation:**
- [ ] Is this mobile-first and touch-friendly?
- [ ] Does this respect safe-area-insets?
- [ ] Will this prevent zoom on input focus?
- [ ] Is bottom navigation still accessible?

**Code Structure Validation:**
- [ ] Is each class in the correct file?
- [ ] Are there any duplicate class declarations?
- [ ] Do all file paths use relative references?
- [ ] Is the change consistent with existing patterns?

### 6.4 Standardized Debugging Checklist

When a change doesn't appear in the browser, follow this exact sequence:

1. **Verify Service Worker Status:**
   ```
   DevTools → Application → Service Workers
   Check: Is the new version "activated and running"?
   ```

2. **Confirm Cache Version Incremented:**
   ```javascript
   // In sw.js - did CACHE_VERSION change?
   const CACHE_VERSION = 'v2.X.X'; // Must be new
   ```

3. **Force Cache Clear:**
   ```javascript
   // Run in Console:
   navigator.serviceWorker.getRegistrations()
       .then(r => r.forEach(reg => reg.unregister()));
   caches.keys().then(k => k.forEach(c => caches.delete(c)));
   ```

4. **Hard Reload:**
   - Windows/Linux: `Ctrl+Shift+R`
   - Mac: `Cmd+Shift+R`
   - Or: Hold Shift + Click Reload button

5. **Check Console for Errors:**
   - Look for class redeclaration errors
   - Look for CDN loading failures
   - Look for Dexie schema errors

6. **Verify File Loading:**
   ```
   DevTools → Network → Filter: JS
   Confirm all .js files loaded with 200 status
   ```

### 6.5 Additional Safety Checks

**Before Committing Code:**
- [ ] Test in an Incognito/Private window (clean state).
- [ ] Test password setup → lock → unlock flow.
- [ ] Verify at least one transaction can be encrypted and decrypted.
- [ ] Check IndexedDB in DevTools - confirm no plain-text data visible.
- [ ] Test with DevTools offline mode enabled.

**Before Each Feature:**
- [ ] Document expected behavior in code comments.
- [ ] Add the feature to this instruction file if it introduces new patterns.
- [ ] Consider how the feature affects all three states (Setup, Locked, Unlocked).

**Regression Prevention:**
- [ ] When fixing a bug, add the root cause to Section 6.1.
- [ ] When adding a new table, document it in Section 3.
- [ ] When changing navigation, update Section 4.
- [ ] When adding a new class, update Section 5 file structure.

### 6.6 Emergency Reset Procedure

If the app becomes completely unresponsive or corrupted:

```javascript
// Run in Console (WARNING: Deletes ALL data):
indexedDB.deleteDatabase('VaultBudget');
navigator.serviceWorker.getRegistrations()
    .then(r => r.forEach(reg => reg.unregister()));
caches.keys().then(k => k.forEach(c => caches.delete(c)));
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### 6.7 Monthly Review Checklist

Perform these checks at least monthly:

- [ ] Review all items in Section 6.1 (Known Issues) - are any obsolete?
- [ ] Check for new browser Web Crypto API updates.
- [ ] Verify PBKDF2 iteration count is still sufficient (currently 100,000).
- [ ] Test PWA installation on latest iOS Safari.
- [ ] Review service worker caching strategy effectiveness.
- [ ] Audit IndexedDB for any accidental plain-text storage.

---

## Change Log

- **2025-01-XX:** Added Section 6 - Continuous Learning & Troubleshooting.
- **2025-01-XX:** Updated Section 3 with mappings tables and type field.
- **2025-01-XX:** Updated Section 4 with new navigation structure.
- **2025-01-XX:** Updated Section 5 with explicit file structure rules.
