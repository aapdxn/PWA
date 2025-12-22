class CSVImporter {
    constructor(securityManager, databaseManager) {
        this.security = securityManager;
        this.db = databaseManager;
        this.parsedData = [];
        this.duplicates = [];
        this.mappingSuggestions = [];
    }

    async parseCSV(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (error) => reject(error)
            });
        });
    }

    async processCSVFiles(files) {
        this.parsedData = [];
        
        for (const file of files) {
            const rows = await this.parseCSV(file);
            this.parsedData.push(...rows);
        }

        await this.detectDuplicates();
        await this.generateMappingSuggestions();
        
        return {
            total: this.parsedData.length,
            duplicates: this.duplicates.length,
            data: this.parsedData
        };
    }

    async detectDuplicates() {
        this.duplicates = [];
        
        for (const row of this.parsedData) {
            const encryptedTransaction = await this.prepareTransaction(row);
            const duplicate = await this.db.findDuplicateTransaction(encryptedTransaction);
            
            if (duplicate) {
                this.duplicates.push({
                    row: row,
                    existing: duplicate
                });
            }
        }
    }

    async generateMappingSuggestions() {
        this.mappingSuggestions = [];
        
        for (const row of this.parsedData) {
            const description = row.Description || row.description || '';
            const accountNumber = row['Account Number'] || row.account_number || '';
            
            const descMapping = await this.db.getDescriptionMapping(description);
            const acctMapping = await this.db.getAccountMapping(accountNumber);
            
            this.mappingSuggestions.push({
                row: row,
                descriptionMapping: descMapping,
                accountMapping: acctMapping,
                needsReview: !descMapping || !acctMapping
            });
        }
    }

    async prepareTransaction(row) {
        // Normalize column names (case-insensitive)
        const normalizedRow = {};
        Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase().trim()] = row[key];
        });
        
        // Support multiple column name variations
        const date = normalizedRow['transaction date'] || normalizedRow['date'] || '';
        const amount = parseFloat(normalizedRow['amount'] || 0);
        const description = normalizedRow['description'] || '';
        const accountNumber = normalizedRow['account number'] || normalizedRow['account_number'] || '';
        
        return {
            encrypted_date: await this.security.encrypt(date),
            encrypted_amount: await this.security.encrypt(amount.toString()),
            encrypted_description: await this.security.encrypt(description),
            encrypted_account: await this.security.encrypt(accountNumber)
        };
    }

    async saveTransactions(reviewedData, saveMappings = false) {
        const saved = [];
        
        for (const item of reviewedData) {
            if (item.skip) continue;
            
            const transaction = await this.prepareTransaction(item.row);
            
            if (item.categoryId) {
                transaction.categoryId = item.categoryId;
                
                // Apply sign based on category type
                if (item.categoryType) {
                    let amount = parseFloat(await this.security.decrypt(transaction.encrypted_amount));
                    
                    if (item.categoryType === 'Income') {
                        amount = Math.abs(amount);
                    } else if (item.categoryType === 'Expense' || item.categoryType === 'Saving') {
                        amount = -Math.abs(amount);
                    }
                    
                    transaction.encrypted_amount = await this.security.encrypt(amount.toString());
                }
            }
            
            const id = await this.db.saveTransaction(transaction);
            saved.push(id);
            
            if (saveMappings && item.saveAsMapping) {
                const normalizedRow = {};
                Object.keys(item.row).forEach(key => {
                    normalizedRow[key.toLowerCase().trim()] = item.row[key];
                });
                
                const description = normalizedRow['description'] || '';
                if (description && item.categoryId) {
                    await this.db.saveDescriptionMapping(
                        description,
                        await this.security.encrypt(item.categoryId.toString()),
                        await this.security.encrypt(item.payee || '')
                    );
                }
            }
        }
        
        return saved;
    }

    async importMappingsFromCSV(file) {
        const rows = await this.parseCSV(file);
        const imported = [];
        
        for (const row of rows) {
            const description = row.Description || row.description || '';
            const category = row.Category || row.category || '';
            const payee = row.Payee || row.payee || '';
            
            if (description && category) {
                await this.db.saveDescriptionMapping(
                    description,
                    await this.security.encrypt(category),
                    await this.security.encrypt(payee)
                );
                imported.push({ description, category, payee });
            }
        }
        
        return imported;
    }
}
