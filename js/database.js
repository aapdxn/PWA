class DatabaseManager {
    constructor() {
        this.db = new Dexie('VaultBudget');
        this.db.version(1).stores({
            settings: 'key',
            categories: '++id, type',
            transactions: '++id, categoryId, encrypted_date',
            mappings_accounts: 'account_number',
            mappings_descriptions: 'description'
        });
    }

    // Settings
    async getSetting(key) {
        return await this.db.settings.get(key);
    }

    async saveSetting(key, value) {
        return await this.db.settings.put({ key, value });
    }

    // Categories
    async getAllCategories() {
        return await this.db.categories.toArray();
    }

    async getCategory(id) {
        return await this.db.categories.get(id);
    }

    async saveCategory(category) {
        // Ensure type field exists (Income, Expense, Saving, Transfer)
        if (!category.type) {
            category.type = 'Expense';
        }
        if (category.id) {
            return await this.db.categories.put(category);
        } else {
            return await this.db.categories.add(category);
        }
    }

    async deleteCategory(id) {
        return await this.db.categories.delete(id);
    }

    // Transactions
    async getAllTransactions() {
        return await this.db.transactions.toArray();
    }

    async getTransactionsByCategory(categoryId) {
        return await this.db.transactions.where('categoryId').equals(categoryId).toArray();
    }

    async saveTransaction(transaction) {
        if (transaction.id) {
            return await this.db.transactions.put(transaction);
        } else {
            return await this.db.transactions.add(transaction);
        }
    }

    async deleteTransaction(id) {
        return await this.db.transactions.delete(id);
    }

    async findDuplicateTransaction(transaction) {
        const allTransactions = await this.db.transactions.toArray();
        return allTransactions.find(t => 
            t.encrypted_date === transaction.encrypted_date &&
            t.encrypted_amount === transaction.encrypted_amount &&
            t.encrypted_description === transaction.encrypted_description &&
            t.encrypted_account === transaction.encrypted_account
        );
    }

    // Account Mappings
    async getAccountMapping(accountNumber) {
        return await this.db.mappings_accounts.get(accountNumber);
    }

    async getAllAccountMappings() {
        return await this.db.mappings_accounts.toArray();
    }

    async saveAccountMapping(accountNumber, encryptedName) {
        return await this.db.mappings_accounts.put({
            account_number: accountNumber,
            encrypted_name: encryptedName
        });
    }

    async deleteAccountMapping(accountNumber) {
        return await this.db.mappings_accounts.delete(accountNumber);
    }

    // Description Mappings
    async getDescriptionMapping(description) {
        return await this.db.mappings_descriptions.get(description);
    }

    async getAllDescriptionMappings() {
        return await this.db.mappings_descriptions.toArray();
    }

    async saveDescriptionMapping(description, encryptedCategory, encryptedPayee) {
        return await this.db.mappings_descriptions.put({
            description: description,
            encrypted_category: encryptedCategory,
            encrypted_payee: encryptedPayee
        });
    }

    async deleteDescriptionMapping(description) {
        return await this.db.mappings_descriptions.delete(description);
    }

    // Utility
    async clearAllData() {
        await this.db.delete();
        location.reload();
    }
}