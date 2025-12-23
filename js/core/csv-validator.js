// CSV Validator - Duplicate detection and validation logic
export class CSVValidator {
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

    /**
     * Check if a transaction already exists in database
     */
    async checkDuplicate(mapped) {
        const allTransactions = await this.db.getAllTransactions();
        
        for (const existing of allTransactions) {
            const existingDate = await this.security.decrypt(existing.encrypted_date);
            const existingAmount = await this.security.decrypt(existing.encrypted_amount);
            const existingDesc = existing.encrypted_description ? 
                await this.security.decrypt(existing.encrypted_description) : '';
            
            if (existingDate === mapped.date && 
                existingAmount === mapped.amount.toString() && 
                existingDesc === mapped.description) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Detect duplicates in parsed CSV data (legacy batch method)
     */
    async detectDuplicates(parsedData, mapCSVRow) {
        const duplicates = [];
        const allTransactions = await this.db.getAllTransactions();
        
        for (const row of parsedData) {
            const mapped = mapCSVRow(row);
            
            for (const existing of allTransactions) {
                const existingDate = await this.security.decrypt(existing.encrypted_date);
                const existingAmount = await this.security.decrypt(existing.encrypted_amount);
                const existingDesc = existing.encrypted_description 
                    ? await this.security.decrypt(existing.encrypted_description) 
                    : '';
                
                if (existingDate === mapped.date && 
                    existingAmount === mapped.amount.toString() && 
                    existingDesc === mapped.description) {
                    duplicates.push({
                        row: row,
                        existing: existing
                    });
                    break;
                }
            }
        }
        
        return duplicates;
    }

    /**
     * Validate CSV row has minimum required fields
     */
    isValidRow(mapped) {
        return !!(mapped.date && mapped.description);
    }
}
