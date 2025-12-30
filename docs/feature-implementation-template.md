# Feature Implementation Template

**Purpose:** Step-by-step checklist for implementing ANY new feature  
**Use When:** Adding functionality, creating new modules, extending existing features  
**Last Updated:** 2025-12-30

---

## STEP 1: REQUIREMENTS ANALYSIS

### Feature Specification
- [ ] **Feature name:** _______________________
- [ ] **Feature description:** _______________________
- [ ] **User story:** As a [user], I want to [action], so that [benefit]

### Technical Scope
- [ ] **Affected existing modules:** _______________________
- [ ] **New modules needed:** _______________________
- [ ] **Estimated lines of code:** _______________________
- [ ] **Complexity:** Simple / Medium / Complex

### State & Security Requirements
- [ ] **State requirement:** 
  - [ ] Works in Setup state
  - [ ] Works in Locked state (shows error/disabled)
  - [ ] Works in Unlocked state
  - [ ] All states

- [ ] **Security implications:**
  - [ ] Handles encrypted data
  - [ ] Requires decryption (unlocked state)
  - [ ] Creates new encrypted data
  - [ ] No financial data involved

### Data Layer Impact
- [ ] **Database schema changes:**
  - [ ] No changes needed
  - [ ] New table(s): _______________________
  - [ ] New fields in existing table: _______________________
  - [ ] New indexes: _______________________
  - [ ] **If yes: Increment database version in database.js**

- [ ] **New database methods needed:** _______________________

### Deployment Requirements
- [ ] **Service worker cache update:**
  - [ ] New files to add to `urlsToCache`: _______________________
  - [ ] Increment `CACHE_VERSION` (minor/patch): _______________________

---

## STEP 2: PRE-FLIGHT CHECKLIST

Run the full [pre-flight checklist](pre-flight-checklist.md) before writing any code:

- [ ] **Security validation** (Section 1)
- [ ] **State compatibility** (Section 2)
- [ ] **Modularity compliance** (Section 3)
- [ ] **Event handling patterns** (Section 4)
- [ ] **Service worker & deployment** (Section 5)

**If ANY item fails:** Stop and address before proceeding.

---

## STEP 3: ARCHITECTURE DECISION

### File Size Check
**Current file sizes** (check before modifying):
```powershell
(Get-Content "js/[target-folder]/[target-file].js" | Measure-Object -Line).Lines
```

- [ ] **File size status:**
  - [ ] Under 400 lines → Safe to extend
  - [ ] 400-600 lines → Cautious (consider extracting if feature is >100 lines)
  - [ ] Over 600 lines → MUST extract to new module

### Module Strategy Decision

#### Option A: Extend Existing File
**Choose if:**
- Feature adds < 100 lines
- Target file is < 500 lines
- Feature is tightly coupled to existing class

**Action:**
- [ ] Verify file ownership (correct class per file structure)
- [ ] Add JSDoc to new methods
- [ ] Update file header if responsibilities change

---

#### Option B: Create New Module
**Choose if:**
- Feature adds > 100 lines
- Target file is > 500 lines
- Feature is loosely coupled (can stand alone)
- Feature represents a new domain/responsibility

**Action:**
- [ ] **File path:** `js/[core|ui|templates]/[feature-name].js`
- [ ] **Class name:** `export class [FeatureName]`
- [ ] **Constructor signature:** `constructor(security, db, ...otherDeps)`
- [ ] **Follow dependency injection pattern**

**New Module Checklist:**
- [ ] Create file with comprehensive header
- [ ] Export single class
- [ ] Add JSDoc to constructor
- [ ] Add JSDoc to all public methods
- [ ] Import in main.js or parent module
- [ ] Pass dependencies via constructor
- [ ] Add to service worker `urlsToCache`

---

## STEP 4: IMPLEMENTATION

### 4A: Core Logic Implementation

- [ ] **Create/modify core files:**
  - [ ] File 1: _______________________
  - [ ] File 2: _______________________
  - [ ] File 3: _______________________

- [ ] **Add comprehensive JSDoc:**
```javascript
/**
 * [Feature description]
 * 
 * @class FeatureName
 * @param {SecurityManager} security - Encryption operations
 * @param {DatabaseManager} db - Database persistence
 * @param {OtherDep} otherDep - Description
 */
export class FeatureName {
    constructor(security, db, otherDep) {
        /** @type {SecurityManager} */
        this.security = security;
        /** @type {DatabaseManager} */
        this.db = db;
        /** @type {OtherDep} */
        this.otherDep = otherDep;
    }
    
    /**
     * Method description
     * @param {string} param1 - Description
     * @param {number} param2 - Description
     * @returns {Promise<boolean>} Description of return value
     */
    async myMethod(param1, param2) {
        // STATE GUARD: Requires unlocked state for decryption
        if (!this.security.encryptionKey) {
            console.error('Cannot proceed: Encryption key not available');
            return false;
        }
        
        // Implementation
    }
}
```

- [ ] **Implement state guards:**
```javascript
// SECURITY: Check encryption key before decrypt operations
if (!this.security.encryptionKey) {
    console.error('[Context]: App must be unlocked');
    return; // or throw Error
}
```

- [ ] **Add encryption/decryption:**
```javascript
// SECURITY: Encrypt before database save
const encrypted = await this.security.encrypt(plaintext);
await this.db.saveRecord({ encrypted_field: encrypted });

// SECURITY: Decrypt after database fetch
const record = await this.db.getRecord(id);
const plaintext = await this.security.decrypt(record.encrypted_field);
```

- [ ] **Follow event listener patterns:**
```javascript
// ✅ CORRECT: Attach listeners AFTER innerHTML
container.innerHTML = '<button id="my-btn">Click</button>';
document.getElementById('my-btn').addEventListener('click', this.handleClick.bind(this));

// ❌ WRONG: Listener before element exists
document.getElementById('my-btn').addEventListener('click', handler);
container.innerHTML = '<button id="my-btn">Click</button>';
```

- [ ] **Add error handling:**
```javascript
try {
    // Risky operation
} catch (error) {
    console.error('Error in [feature]:', error);
    // Show user-friendly error
    alert('Failed to [action]. Please try again.');
}
```

---

### 4B: UI Implementation (if applicable)

- [ ] **Create/modify UI files:**
  - [ ] UI file: _______________________
  - [ ] Template file: _______________________
  - [ ] CSS updates: _______________________

- [ ] **Tab context check (if tab-specific):**
```javascript
render() {
    // Only render if correct tab is active
    if (this.currentTab !== 'targetTab') return;
    
    // Render UI
}
```

- [ ] **Class management:**
```javascript
// Use .active class system consistently
tabs.forEach(tab => tab.classList.remove('active'));
currentTab.classList.add('active');

// ❌ AVOID mixing .active and .hidden
```

- [ ] **Icon initialization:**
```javascript
// After innerHTML updates with Lucide icons
if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}
```

---

### 4C: Integration

- [ ] **Update main.js (if new module):**
```javascript
import { FeatureName } from './js/[path]/feature-name.js';

// In constructor or appropriate place
this.featureName = new FeatureName(this.security, this.db, ...deps);

// Pass to dependent modules
this.ui = new UIManager(this.security, this.db, this.featureName);
```

- [ ] **Update parent module dependencies:**
```javascript
// If feature is injected into existing module
class ExistingModule {
    constructor(security, db, featureName) {
        this.featureName = featureName; // NEW
    }
}
```

- [ ] **Update service worker:**
```javascript
// sw.js
const CACHE_VERSION = 'v2.[X+1].0'; // Increment minor version
const urlsToCache = [
    // ... existing files
    '/js/[path]/feature-name.js', // NEW
];
```

---

## STEP 5: TESTING CHECKLIST

### State Testing
- [ ] **Setup state:**
  - [ ] Feature behavior correct (or disabled/hidden)
  - [ ] No errors in console

- [ ] **Locked state:**
  - [ ] Feature shows appropriate error/disabled state
  - [ ] No decrypt attempts (would throw error)
  - [ ] Graceful degradation

- [ ] **Unlocked state:**
  - [ ] Feature works as expected
  - [ ] Decryption successful
  - [ ] Data displays correctly

### Security Testing
- [ ] **Encryption verification:**
  - [ ] Open IndexedDB in DevTools
  - [ ] Verify NO plain-text financial data visible
  - [ ] All sensitive fields are Base64 strings

- [ ] **State guard verification:**
  - [ ] Lock app while feature is visible
  - [ ] Verify decrypt operations fail gracefully
  - [ ] No application crash

### Functionality Testing
- [ ] **Happy path:**
  - [ ] Primary use case works end-to-end
  - [ ] Data saves correctly
  - [ ] UI updates properly

- [ ] **Edge cases:**
  - [ ] Empty data (0 items)
  - [ ] Single item
  - [ ] Many items (100+)
  - [ ] Invalid input
  - [ ] Duplicate data

- [ ] **Error scenarios:**
  - [ ] Network failure (if applicable)
  - [ ] Invalid data format
  - [ ] Missing dependencies
  - [ ] User cancels action

### UI/UX Testing
- [ ] **Event listeners:**
  - [ ] All buttons work
  - [ ] Forms submit correctly
  - [ ] No "undefined is not a function" errors

- [ ] **Visual:**
  - [ ] Layout looks correct
  - [ ] Icons render (Lucide)
  - [ ] Mobile responsive (if applicable)
  - [ ] No visual regressions

### Service Worker Testing
- [ ] **Cache update:**
  - [ ] Hard refresh (Ctrl+Shift+R)
  - [ ] Check console for SW update message
  - [ ] Verify new version active
  - [ ] Feature loads correctly after update

- [ ] **Offline capability (if applicable):**
  - [ ] Disconnect network
  - [ ] Feature still works (if designed for offline)

---

## STEP 6: DOCUMENTATION

### Code Documentation
- [ ] **JSDoc added:**
  - [ ] Class-level JSDoc with @class
  - [ ] Constructor JSDoc with @param for all parameters
  - [ ] Method JSDoc with @param and @returns
  - [ ] Inline comments for complex logic

- [ ] **File header added/updated:**
```javascript
/**
 * [Feature Name] - [One-line description]
 * 
 * PURPOSE: [Detailed purpose]
 * DEPENDS ON: [List dependencies]
 * EXPORTS: [What this file exports]
 * STATE REQUIREMENT: [Setup/Locked/Unlocked/All]
 * 
 * KEY RESPONSIBILITIES:
 * - [Responsibility 1]
 * - [Responsibility 2]
 * 
 * RELATED FILES:
 * - [file1.js] (description)
 * - [file2.js] (description)
 * 
 * @module [ModuleName]
 */
```

### Project Documentation
- [ ] **Update /docs/api-contracts.md (if public API changed):**
  - [ ] Add new methods to appropriate section
  - [ ] Include parameters, returns, examples
  - [ ] Document error conditions

- [ ] **Update /docs/data-flow-diagrams.md (if complex feature):**
  - [ ] Add flow diagram for feature
  - [ ] List classes involved
  - [ ] Document state requirements
  - [ ] Add sequence diagram if multi-step

- [ ] **Update /docs/module-dependencies.md (if new module):**
  - [ ] Add module to dependency tree
  - [ ] Document what it depends on
  - [ ] Document what depends on it

- [ ] **Update /.github/copilot-instructions.md (if architectural change):**
  - [ ] Add to file structure section
  - [ ] Update line counts
  - [ ] Add to relevant workflow rules

### Bug Prevention Documentation
- [ ] **Add to /docs/lessons-learned.md (if issues encountered):**
  - [ ] Document the issue
  - [ ] Root cause
  - [ ] Solution applied
  - [ ] Prevention pattern

---

## STEP 7: DEPLOYMENT PREPARATION

### Pre-Deployment Checklist
- [ ] **Service worker updated:**
  - [ ] `CACHE_VERSION` incremented
  - [ ] New files added to `urlsToCache`
  - [ ] No console errors on load

- [ ] **No breaking changes:**
  - [ ] Existing features still work
  - [ ] No regressions in other modules
  - [ ] Backward compatible (if applicable)

- [ ] **File size compliance:**
  - [ ] All modified files under 800 lines
  - [ ] No files between 600-800 lines (warning zone)

- [ ] **Code quality:**
  - [ ] No console.log() left in production code
  - [ ] No commented-out code blocks
  - [ ] Consistent formatting

### iOS Safari Testing (if UI changes)
- [ ] **Test on iPhone/iPad:**
  - [ ] Layout renders correctly
  - [ ] Touch targets are adequate (44px minimum)
  - [ ] No zoom on input focus (font-size >= 16px)
  - [ ] Safe area insets respected
  - [ ] Bottom nav doesn't scroll away

---

## STEP 8: POST-IMPLEMENTATION REVIEW

### Self-Review Questions
- [ ] Does this follow the zero-knowledge security model?
- [ ] Would another developer understand this code?
- [ ] Is this the simplest solution that works?
- [ ] Did I add appropriate comments for complex logic?
- [ ] Are there any TODOs or FIXMEs that should be addressed?

### Performance Considerations
- [ ] Does this decrypt efficiently (batch operations if possible)?
- [ ] Are there any unnecessary re-renders?
- [ ] Are large datasets handled with pagination?
- [ ] Is caching used appropriately?

### Maintenance Considerations
- [ ] Is this feature testable?
- [ ] Can this be easily modified in the future?
- [ ] Are dependencies loosely coupled?
- [ ] Is error handling comprehensive?

---

## COMMON PATTERNS QUICK REFERENCE

### State Guard Pattern
```javascript
if (!this.security.encryptionKey) {
    console.error('Cannot [action]: App is locked');
    return;
}
```

### Encryption Pattern
```javascript
// Encrypt before save
const encrypted = await this.security.encrypt(plaintext);
await this.db.saveRecord({ encrypted_field: encrypted });
```

### Decryption Pattern
```javascript
// Decrypt after fetch
const record = await this.db.getRecord(id);
const plaintext = await this.security.decrypt(record.encrypted_field);
```

### Event Listener Pattern
```javascript
// After innerHTML
container.innerHTML = '[HTML]';
document.getElementById('btn').addEventListener('click', handler);
```

### Tab-Specific Rendering Pattern
```javascript
if (this.currentTab !== 'targetTab') return;
// Render tab-specific content
```

### Category-Aware Amount Display
```javascript
const category = await this.db.getCategory(categoryId);
const isIncome = category.type === 'Income';
const displayAmount = isIncome ? Math.abs(amount) : amount;
```

---

## TROUBLESHOOTING

**Issue: "Encryption key not initialized"**
- Check: Is feature running in unlocked state?
- Fix: Add state guard before decrypt operations

**Issue: "Element is null" when adding event listener**
- Check: Is innerHTML set before addEventListener?
- Fix: Move listener attachment after DOM creation

**Issue: Service worker not updating**
- Check: Did you increment CACHE_VERSION?
- Fix: Increment version and hard refresh

**Issue: Wrong amount sign displayed**
- Check: Are you checking category.type?
- Fix: Use category-aware amount display pattern

**Issue: Feature works but shows plain-text in database**
- Check: Did you encrypt before db.save()?
- Fix: Wrap all sensitive data in security.encrypt()

---

**Template Version:** 1.0  
**Last Updated:** 2025-12-30  
**Maintainer:** Review after every major feature to keep current
