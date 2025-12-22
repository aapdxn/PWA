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
            
            // Check for existing mappings
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
        const date = row['Transaction Date'] || row.date || '';
        const amount = parseFloat(row.Amount || row.amount || 0);
        const description = row.Description || row.description || '';
        const accountNumber = row['Account Number'] || row.account_number || '';
        
        // Encrypt all fields
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
            
            // Apply category from mapping or manual selection
            if (item.categoryId) {
                transaction.categoryId = item.categoryId;
            }
            
            const id = await this.db.saveTransaction(transaction);
            saved.push(id);
            
            // Save mapping if requested
            if (saveMappings && item.saveAsMapping) {
                const description = item.row.Description || item.row.description || '';
                await this.db.saveDescriptionMapping(
                    description,
                    await this.security.encrypt(item.categoryId.toString()),
                    await this.security.encrypt(item.payee || '')
                );
            }
        }
        
        return saved;
    }
}
