// CSV Mapper - Column mapping and data transformation logic
export class CSVMapper {
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

    /**
     * Normalize CSV row keys (lowercase, trim whitespace)
     */
    normalizeRow(row) {
        const normalized = {};
        Object.keys(row).forEach(key => {
            normalized[key.toLowerCase().trim()] = row[key];
        });
        return normalized;
    }

    /**
     * Map CSV columns to internal transaction format
     * Handles multiple column name variations
     */
    mapCSVRow(row) {
        const normalized = this.normalizeRow(row);
        
        // Map account number (support multiple column names)
        const accountNumber = normalized['account number'] || 
                             normalized['account_number'] || 
                             normalized['account'] || '';
        
        // Map description (support multiple column names)
        const description = normalized['transaction description'] || 
                           normalized['description'] || 
                           normalized['desc'] || '';
        
        // Map date (support multiple column names)
        const date = normalized['transaction date'] || 
                    normalized['date'] || 
                    normalized['trans date'] || '';
        
        // Map transaction type
        const transactionType = normalized['transaction type'] || 
                               normalized['type'] || 
                               normalized['trans type'] || '';
        
        // Map amount and apply sign based on transaction type
        let amount = parseFloat(normalized['transaction amount'] || 
                               normalized['amount'] || 
                               normalized['trans amount'] || '0');
        
        // Make negative for debit, positive for credit
        if (transactionType.toLowerCase().includes('debit')) {
            amount = -Math.abs(amount);
        } else if (transactionType.toLowerCase().includes('credit')) {
            amount = Math.abs(amount);
        }
        
        return {
            accountNumber,
            description,
            date,
            transactionType,
            amount,
            originalRow: row
        };
    }

    /**
     * Get description mapping from database
     */
    async getDescriptionMapping(description) {
        const mappings = await this.db.getAllMappingsDescriptions();
        const mapping = mappings.find(m => m.description === description);
        return mapping || null;
    }

    /**
     * Get account mapping from database
     */
    async getAccountMapping(accountNumber) {
        const mappings = await this.db.getAllMappingsAccounts();
        const mapping = mappings.find(m => m.account_number === accountNumber);
        return mapping || null;
    }

    /**
     * Generate mapping suggestions for parsed data (legacy batch method)
     */
    async generateMappingSuggestions(parsedData) {
        const suggestions = [];
        
        for (const row of parsedData) {
            const mapped = this.mapCSVRow(row);
            const descMapping = await this.getDescriptionMapping(mapped.description);
            const acctMapping = await this.getAccountMapping(mapped.accountNumber);
            
            suggestions.push({
                row: row,
                mapped: mapped,
                descriptionMapping: descMapping,
                accountMapping: acctMapping,
                needsReview: !descMapping || !acctMapping
            });
        }
        
        return suggestions;
    }

    /**
     * Prepare transaction object for database save
     */
    async prepareTransaction(row, categoryId) {
        const mapped = this.mapCSVRow(row);
        
        return {
            encrypted_date: await this.security.encrypt(mapped.date),
            encrypted_amount: await this.security.encrypt(mapped.amount.toString()),
            encrypted_description: await this.security.encrypt(mapped.description),
            encrypted_account: await this.security.encrypt(mapped.accountNumber),
            categoryId: categoryId
        };
    }
}
