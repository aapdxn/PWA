# Vault Budget - Zero-Knowledge PWA Architecture Guide

**Role:** Senior Frontend Architect & Security Specialist  
**Platform:** Client-side PWA (iOS Safari optimized)  
**Security Model:** Zero-knowledge encryption (Web Crypto API)

---

## 🔒 HARD CONSTRAINTS (Non-Negotiable)

### Security Architecture
- **PROHIBITION:** Plain-text financial data MUST NEVER touch IndexedDB or LocalStorage
- **ENCRYPTION:** AES-GCM 256-bit via Web Crypto API (PBKDF2 ≥100k iterations)
- **KEY MANAGEMENT:** Encryption keys exist ONLY in memory during unlocked state
- **PASSWORD STORAGE:** Store only salted PBKDF2 hash, NEVER the password itself

### Technology Stack
- **CLIENT-SIDE ONLY:** No Node.js, No Firebase, No backend services
- **PERSISTENCE:** IndexedDB via Dexie.js (CDN global variable)
- **PARSING:** PapaParse (CDN global variable)  
- **ICONS:** Lucide (CDN global variable)
- **MODULE SYSTEM:** ES6 modules with named exports ONLY

### Code Organization
- **FILE SIZE LIMIT:** 800 lines absolute maximum (trigger refactor at 600)
- **CLASS OWNERSHIP:** One class per file, no duplicates across modules
- **SEPARATION OF CONCERNS:**
  - `security.js`: Crypto operations ONLY
  - `database.js`: Dexie CRUD ONLY  
  - `csv-engine.js`: Import/export logic ONLY
  - `ui/*.js`: UI rendering for designated domain ONLY
  - `main.js`: Dependency injection & app lifecycle ONLY

### Proactive File Creation (Anti-Refactoring Strategy)
- **NEW FEATURES → NEW FILES:** When adding functionality, create a new module instead of expanding existing files
- **SIZE THRESHOLD:** If a file approaches 500 lines, extract related functionality to a new module
- **EXAMPLES:**
  - New tab → Create `js/ui/[tab-name]-ui.js`
  - New import format → Create `js/core/[format]-engine.js`
  - New data operation → Create `js/core/[operation]-manager.js`
  - New modal type → Add to `modal-manager.js` or create specific handler
- **IMPORT & INJECT:** Add new module to `main.js` imports and pass via dependency injection
- **SERVICE WORKER:** Add new file path to `sw.js` cache array + increment version
- **FORBIDDEN:** Never add substantial features to files already >400 lines

### State Management
- **THREE STATES:** Setup → Locked → Unlocked (strict transition flow)
- **STATE PERSISTENCE:** Class properties for UI state, NOT local variables
- **ENCRYPTION CONTEXT:** All decrypt operations require unlocked state

---

## 📐 FILE STRUCTURE (Strict Boundaries)

```
/main.js                      - App controller (MAX 200 lines)
/js/core/
  security.js                 - SecurityManager: Web Crypto only (156 lines)
  database.js                 - DatabaseManager: Dexie CRUD (128 lines)
  csv-engine.js               - CSVEngine: CSV coordinator (200 lines)
  csv-validator.js            - CSV duplicate detection (68 lines)
  csv-mapper.js               - CSV column mapping (123 lines)
/js/ui/
  ui-manager.js               - UIManager: Event coordinator (482 lines)
  auth-ui.js                  - AuthUI: Setup/unlock (150 lines)
  transaction-ui.js           - TransactionUI: Core display/CRUD (502 lines)
  budget-ui.js                - BudgetUI: Management (400 lines)
  summary-ui.js               - SummaryUI: Charts (350 lines)
  csv-review-ui.js            - CSVReviewUI: Import review (623 lines)
  mappings-ui.js              - MappingsUI: Mappings CRUD (650 lines)
  settings-ui.js              - SettingsUI: Settings tab (17 lines)
  modal-manager.js            - ModalManager: Shared modals (185 lines)
/css/
  base.css, utilities.css, layout.css
  components.css (640 lines), pages.css (706 lines)
```

---

## 🔄 WORKFLOW RULES

### Service Worker Cache Management
- **CACHE VERSION:** Increment for EVERY code change (semantic versioning)
- **CURRENT VERSION:** `v2.24.0` (major refactor - Dec 2025)
- **AGGRESSIVE UPDATES:** Use `skipWaiting()` + `clients.claim()`

### Pre-Code Checklist (Run BEFORE writing code)
**See `/docs/pre-flight-checklist.md` for full details:**
1. **Security:** Does this expose plain-text data anywhere?
2. **State:** Does this work in Setup, Locked, AND Unlocked states?
3. **Modularity:** Is this code in the correct file per separation rules?
4. **Size:** Will this keep the file under size limit? (if not, extract to new file)
5. **Class Ownership:** Am I modifying a class that lives in a different file?
6. **New Feature Check:** Should this be a new module instead of additions to existing file?

### Event Listener Pattern
- **DYNAMIC ELEMENTS:** Attach listeners AFTER innerHTML insertion
- **DELEGATION:** Use event delegation for repeating elements
- **CLEANUP:** Remove listeners when transitioning between states

### CSS Class Management
- **TAB VISIBILITY:** Use `.active` class system consistently
- **AVOID CONFLICTS:** Never mix `.active` and `.hidden` class logic

---

## 🗄️ DATABASE SCHEMA (Dexie.js)

```javascript
// Settings: { key, value }
// Categories: { id, encrypted_name, encrypted_limit, type }
// Transactions: { id, encrypted_date, encrypted_amount, encrypted_description, 
//                 encrypted_account, categoryId, encrypted_note }
// Mappings (accounts): { account_number, encrypted_name }
// Mappings (descriptions): { description, encrypted_category, encrypted_payee }
```

**Relational Logic:** `categoryId` links transactions to categories  
**Version Management:** Increment `db.version()` when adding tables/indexes

---

## 📱 UI/UX REQUIREMENTS

- **iOS Native Aesthetic:** San Francisco font stack, safe-area-insets
- **Mobile-First:** Touch-friendly targets, no zoom on input focus
- **Navigation:** Bottom nav (4 tabs), top add bar (60% width, Transactions tab only)
- **Forms:** Prevent zoom with `font-size: 16px` minimum on inputs

---

## 🚨 CRITICAL BUGS REFERENCE

*See `/docs/lessons-learned.md` for detailed root causes and solutions*

**Top 5 Recurring Issues:**
1. Service worker not updating → Always increment cache version
2. Event listeners on dynamic elements → Attach after DOM insertion
3. Category-aware amount signing → Check type (Income/Expense) before display
4. State persistence → Use class properties, not local variables
5. Tab visibility logic → Consistent `.active` class management

---

## 🔍 EMERGENCY RESET

```javascript
// Complete data wipe (for development only)
indexedDB.deleteDatabase('VaultBudget');
navigator.serviceWorker.getRegistrations()
    .then(r => r.forEach(reg => reg.unregister()));
caches.keys().then(k => k.forEach(c => caches.delete(c)));
localStorage.clear();
location.reload();
```

---

**Last Updated:** 2025-12-23 (Major Refactor v2.24.0)  
**Cache Version:** v2.24.0  
**Line Count Reduction:** 4,900+ lines removed (60% reduction)  
**Documentation:** See `/docs` folder for detailed guides
