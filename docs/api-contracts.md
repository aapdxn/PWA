# API Contracts - Internal Module Interfaces

**Purpose:** Definitive reference for all public methods in core classes  
**Last Updated:** 2025-12-30  
**Version:** 1.0

---

## SecurityManager (`js/core/security.js`)

**Purpose:** Zero-knowledge encryption using Web Crypto API (AES-GCM 256-bit)  
**State:** Stateful - maintains encryption key in memory during unlocked state  
**Dependencies:** None (uses browser Web Crypto API)

### Properties

#### `encryptionKey: CryptoKey | null`
- **Type:** CryptoKey (Web Crypto API) or null
- **Purpose:** AES-GCM encryption key derived from password
- **Lifecycle:** null when locked, CryptoKey when unlocked
- **Security:** Exists ONLY in memory, never persisted

#### `iterations: number`
- **Type:** number
- **Value:** 100000
- **Purpose:** PBKDF2 iteration count for key derivation
- **Security:** Higher values = more secure, slower performance

---

### Methods

#### `deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>`
**Purpose:** Derives AES-GCM encryption key from password using PBKDF2  
**Parameters:**
- `password` - User's master password (plain text)
- `salt` - 16-byte random salt (Uint8Array)

**Returns:** Promise<CryptoKey> - AES-GCM 256-bit key  
**Throws:** None  
**Usage:**
```javascript
const salt = window.crypto.getRandomValues(new Uint8Array(16));
const key = await security.deriveKey('myPassword', salt);
```

---

#### `createPasswordHash(password: string): Promise<{hash: string, salt: string}>`
**Purpose:** Creates PBKDF2 hash of password for verification (NOT for encryption)  
**Parameters:**
- `password` - User's master password

**Returns:** Promise<Object>
```javascript
{
    hash: string,  // Base64-encoded 256-bit hash
    salt: string   // Base64-encoded 16-byte salt
}
```

**Throws:** None  
**Storage:** Store both hash and salt in database (settings table)  
**Usage:**
```javascript
const { hash, salt } = await security.createPasswordHash('myPassword');
await db.saveSetting('password_hash', hash);
await db.saveSetting('password_salt', salt);
```

---

#### `verifyPassword(password: string, storedHash: string, storedSalt: string): Promise<boolean>`
**Purpose:** Verifies entered password against stored hash  
**Parameters:**
- `password` - User's entered password
- `storedHash` - Base64 hash from database
- `storedSalt` - Base64 salt from database

**Returns:** Promise<boolean> - true if password matches, false otherwise  
**Throws:** None  
**Usage:**
```javascript
const isValid = await security.verifyPassword(
    enteredPassword,
    storedHash,
    storedSalt
);
if (isValid) {
    // Proceed to unlock
}
```

---

#### `initializeEncryption(password: string, salt: string | Uint8Array): Promise<void>`
**Purpose:** Derives encryption key from password and stores in memory  
**State Change:** Sets `this.encryptionKey` (transitions to unlocked state)  
**Parameters:**
- `password` - User's master password
- `salt` - Base64 string or Uint8Array (16 bytes)

**Returns:** Promise<void>  
**Throws:** None  
**Postconditions:** `this.encryptionKey` is populated, app is unlocked  
**Usage:**
```javascript
// After password verification succeeds
await security.initializeEncryption(password, storedSalt);
// Now encrypt/decrypt operations are available
```

---

#### `encrypt(plaintext: string): Promise<string>`
**Purpose:** Encrypts plain text using AES-GCM with current encryption key  
**Preconditions:** `this.encryptionKey` must be initialized (unlocked state)  
**Parameters:**
- `plaintext` - String to encrypt (financial data, descriptions, etc.)

**Returns:** Promise<string> - Base64-encoded encrypted data (includes IV)  
**Throws:** Error if `encryptionKey` is null  
**Security:** Each encryption uses random 12-byte IV (nonce)  
**Usage:**
```javascript
// STATE GUARD: Requires unlocked state
if (!security.encryptionKey) {
    throw new Error('App must be unlocked');
}

const encrypted = await security.encrypt('My Transaction Description');
await db.saveTransaction({
    encrypted_description: encrypted,
    // ...other encrypted fields
});
```

---

#### `decrypt(ciphertext: string): Promise<string>`
**Purpose:** Decrypts AES-GCM encrypted text  
**Preconditions:** `this.encryptionKey` must be initialized (unlocked state)  
**Parameters:**
- `ciphertext` - Base64-encoded encrypted string (from database)

**Returns:** Promise<string> - Decrypted plain text  
**Throws:** 
- Error if `encryptionKey` is null
- Error if ciphertext is invalid/corrupted

**Usage:**
```javascript
// STATE GUARD: Requires unlocked state
if (!security.encryptionKey) {
    console.error('Cannot decrypt: App is locked');
    return;
}

const description = await security.decrypt(transaction.encrypted_description);
console.log(description); // "My Transaction Description"
```

---

#### `arrayBufferToBase64(buffer: ArrayBuffer): string`
**Purpose:** Converts ArrayBuffer to Base64 string  
**Parameters:**
- `buffer` - ArrayBuffer or Uint8Array

**Returns:** string - Base64-encoded data  
**Throws:** None  
**Usage:** Internal helper, typically not called directly

---

#### `base64ToArrayBuffer(base64: string): Uint8Array`
**Purpose:** Converts Base64 string to Uint8Array  
**Parameters:**
- `base64` - Base64-encoded string

**Returns:** Uint8Array  
**Throws:** None  
**Usage:** Internal helper, typically not called directly

---

#### `clearEncryptionKey(): void`
**Purpose:** Clears encryption key from memory (locks app)  
**State Change:** Sets `this.encryptionKey` to null (transitions to locked state)  
**Returns:** void  
**Postconditions:** All decrypt operations will fail until re-initialized  
**Usage:**
```javascript
// When user clicks lock button
security.clearEncryptionKey();
// App is now locked, must enter password again
```

---

## DatabaseManager (`js/core/database.js`)

**Purpose:** IndexedDB persistence layer using Dexie.js  
**State:** Stateless (no encryption key stored here)  
**Dependencies:** Dexie (global CDN variable)  
**Database Name:** VaultBudget  
**Current Version:** 9

### Database Schema

```javascript
{
    settings: 'key',  // Primary key: key (string)
    categories: '++id, type',  // Auto-increment id, indexed by type
    payees: '++id',  // Auto-increment id
    transactions: '++id, categoryId, payeeId, encrypted_linkedTransactionId',
    mappings_accounts: 'account_number',  // Primary key: account_number
    mappings_descriptions: 'description',  // Primary key: description
    category_budgets: '[categoryId+month]'  // Compound primary key
}
```

### Object Schemas

#### Settings
```javascript
{
    key: string,      // Primary key (e.g., 'password_hash', 'password_salt')
    value: any        // Any JSON-serializable value
}
```

#### Category
```javascript
{
    id: number,               // Auto-generated
    encrypted_name: string,   // Base64 encrypted name
    encrypted_limit: string | null,  // Base64 encrypted monthly limit (optional)
    type: 'Income' | 'Expense' | 'Saving'  // Category type (plain text)
}
```

#### Payee
```javascript
{
    id: number,               // Auto-generated
    encrypted_name: string    // Base64 encrypted payee name
}
```

#### Transaction
```javascript
{
    id: number,                          // Auto-generated
    encrypted_date: string,              // Base64 encrypted YYYY-MM-DD
    encrypted_amount: string,            // Base64 encrypted number
    encrypted_description: string,       // Base64 encrypted description
    encrypted_account: string,           // Base64 encrypted account number
    categoryId: number | null,           // Foreign key to categories (null for Transfer)
    payeeId: number | null,              // Foreign key to payees (nullable)
    encrypted_note: string | null,       // Base64 encrypted note (optional)
    encrypted_linkedTransactionId: string | null,  // For Transfer type linking
    useAutoCategory: boolean,            // Use mapping for category resolution
    useAutoPayee: boolean                // Use mapping for payee resolution
}
```

#### MappingAccount
```javascript
{
    account_number: string,   // Primary key (plain text)
    encrypted_name: string    // Base64 encrypted friendly name
}
```

#### MappingDescription
```javascript
{
    description: string,         // Primary key (plain text)
    encrypted_category: string,  // Base64 encrypted category name
    encrypted_payee: string      // Base64 encrypted payee name
}
```

#### CategoryBudget
```javascript
{
    categoryId: number,          // Part of compound key
    month: string,               // Part of compound key (YYYY-MM format)
    encrypted_limit: string      // Base64 encrypted budget limit
}
```

---

### Settings Methods

#### `getSetting(key: string): Promise<Object | null>`
**Purpose:** Retrieve setting by key  
**Parameters:**
- `key` - Setting name (e.g., 'password_hash')

**Returns:** Promise<{key, value}> or null if not found  
**Example:**
```javascript
const setting = await db.getSetting('password_hash');
if (setting) {
    const hash = setting.value;
}
```

---

#### `saveSetting(key: string, value: any): Promise<void>`
**Purpose:** Save or update a setting  
**Parameters:**
- `key` - Setting name
- `value` - Any JSON-serializable value

**Returns:** Promise<void>  
**Example:**
```javascript
await db.saveSetting('password_hash', hashValue);
await db.saveSetting('last_backup', new Date().toISOString());
```

---

### Category Methods

#### `getAllCategories(): Promise<Category[]>`
**Purpose:** Get all categories  
**Returns:** Promise<Category[]> - Array of category objects  
**Note:** encrypted_name and encrypted_limit require decryption  
**Example:**
```javascript
const categories = await db.getAllCategories();
for (const cat of categories) {
    const name = await security.decrypt(cat.encrypted_name);
    console.log(`${cat.type}: ${name}`);
}
```

---

#### `getCategory(id: number): Promise<Category | undefined>`
**Purpose:** Get single category by ID  
**Parameters:**
- `id` - Category ID

**Returns:** Promise<Category> or undefined if not found  
**Example:**
```javascript
const category = await db.getCategory(5);
if (category) {
    const name = await security.decrypt(category.encrypted_name);
}
```

---

#### `saveCategory(category: Category): Promise<number>`
**Purpose:** Create new or update existing category  
**Parameters:**
- `category` - Category object (with or without id)

**Returns:** Promise<number> - Category ID  
**Behavior:**
- If `category.id` exists → Updates existing
- If no `category.id` → Creates new

**Example:**
```javascript
// Create new
const newId = await db.saveCategory({
    encrypted_name: await security.encrypt('Groceries'),
    encrypted_limit: await security.encrypt('500'),
    type: 'Expense'
});

// Update existing
await db.saveCategory({
    id: 5,
    encrypted_name: await security.encrypt('Groceries Updated'),
    encrypted_limit: await security.encrypt('600'),
    type: 'Expense'
});
```

---

#### `deleteCategory(id: number): Promise<void>`
**Purpose:** Delete a category  
**Parameters:**
- `id` - Category ID to delete

**Returns:** Promise<void>  
**Warning:** Does NOT cascade delete transactions (check orphans first)  
**Example:**
```javascript
// Check for orphaned transactions first
const txns = await db.getTransactionsByCategory(categoryId);
if (txns.length > 0) {
    // Reassign transactions or prevent deletion
}
await db.deleteCategory(categoryId);
```

---

### Payee Methods

#### `getAllPayees(): Promise<Payee[]>`
**Purpose:** Get all payees  
**Returns:** Promise<Payee[]>  
**Example:**
```javascript
const payees = await db.getAllPayees();
for (const payee of payees) {
    const name = await security.decrypt(payee.encrypted_name);
}
```

---

#### `getPayee(id: number): Promise<Payee | undefined>`
**Purpose:** Get single payee by ID  
**Parameters:**
- `id` - Payee ID

**Returns:** Promise<Payee> or undefined

---

#### `savePayee(payee: Payee): Promise<number>`
**Purpose:** Create new or update existing payee  
**Parameters:**
- `payee` - Payee object (with or without id)

**Returns:** Promise<number> - Payee ID  
**Example:**
```javascript
const payeeId = await db.savePayee({
    encrypted_name: await security.encrypt('Amazon')
});
```

---

#### `deletePayee(id: number): Promise<void>`
**Purpose:** Delete a payee  
**Parameters:**
- `id` - Payee ID

**Returns:** Promise<void>  
**Warning:** Does NOT cascade delete (check transactions first)

---

### Transaction Methods

#### `getAllTransactions(): Promise<Transaction[]>`
**Purpose:** Get all transactions  
**Returns:** Promise<Transaction[]> - All transactions (encrypted)  
**Performance:** Can return thousands of records - consider filtering  
**Example:**
```javascript
const allTxns = await db.getAllTransactions();
// Decrypt as needed
for (const txn of allTxns) {
    const date = await security.decrypt(txn.encrypted_date);
    const amount = parseFloat(await security.decrypt(txn.encrypted_amount));
}
```

---

#### `getTransaction(id: number): Promise<Transaction | undefined>`
**Purpose:** Get single transaction by ID  
**Parameters:**
- `id` - Transaction ID

**Returns:** Promise<Transaction> or undefined

---

#### `saveTransaction(transaction: Transaction): Promise<number>`
**Purpose:** Create new or update existing transaction  
**Parameters:**
- `transaction` - Transaction object (with or without id)

**Returns:** Promise<number> - Transaction ID  
**Behavior:**
- If `transaction.id` exists → Replaces entire record (put)
- If no `transaction.id` → Creates new

**Important:** Uses `put()` not `update()` - fields not in object are removed  
**Example:**
```javascript
// SECURITY: Encrypt all fields before saving
const txnId = await db.saveTransaction({
    encrypted_date: await security.encrypt('2025-12-30'),
    encrypted_amount: await security.encrypt('-50.00'),
    encrypted_description: await security.encrypt('Grocery Store'),
    encrypted_account: await security.encrypt('1234'),
    categoryId: 5,
    payeeId: 10,
    encrypted_note: null,
    encrypted_linkedTransactionId: null,
    useAutoCategory: false,
    useAutoPayee: false
});
```

---

#### `deleteTransaction(id: number): Promise<void>`
**Purpose:** Delete a transaction  
**Parameters:**
- `id` - Transaction ID

**Returns:** Promise<void>  
**Example:**
```javascript
await db.deleteTransaction(transactionId);
```

---

#### `getTransactionsByCategory(categoryId: number): Promise<Transaction[]>`
**Purpose:** Get all transactions for a specific category  
**Parameters:**
- `categoryId` - Category ID

**Returns:** Promise<Transaction[]> - Filtered transactions  
**Use Case:** Check for orphaned transactions before deleting category  
**Example:**
```javascript
const txns = await db.getTransactionsByCategory(5);
console.log(`Category has ${txns.length} transactions`);
```

---

#### `bulkAddTransactions(transactions: Transaction[]): Promise<any>`
**Purpose:** Efficiently add multiple transactions at once  
**Parameters:**
- `transactions` - Array of transaction objects (all encrypted)

**Returns:** Promise (Dexie bulkAdd result)  
**Performance:** Much faster than individual adds for CSV import  
**Example:**
```javascript
const transactionsToImport = [/* ...encrypted transactions */];
await db.bulkAddTransactions(transactionsToImport);
```

---

### Mapping Methods

#### `getAllMappingsAccounts(): Promise<MappingAccount[]>`
**Purpose:** Get all account number → name mappings  
**Returns:** Promise<MappingAccount[]>  
**Example:**
```javascript
const mappings = await db.getAllMappingsAccounts();
for (const mapping of mappings) {
    const friendlyName = await security.decrypt(mapping.encrypted_name);
    console.log(`${mapping.account_number}: ${friendlyName}`);
}
```

---

#### `getAllMappingsDescriptions(): Promise<MappingDescription[]>`
**Purpose:** Get all description → category/payee mappings  
**Returns:** Promise<MappingDescription[]>  
**Example:**
```javascript
const mappings = await db.getAllMappingsDescriptions();
```

---

#### `setMappingAccount(accountNumber: string, encryptedName: string): Promise<void>`
**Purpose:** Create or update account number mapping  
**Parameters:**
- `accountNumber` - Plain text account number (e.g., '1234')
- `encryptedName` - Base64 encrypted friendly name

**Returns:** Promise<void>  
**Example:**
```javascript
await db.setMappingAccount(
    '1234',
    await security.encrypt('Chase Checking')
);
```

---

#### `setMappingDescription(description: string, encryptedCategory: string, encryptedPayee: string): Promise<void>`
**Purpose:** Create or update description → category/payee mapping  
**Parameters:**
- `description` - Plain text description (e.g., 'AMAZON.COM')
- `encryptedCategory` - Base64 encrypted category name
- `encryptedPayee` - Base64 encrypted payee name (can be empty string)

**Returns:** Promise<void>  
**Example:**
```javascript
await db.setMappingDescription(
    'AMAZON.COM',
    await security.encrypt('Shopping'),
    await security.encrypt('Amazon')
);
```

---

#### `deleteMappingDescription(description: string): Promise<void>`
**Purpose:** Delete a description mapping  
**Parameters:**
- `description` - Plain text description

**Returns:** Promise<void>

---

#### `getMappingAccount(accountNumber: string): Promise<MappingAccount | undefined>`
**Purpose:** Get account mapping by account number  
**Parameters:**
- `accountNumber` - Plain text account number

**Returns:** Promise<MappingAccount> or undefined  
**Example:**
```javascript
const mapping = await db.getMappingAccount('1234');
if (mapping) {
    const name = await security.decrypt(mapping.encrypted_name);
}
```

---

### Budget Methods

#### `getCategoryBudget(categoryId: number, month: string): Promise<CategoryBudget | undefined>`
**Purpose:** Get budget limit for a category in a specific month  
**Parameters:**
- `categoryId` - Category ID
- `month` - Month string in 'YYYY-MM' format

**Returns:** Promise<CategoryBudget> or undefined  
**Example:**
```javascript
const budget = await db.getCategoryBudget(5, '2025-12');
if (budget) {
    const limit = parseFloat(await security.decrypt(budget.encrypted_limit));
}
```

---

#### `setCategoryBudget(categoryId: number, month: string, encryptedLimit: string): Promise<void>`
**Purpose:** Set budget limit for a category in a specific month  
**Parameters:**
- `categoryId` - Category ID
- `month` - Month string in 'YYYY-MM' format
- `encryptedLimit` - Base64 encrypted limit amount

**Returns:** Promise<void>  
**Example:**
```javascript
await db.setCategoryBudget(
    5,
    '2025-12',
    await security.encrypt('500')
);
```

---

#### `getCategoryBudgetsForMonth(month: string): Promise<CategoryBudget[]>`
**Purpose:** Get all category budgets for a specific month  
**Parameters:**
- `month` - Month string in 'YYYY-MM' format

**Returns:** Promise<CategoryBudget[]>  
**Note:** Loads all budgets and filters in memory (no month-only index)  
**Example:**
```javascript
const budgets = await db.getCategoryBudgetsForMonth('2025-12');
```

---

### Utility Methods

#### `clearAllData(): Promise<void>`
**Purpose:** Delete entire database and recreate empty schema  
**Returns:** Promise<void>  
**Warning:** DESTRUCTIVE - deletes all user data  
**Use Case:** Development reset, user-initiated data wipe  
**Example:**
```javascript
// Emergency reset (confirm first!)
if (confirm('Delete ALL data?')) {
    await db.clearAllData();
}
```

---

#### `clearTransactions(): Promise<void>`
**Purpose:** Delete all transactions (keep categories/payees)  
**Returns:** Promise<void>  
**Use Case:** Start fresh with transaction data

---

#### `clearMappings(): Promise<void>`
**Purpose:** Delete all description mappings  
**Returns:** Promise<void>  
**Use Case:** Reset auto-mapping rules

---

## CSVEngine (`js/core/csv-engine.js`)

**Purpose:** CSV import/export coordinator for transactions and mappings  
**State:** Stateless  
**Dependencies:** SecurityManager, DatabaseManager, CSVValidator, CSVMapper, Papa (global)

### Constructor

#### `constructor(securityManager: SecurityManager, databaseManager: DatabaseManager)`
**Purpose:** Initialize CSV engine with dependencies  
**Throws:** Error if Papa (PapaParse) is not loaded

---

### Methods

#### `parseCSV(file: File): Promise<Array<Object>>`
**Purpose:** Parse CSV file using PapaParse library  
**Parameters:**
- `file` - File object from input[type="file"]

**Returns:** Promise<Array<Object>> - Array of row objects (header: value)  
**Configuration:** header=true, skipEmptyLines=true  
**Example:**
```javascript
const file = fileInput.files[0];
const rows = await csvEngine.parseCSV(file);
// rows = [{Date: '2025-12-30', Amount: '-50.00', ...}, ...]
```

---

#### `processTransactionCSV(file: File, formatId: string = 'capital-one-checking'): Promise<ProcessedTransaction[]>`
**Purpose:** Process CSV file and return structured data for review screen  
**Parameters:**
- `file` - CSV file to process
- `formatId` - CSV format identifier (default: 'capital-one-checking')

**Returns:** Promise<ProcessedTransaction[]>  
**ProcessedTransaction Schema:**
```javascript
{
    date: string,                 // YYYY-MM-DD
    description: string,          // Plain text
    amount: number,               // Parsed number
    accountNumber: string,        // Plain text
    accountName: string,          // Decrypted friendly name
    transactionType: string,      // 'debit' or 'credit'
    suggestedCategoryId: number | 'TRANSFER' | null,
    suggestedPayeeId: number | null,
    isDuplicate: boolean,         // True if exact match exists
    originalRow: Object           // Original CSV row data
}
```

**Features:**
- Detects duplicates
- Suggests categories from mappings
- Suggests payees from mappings  
- Creates missing payees automatically
- Resolves account names from mappings

**Example:**
```javascript
const processed = await csvEngine.processTransactionCSV(file, 'capital-one-checking');
// Show in review UI for user confirmation
```

---

#### `importReviewedTransactions(reviewedData: Array<ProcessedTransaction>): Promise<number[]>`
**Purpose:** Import user-reviewed transactions to database  
**Parameters:**
- `reviewedData` - Array of processed transactions after user review

**ReviewedData Expected Properties:**
```javascript
{
    ...ProcessedTransaction,
    skip: boolean,           // User wants to skip this transaction
    categoryId: number,      // User-selected category (overrides suggestion)
    payeeId: number,         // User-selected payee (overrides suggestion)
    saveMapping: boolean     // User wants to save as mapping
}
```

**Returns:** Promise<number[]> - Array of created transaction IDs  
**Behavior:**
- Skips transactions marked `skip` or `isDuplicate`
- Encrypts all fields before saving
- Handles Transfer type (categoryId = null, has linkedTransactionId field)
- Sets `useAutoCategory`/`useAutoPayee` flags based on mapping existence
- Optionally saves new mappings if `saveMapping` is true

**Example:**
```javascript
const importedIds = await csvEngine.importReviewedTransactions(reviewedData);
console.log(`Imported ${importedIds.length} transactions`);
```

---

#### `processMappingsCSV(files: File[]): Promise<ProcessedMapping[]>`
**Purpose:** Process mappings CSV file(s) for review  
**Parameters:**
- `files` - Array of File objects (can handle multiple files)

**Expected CSV Format:**
```
Description,Category,Payee
AMAZON.COM,Shopping,Amazon
SPOTIFY,Subscriptions,Spotify
```

**Returns:** Promise<ProcessedMapping[]>  
**ProcessedMapping Schema:**
```javascript
{
    description: string,      // Plain text description
    payee: string,           // Payee name (can be empty)
    categoryName: string,    // Category name (plain text)
    categoryId: number | 'TRANSFER' | null,  // Resolved category ID
    isDuplicate: boolean,    // Already exists in database
    skip: boolean           // Auto-set to true if duplicate
}
```

**Features:**
- Detects column headers (Description, Category, Payee) or uses first 3 columns
- Case-insensitive category matching
- Handles 'Transfer' as special category type
- Detects duplicates with existing mappings
- Auto-skips duplicates

**Example:**
```javascript
const files = fileInput.files;
const processed = await csvEngine.processMappingsCSV(Array.from(files));
// Show in review UI
```

---

#### `importReviewedMappings(mappingsToImport: Array<ProcessedMapping>): Promise<string[]>`
**Purpose:** Import user-reviewed mappings to database  
**Parameters:**
- `mappingsToImport` - Array of processed mappings after user review

**Returns:** Promise<string[]> - Array of imported descriptions  
**Behavior:**
- Skips items marked `skip` or `isDuplicate`
- Skips items without `categoryId`
- Handles Transfer type mapping (encrypted as 'Transfer')
- Encrypts category and payee names before saving

**Example:**
```javascript
const imported = await csvEngine.importReviewedMappings(mappingsToImport);
console.log(`Imported ${imported.length} mappings`);
```

---

## Usage Patterns

### State Guard Pattern (CRITICAL)
**Always check encryption key before decrypt operations:**

```javascript
async renderFinancialData() {
    // STATE GUARD: Requires unlocked state for decryption
    if (!this.security.encryptionKey) {
        console.error('Cannot render: Encryption key not available');
        return;
    }
    
    // Safe to decrypt
    const transactions = await this.db.getAllTransactions();
    for (const tx of transactions) {
        const amount = await this.security.decrypt(tx.encrypted_amount);
        // ...
    }
}
```

### CRUD Pattern (Create/Update)
**Use same method for create and update:**

```javascript
// Create new category
const newId = await db.saveCategory({
    encrypted_name: await security.encrypt('Groceries'),
    type: 'Expense',
    encrypted_limit: null
});

// Update existing category
await db.saveCategory({
    id: newId,  // Presence of id triggers update
    encrypted_name: await security.encrypt('Groceries & Food'),
    type: 'Expense',
    encrypted_limit: await security.encrypt('500')
});
```

### CSV Import Pattern
**Two-step process: process → review → import:**

```javascript
// Step 1: Process CSV
const file = fileInput.files[0];
const processed = await csvEngine.processTransactionCSV(file);

// Step 2: Show review UI, user modifies data
// (user can change categories, mark as skip, etc.)

// Step 3: Import reviewed data
const imported = await csvEngine.importReviewedTransactions(processed);
```

---

**Document Maintenance:** Update this file when:
- Adding new public methods
- Changing method signatures
- Changing database schema (increment version in database.js)
- Changing encryption algorithm or parameters
