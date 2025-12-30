/**
 * DatabaseManager - IndexedDB operations via Dexie.js
 * 
 * Handles all CRUD operations for encrypted data storage:
 * - Settings (key-value pairs)
 * - Categories (budgets with encrypted names/limits)
 * - Payees (encrypted names)
 * - Transactions (encrypted financial data)
 * - Mappings (account/description to category/payee)
 * - Category Budgets (monthly budget amounts)
 * 
 * SECURITY CONSTRAINTS:
 * - All stored data is ENCRYPTED (encrypted_* fields)
 * - Encryption/decryption handled by SecurityManager
 * - This class only stores/retrieves encrypted data
 * 
 * DEPENDENCIES:
 * - Dexie.js (global CDN variable, loaded in index.html)
 * 
 * @class DatabaseManager
 * @module Core/Database
 * @layer 2 - Core Database (Dexie wrapper)
 */
// SECURITY NOTE: This class stores ONLY encrypted data. All plain-text handling done in UI layer.
export class DatabaseManager {
    /**
     * Initialize DatabaseManager
     * Creates Dexie database instance with schema version 9
     * 
     * @constructor
     * @throws {Error} If Dexie is not loaded (CDN failure)
     */
    constructor() {
        // Use global Dexie variable
        if (typeof Dexie === 'undefined') {
            throw new Error('Dexie is not loaded. Ensure Dexie CDN is loaded in index.html');
        }
        
        this.db = new Dexie('VaultBudget');
        
        this.db.version(9).stores({
            settings: 'key',
            categories: '++id, type',
            payees: '++id',
            transactions: '++id, categoryId, payeeId, encrypted_linkedTransactionId',
            mappings_accounts: 'account_number',
            mappings_descriptions: 'description',
            category_budgets: '[categoryId+month]'
        });
    }

    // ===== SETTINGS =====
    
    /**
     * Get setting by key
     * 
     * @param {string} key - Setting key (e.g., 'password_hash', 'password_salt')
     * @returns {Promise<{key: string, value: any}|null>} Setting record or null
     */
    async getSetting(key) {
        const record = await this.db.settings.get(key);
        return record || null;
    }

    /**
     * Save setting (upsert)
     * 
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     * @returns {Promise<void>}
     */
    async saveSetting(key, value) {
        await this.db.settings.put({ key, value });
    }

    // ===== CATEGORIES =====
    
    /**
     * Get all categories
     * 
     * @returns {Promise<Array<{id: number, encrypted_name: string, encrypted_limit: string, type: string}>>} All categories
     */
    async getAllCategories() {
        return await this.db.categories.toArray();
    }

    /**
     * Get category by ID
     * 
     * @param {number} id - Category ID
     * @returns {Promise<{id: number, encrypted_name: string, encrypted_limit: string, type: string}|undefined>} Category or undefined
     */
    async getCategory(id) {
        return await this.db.categories.get(id);
    }

    /**
     * Save category (create or update)
     * 
     * @param {{id?: number, encrypted_name: string, encrypted_limit: string, type: string}} category - Category object
     * @returns {Promise<number>} Category ID
     */
    async saveCategory(category) {
        if (category.id) {
            await this.db.categories.update(category.id, category);
            return category.id;
        } else {
            return await this.db.categories.add(category);
        }
    }

    /**
     * Delete category by ID
     * 
     * WARNING: Check for linked transactions before deleting to avoid orphans.
     * 
     * @param {number} id - Category ID
     * @returns {Promise<void>}
     */
    async deleteCategory(id) {
        // INTEGRITY WARNING: Check for linked transactions before deletion to prevent orphans
        await this.db.categories.delete(id);
    }

    // ===== PAYEES =====
    
    /**
     * Get all payees
     * 
     * @returns {Promise<Array<{id: number, encrypted_name: string}>>} All payees
     */
    async getAllPayees() {
        return await this.db.payees.toArray();
    }

    /**
     * Get payee by ID
     * 
     * @param {number} id - Payee ID
     * @returns {Promise<{id: number, encrypted_name: string}|undefined>} Payee or undefined
     */
    async getPayee(id) {
        return await this.db.payees.get(id);
    }

    /**
     * Save payee (create or update)
     * 
     * @param {{id?: number, encrypted_name: string}} payee - Payee object
     * @returns {Promise<number>} Payee ID
     */
    async savePayee(payee) {
        if (payee.id) {
            await this.db.payees.update(payee.id, payee);
            return payee.id;
        } else {
            return await this.db.payees.add(payee);
        }
    }

    /**
     * Deletes a payee by ID
     * 
     * @param {number} id - Payee ID to delete
     * @returns {Promise<void>}
     */
    async deletePayee(id) {
        await this.db.payees.delete(id);
    }

    // ===== TRANSACTIONS =====
    
    /**
     * Retrieves all transactions from the database
     * 
     * @returns {Promise<Array<{id?: number, encrypted_date: string, encrypted_amount: string, encrypted_description: string, encrypted_account: string, categoryId: number, payeeId: number, encrypted_note?: string, encrypted_linkedTransactionId?: string, useAutoCategory?: boolean, useAutoPayee?: boolean}>>} Array of encrypted transaction objects
     */
    async getAllTransactions() {
        return await this.db.transactions.toArray();
    }

    /**
     * Retrieves a single transaction by ID
     * 
     * @param {number} id - Transaction ID
     * @returns {Promise<{id?: number, encrypted_date: string, encrypted_amount: string, encrypted_description: string, encrypted_account: string, categoryId: number, payeeId: number, encrypted_note?: string, encrypted_linkedTransactionId?: string, useAutoCategory?: boolean, useAutoPayee?: boolean}|undefined>} Encrypted transaction object or undefined if not found
     */
    async getTransaction(id) {
        return await this.db.transactions.get(id);
    }

    /**
     * Saves a transaction (creates new or updates existing)
     * 
     * Uses put() to replace the entire record, ensuring fields not in the transaction object are removed.
     * 
     * @param {{id?: number, encrypted_date: string, encrypted_amount: string, encrypted_description: string, encrypted_account: string, categoryId: number, payeeId: number, encrypted_note?: string, encrypted_linkedTransactionId?: string, useAutoCategory?: boolean, useAutoPayee?: boolean}} transaction - Encrypted transaction object
     * @returns {Promise<number>} Transaction ID
     */
    async saveTransaction(transaction) {
        if (transaction.id) {
            // Use put() instead of update() to replace the entire record
            // This ensures fields not in the transaction object are removed
            await this.db.transactions.put(transaction);
            return transaction.id;
        } else {
            return await this.db.transactions.add(transaction);
        }
    }

    /**
     * Deletes a transaction by ID
     * 
     * @param {number} id - Transaction ID to delete
     * @returns {Promise<void>}
     */
    async deleteTransaction(id) {
        await this.db.transactions.delete(id);
    }

    /**
     * Retrieves all transactions for a specific category
     * 
     * @param {number} categoryId - Category ID to filter by
     * @returns {Promise<Array<{id?: number, encrypted_date: string, encrypted_amount: string, encrypted_description: string, encrypted_account: string, categoryId: number, payeeId: number, encrypted_note?: string, encrypted_linkedTransactionId?: string, useAutoCategory?: boolean, useAutoPayee?: boolean}>>} Array of encrypted transaction objects
     */
    async getTransactionsByCategory(categoryId) {
        return await this.db.transactions.where('categoryId').equals(categoryId).toArray();
    }

    // ===== MAPPINGS =====
    
    /**
     * Retrieves all account mappings
     * 
     * @returns {Promise<Array<{account_number: string, encrypted_name: string}>>} Array of encrypted account mappings
     */
    async getAllMappingsAccounts() {
        return await this.db.mappings_accounts.toArray();
    }

    /**
     * Retrieves all description mappings
     * 
     * @returns {Promise<Array<{description: string, encrypted_category: string, encrypted_payee: string}>>} Array of encrypted description mappings
     */
    async getAllMappingsDescriptions() {
        return await this.db.mappings_descriptions.toArray();
    }

    /**
     * Creates or updates an account mapping
     * 
     * @param {string} accountNumber - Account number (primary key)
     * @param {string} encryptedName - Encrypted account name
     * @returns {Promise<void>}
     */
    async setMappingAccount(accountNumber, encryptedName) {
        await this.db.mappings_accounts.put({
            account_number: accountNumber,
            encrypted_name: encryptedName
        });
    }

    /**
     * Creates or updates a description mapping
     * 
     * @param {string} description - Transaction description (primary key)
     * @param {string} encryptedCategory - Encrypted category name
     * @param {string} encryptedPayee - Encrypted payee name
     * @returns {Promise<void>}
     */
    async setMappingDescription(description, encryptedCategory, encryptedPayee) {
        await this.db.mappings_descriptions.put({
            description: description,
            encrypted_category: encryptedCategory,
            encrypted_payee: encryptedPayee
        });
    }

    /**
     * Deletes a description mapping by description key
     * 
     * @param {string} description - Description key to delete
     * @returns {Promise<void>}
     */
    async deleteMappingDescription(description) {
        await this.db.mappings_descriptions.delete(description);
    }

    /**
     * Retrieves an account mapping by account number
     * 
     * @param {string} accountNumber - Account number to look up
     * @returns {Promise<{account_number: string, encrypted_name: string}|undefined>} Encrypted account mapping or undefined if not found
     */
    async getMappingAccount(accountNumber) {
        return await this.db.mappings_accounts.get(accountNumber);
    }

    // ===== CATEGORY BUDGETS =====
    
    /**
     * Retrieves a category budget for a specific category and month
     * 
     * @param {number} categoryId - Category ID
     * @param {string} month - Month in YYYY-MM format
     * @returns {Promise<{categoryId: number, month: string, encrypted_limit: string}|undefined>} Encrypted budget object or undefined if not found
     */
    async getCategoryBudget(categoryId, month) {
        return await this.db.category_budgets.get([categoryId, month]);
    }

    /**
     * Creates or updates a category budget
     * 
     * @param {number} categoryId - Category ID
     * @param {string} month - Month in YYYY-MM format
     * @param {string} encryptedLimit - Encrypted budget limit
     * @returns {Promise<void>}
     */
    async setCategoryBudget(categoryId, month, encryptedLimit) {
        await this.db.category_budgets.put({
            categoryId: categoryId,
            month: month,
            encrypted_limit: encryptedLimit
        });
    }

    /**
     * Retrieves all category budgets for a specific month
     * 
     * Note: Can't query by month alone since it's a compound key [categoryId+month].
     * Gets all budgets and filters in memory.
     * 
     * @param {string} month - Month in YYYY-MM format
     * @returns {Promise<Array<{categoryId: number, month: string, encrypted_limit: string}>>} Array of encrypted budget objects
     */
    async getCategoryBudgetsForMonth(month) {
        // Can't query by month alone since it's a compound key [categoryId+month]
        // Get all and filter in memory
        const allBudgets = await this.db.category_budgets.toArray();
        return allBudgets.filter(b => b.month === month);
    }

    // ===== BULK OPERATIONS =====
    
    /**
     * Bulk adds multiple transactions in a single operation
     * 
     * @param {Array<{id?: number, encrypted_date: string, encrypted_amount: string, encrypted_description: string, encrypted_account: string, categoryId: number, payeeId: number, encrypted_note?: string, encrypted_linkedTransactionId?: string, useAutoCategory?: boolean, useAutoPayee?: boolean}>} transactions - Array of encrypted transaction objects
     * @returns {Promise<number>} Last inserted ID
     */
    async bulkAddTransactions(transactions) {
        return await this.db.transactions.bulkAdd(transactions);
    }

    /**
     * Clears all data by deleting and reopening the database
     * 
     * WARNING: This permanently deletes all data including settings, categories, payees, transactions, mappings, and budgets.
     * 
     * @returns {Promise<void>}
     */
    async clearAllData() {
        await this.db.delete();
        await this.db.open();
    }

    /**
     * Clears all transactions from the database
     * 
     * @returns {Promise<void>}
     */
    async clearTransactions() {
        await this.db.transactions.clear();
    }

    /**
     * Clears all description mappings from the database
     * 
     * Note: Account mappings are preserved.
     * 
     * @returns {Promise<void>}
     */
    async clearMappings() {
        await this.db.mappings_descriptions.clear();
    }
}