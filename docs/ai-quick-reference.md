# AI Productivity Quick Reference Card

**For AI Assistants Working on Vault Budget PWA**

---

## 🚀 BEFORE STARTING ANY TASK

### Step 1: Read Documentation FIRST (Not Code)

**Implementing a Feature?**
→ Read `/docs/feature-implementation-template.md` (8-step checklist)  
→ Read `/docs/api-contracts.md` (method signatures)  
→ Read `/docs/data-flow-diagrams.md` (visual workflows)

**Fixing a Bug?**
→ Read `/docs/bug-fix-template.md` (9 common patterns)  
→ Read `/docs/lessons-learned.md` (known issues)  
→ Match against pattern → Apply fix → Done!

**Refactoring?**
→ Run `/scripts/file-size-monitor.ps1` (check line counts)  
→ Run `/scripts/dependency-graph.ps1` (check impact)  
→ Read `/docs/module-dependencies.md` (hub vs leaf modules)

---

## 📋 PRE-FLIGHT CHECKLIST (Run Before Coding)

- [ ] **Security:** Does this expose plain-text data? (❌ FORBIDDEN)
- [ ] **State:** Does this work in Setup, Locked, AND Unlocked? (✅ REQUIRED)
- [ ] **File Size:** Will this keep file <800 lines? (If no → create new module)
- [ ] **Event Listeners:** Attached AFTER innerHTML insertion? (✅ REQUIRED)
- [ ] **State Guards:** Added before decrypt operations? (✅ REQUIRED)

---

## 🔑 CRITICAL PATTERNS (Must Follow)

### State Guard Pattern (Before ALL Decrypt Operations)
```javascript
// STATE GUARD: Requires unlocked state
if (!this.security.encryptionKey) {
    console.error('Cannot decrypt: App is locked');
    return;
}

const decrypted = await this.security.decrypt(encrypted);
```

### Event Listener Timing Pattern
```javascript
// EVENT LISTENER TIMING: Attach AFTER innerHTML to ensure DOM exists
container.innerHTML = template;
element.addEventListener('click', handler); // ✅ AFTER
```

### Category-Aware Amount Signing
```javascript
// CATEGORY TYPE: Check if Income or Expense for correct sign
const isIncome = category.type === 'Income';
const displayAmount = isIncome ? Math.abs(amount) : amount;
```

### State Persistence Pattern
```javascript
// ❌ WRONG: Local variable (lost on re-render)
let activeMonth = '2025-12';

// ✅ CORRECT: Class property (persists)
this.activeMonth = '2025-12';
```

---

## 🗂️ DOCUMENTATION ROADMAP

### Core Documentation (8 Files)
1. **api-contracts.md** - All method signatures (SecurityManager, DatabaseManager, CSVEngine)
2. **feature-implementation-template.md** - 8-step checklist for new features
3. **bug-fix-template.md** - 7-step debugging workflow
4. **data-flow-diagrams.md** - 6 major workflows with Mermaid diagrams
5. **module-dependencies.md** - Complete dependency tree, 6 layers
6. **state-machine.md** - 3-state FSM (Setup/Locked/Unlocked)
7. **lessons-learned.md** - Known bug patterns with solutions
8. **pre-flight-checklist.md** - Pre-coding validation

### Automation Scripts (2 Files)
1. **file-size-monitor.ps1** - Check for files approaching 800-line limit
2. **dependency-graph.ps1** - Generate Mermaid dependency graph

---

## 📊 ARCHITECTURE LAYERS (6 Layers)

```
Layer 6: main.js (Entry Point)
    ↓
Layer 5: UI Components (27 files)
    ↓
Layer 4: Templates (transaction-templates.js)
    ↓
Layer 3: Core Services (csv-engine, validators, helpers)
    ↓
Layer 2: database.js (Dexie wrapper)
    ↓
Layer 1: security.js (Web Crypto API)
    ↓
Layer 0: CDN (Dexie, PapaParse, Lucide)
```

**Rule:** Higher layers can import lower layers, NEVER reverse.

---

## 🔐 SECURITY CONSTRAINTS (Zero-Knowledge)

### ABSOLUTE PROHIBITIONS
- ❌ NEVER store plain-text financial data in IndexedDB
- ❌ NEVER store plain-text financial data in localStorage
- ❌ NEVER store password (only salted PBKDF2 hash)
- ❌ NEVER decrypt without state guard

### REQUIRED PATTERNS
- ✅ ALL financial data encrypted before database storage
- ✅ Encryption key exists ONLY in memory (this.security.encryptionKey)
- ✅ Decrypt operations ONLY in unlocked state
- ✅ AES-GCM 256-bit encryption
- ✅ PBKDF2 ≥100k iterations

---

## 🎯 STATE MACHINE (3 States)

### Setup (First Run)
- **Condition:** No password hash in database
- **Available:** Password creation form
- **Forbidden:** All features requiring decryption

### Locked (Password Exists, Not Authenticated)
- **Condition:** Password hash exists, encryptionKey = null
- **Available:** Unlock form
- **Forbidden:** All features requiring decryption

### Unlocked (Authenticated)
- **Condition:** encryptionKey !== null
- **Available:** ALL features
- **Transition to Locked:** User locks app, encryptionKey cleared

**Critical:** ALL decrypt operations require Unlocked state!

---

## 📏 FILE SIZE RULES

### Limits
- **Warning:** 500 lines (start considering extraction)
- **Critical:** 800 lines (MUST refactor immediately)

### When File Approaches 500 Lines
1. Run `/scripts/file-size-monitor.ps1`
2. Create NEW module for additional functionality
3. Extract related code to new module
4. Update imports in main.js
5. Add to sw.js cache array
6. Increment CACHE_VERSION

### Module Naming Patterns
- New tab → `js/ui/[tab-name]-ui.js`
- New format → `js/core/[format]-engine.js`
- New operation → `js/core/[operation]-manager.js`

---

## 🔄 SERVICE WORKER RULES

### ALWAYS Increment After Changes
```javascript
// sw.js - BEFORE
const CACHE_VERSION = 'v2.48.0';

// sw.js - AFTER (any code change)
const CACHE_VERSION = 'v2.49.0'; // Increment!
```

### Versioning Strategy
- **Patch (v2.X.Y++)** - Bug fixes, small changes
- **Minor (v2.X++.0)** - New features, larger changes
- **Major (v3.0.0)** - Breaking changes, major refactor

---

## 🐛 TOP 5 COMMON BUGS (Quick Fixes)

### Bug 1: Button Doesn't Work
**Symptom:** Click does nothing, console shows "element is null"  
**Fix:** Attach listener AFTER innerHTML
```javascript
container.innerHTML = template;
element.addEventListener('click', handler); // After, not before!
```

### Bug 2: "Encryption key not initialized"
**Symptom:** Error when trying to decrypt  
**Fix:** Add state guard
```javascript
if (!this.security.encryptionKey) return;
const data = await this.security.decrypt(encrypted);
```

### Bug 3: Wrong Amount Sign
**Symptom:** Income shows negative, expenses positive  
**Fix:** Check category type
```javascript
const isIncome = category.type === 'Income';
const display = isIncome ? Math.abs(amount) : amount;
```

### Bug 4: Service Worker Won't Update
**Symptom:** Code changes don't appear  
**Fix:** Increment CACHE_VERSION in sw.js

### Bug 5: State Resets on Re-Render
**Symptom:** Selected month/filter resets unexpectedly  
**Fix:** Use class property, not local variable
```javascript
this.activeMonth = '2025-12'; // Not let activeMonth
```

---

## 📝 DOCUMENTATION UPDATE REQUIREMENTS

### After Adding a Method
- [ ] Update `/docs/api-contracts.md` with signature
- [ ] Add JSDoc to method in source file
- [ ] Update workflows if flow changes

### After Creating a File
- [ ] Add to `/docs/module-dependencies.md`
- [ ] Add path to `sw.js` cache array
- [ ] Increment `CACHE_VERSION`

### After Fixing a Bug
- [ ] Update `/docs/lessons-learned.md`
- [ ] Add inline state guard if applicable
- [ ] Increment `CACHE_VERSION`

---

## 🎨 CODE STYLE RULES

### Event Listeners
```javascript
// ✅ CORRECT: After DOM creation
container.innerHTML = html;
btn.addEventListener('click', handler);

// ❌ WRONG: Before DOM creation
btn.addEventListener('click', handler);
container.innerHTML = html;
```

### State Guards
```javascript
// ✅ CORRECT: Guard before decrypt
if (!this.security.encryptionKey) return;
const data = await this.security.decrypt(encrypted);

// ❌ WRONG: No guard
const data = await this.security.decrypt(encrypted);
```

### Tab Visibility
```javascript
// ✅ CORRECT: Check tab context
if (this.currentTab !== 'budget') return;
renderBudgetUI();

// ❌ WRONG: Render on all tabs
renderBudgetUI();
```

### Amount Display
```javascript
// ✅ CORRECT: Category-aware
const isIncome = category.type === 'Income';
const display = isIncome ? Math.abs(amount) : amount;

// ❌ WRONG: Always negative
const display = -Math.abs(amount);
```

---

## 🚀 PRODUCTIVITY WORKFLOW

### Standard Feature Implementation (5 Minutes)
1. Read `/docs/feature-implementation-template.md` (30 sec)
2. Check `/docs/api-contracts.md` for method signatures (30 sec)
3. Check `/docs/data-flow-diagrams.md` if complex (1 min)
4. Implement with patterns (2 min)
5. Update documentation (1 min)

### Standard Bug Fix (3 Minutes)
1. Read `/docs/bug-fix-template.md` (30 sec)
2. Match against known patterns (30 sec)
3. Apply fix (1 min)
4. Update lessons learned (1 min)

---

## 🎯 EXPECTED OUTCOMES

**Before Optimization:** 15-20 minutes per feature (lots of file searching)  
**After Optimization:** 3-5 minutes per feature (documentation lookup)  
**Time Savings:** 70-80% reduction in context gathering

**Bugs Prevented:**
- State guard bugs (decrypt when locked)
- Event listener timing bugs (attached before DOM)
- Amount sign bugs (wrong category type logic)
- File size bugs (too many responsibilities)

---

## 📞 QUICK REFERENCE LINKS

**When you need...**
- Method signatures → `/docs/api-contracts.md`
- Implementation steps → `/docs/feature-implementation-template.md`
- Bug patterns → `/docs/bug-fix-template.md`
- Workflows → `/docs/data-flow-diagrams.md`
- Dependencies → `/docs/module-dependencies.md`
- States → `/docs/state-machine.md`
- Known issues → `/docs/lessons-learned.md`
- Checklist → `/docs/pre-flight-checklist.md`

---

**Remember:** Documentation FIRST, code SECOND. This is the key to 70-80% faster development!

---

**Version:** v2.49.0 (AI Productivity Optimization)  
**Last Updated:** 2025-12-30  
**Print this card and keep it visible!** 📋
