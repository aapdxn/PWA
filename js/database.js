class DatabaseManager {
    constructor() {
        this.db = new Dexie('VaultBudget');
        this.db.version(2).stores({
            settings: 'key',
            categories: '++id, type',
            transactions: '++id, categoryId, encrypted_date',
            mappings_accounts: 'account_number',
            mappings_descriptions: 'description'
        });
    }

    // ...existing code...

    async saveAccountMapping(accountNumber, encryptedName) {
        return await this.db.mappings_accounts.put({
            account_number: accountNumber,
            encrypted_name: encryptedName
        });
    }

    async saveDescriptionMapping(description, encryptedCategory, encryptedPayee) {
        return await this.db.mappings_descriptions.put({
            description: description,
            encrypted_category: encryptedCategory,
            encrypted_payee: encryptedPayee
        });
    }

    async getAccountMapping(accountNumber) {
        return await this.db.mappings_accounts.get(accountNumber);
    }

    async getDescriptionMapping(description) {
        return await this.db.mappings_descriptions.get(description);
    }

    async getAllAccountMappings() {
        return await this.db.mappings_accounts.toArray();
    }

    async getAllDescriptionMappings() {
        return await this.db.mappings_descriptions.toArray();
    }

    async deleteAccountMapping(accountNumber) {
        return await this.db.mappings_accounts.delete(accountNumber);
    }

    async deleteDescriptionMapping(description) {
        return await this.db.mappings_descriptions.delete(description);
    }

    async saveCategory(category) {
        // Ensure type field exists (Income, Expense, Saving, Transfer)
        if (!category.type) {
            category.type = 'Expense';
        }
        // ...existing code...
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
}