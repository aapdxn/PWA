// DatabaseManager - Uses global Dexie (loaded via CDN)
// DO NOT import Dexie - it's loaded globally in index.html
export class DatabaseManager {
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

    // Settings
    async getSetting(key) {
        const record = await this.db.settings.get(key);
        return record || null;
    }

    async saveSetting(key, value) {
        await this.db.settings.put({ key, value });
    }

    // Categories
    async getAllCategories() {
        return await this.db.categories.toArray();
    }

    async getCategory(id) {
        return await this.db.categories.get(id);
    }

    async saveCategory(category) {
        if (category.id) {
            await this.db.categories.update(category.id, category);
            return category.id;
        } else {
            return await this.db.categories.add(category);
        }
    }

    async deleteCategory(id) {
        await this.db.categories.delete(id);
    }

    // Payees
    async getAllPayees() {
        return await this.db.payees.toArray();
    }

    async getPayee(id) {
        return await this.db.payees.get(id);
    }

    async savePayee(payee) {
        if (payee.id) {
            await this.db.payees.update(payee.id, payee);
            return payee.id;
        } else {
            return await this.db.payees.add(payee);
        }
    }

    async deletePayee(id) {
        await this.db.payees.delete(id);
    }

    // Transactions
    async getAllTransactions() {
        return await this.db.transactions.toArray();
    }

    async getTransaction(id) {
        return await this.db.transactions.get(id);
    }

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

    async deleteTransaction(id) {
        await this.db.transactions.delete(id);
    }

    async getTransactionsByCategory(categoryId) {
        return await this.db.transactions.where('categoryId').equals(categoryId).toArray();
    }

    // Mappings
    async getAllMappingsAccounts() {
        return await this.db.mappings_accounts.toArray();
    }

    async getAllMappingsDescriptions() {
        return await this.db.mappings_descriptions.toArray();
    }

    async setMappingAccount(accountNumber, encryptedName) {
        await this.db.mappings_accounts.put({
            account_number: accountNumber,
            encrypted_name: encryptedName
        });
    }

    async setMappingDescription(description, encryptedCategory, encryptedPayee) {
        await this.db.mappings_descriptions.put({
            description: description,
            encrypted_category: encryptedCategory,
            encrypted_payee: encryptedPayee
        });
    }

    async deleteMappingDescription(description) {
        await this.db.mappings_descriptions.delete(description);
    }

    async getMappingAccount(accountNumber) {
        return await this.db.mappings_accounts.get(accountNumber);
    }

    async getCategoryBudget(categoryId, month) {
        return await this.db.category_budgets.get([categoryId, month]);
    }

    async setCategoryBudget(categoryId, month, encryptedLimit) {
        await this.db.category_budgets.put({
            categoryId: categoryId,
            month: month,
            encrypted_limit: encryptedLimit
        });
    }

    async getCategoryBudgetsForMonth(month) {
        // Can't query by month alone since it's a compound key [categoryId+month]
        // Get all and filter in memory
        const allBudgets = await this.db.category_budgets.toArray();
        return allBudgets.filter(b => b.month === month);
    }

    async bulkAddTransactions(transactions) {
        return await this.db.transactions.bulkAdd(transactions);
    }

    async clearAllData() {
        await this.db.delete();
        await this.db.open();
    }

    async clearTransactions() {
        await this.db.transactions.clear();
    }

    async clearMappings() {
        await this.db.mappings_descriptions.clear();
    }
}