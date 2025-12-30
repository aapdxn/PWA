/**
 * CSVValidator - Duplicate Detection and Transaction Validation
 * 
 * Handles duplicate detection by comparing imported CSV transactions against
 * existing database records. Performs three-way matching on date, amount, and
 * description to identify potential duplicates before import.
 * 
 * DEPENDENCIES:
 * - SecurityManager: For decrypting existing transaction data
 * - DatabaseManager: For querying stored transactions
 * 
 * @module Core/CSVValidator
 * @layer 3 - Core Services
 */

/**
 * CSV Validator for duplicate detection and row validation
 */
export class CSVValidator {
    /**
     * Initialize CSV validator with required dependencies
     * @param {SecurityManager} security - SecurityManager instance for decryption
     * @param {DatabaseManager} db - DatabaseManager instance for transaction queries
     */
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

    /**
     * Check if a transaction already exists in database
     * 
     * Compares a mapped CSV transaction against all existing database transactions
     * using three-way matching: date, amount, and description must all match.
     * 
     * @param {Object} mapped - Mapped transaction object from CSV
     * @param {string} mapped.date - Transaction date (YYYY-MM-DD)
     * @param {number} mapped.amount - Transaction amount
     * @param {string} mapped.description - Transaction description
     * @returns {Promise<boolean>} True if duplicate found, false otherwise
     * 
     * @example
     * const isDuplicate = await validator.checkDuplicate({
     *   date: '2024-12-30',
     *   amount: -50.00,
     *   description: 'Coffee Shop'
     * });
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
     * 
     * Batch-processes an array of CSV rows to identify duplicates against
     * existing database transactions. Returns array of duplicate matches.
     * 
     * NOTE: This is a legacy method. Prefer checkDuplicate() for single-row validation.
     * 
     * @param {Array<Object>} parsedData - Array of parsed CSV rows
     * @param {Function} mapCSVRow - Function to map CSV row to transaction format
     * @returns {Promise<Array<Object>>} Array of duplicate objects with {row, existing}
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
     * 
     * Checks that a mapped transaction has the minimum required fields
     * to be considered valid. Currently requires date and description.
     * 
     * @param {Object} mapped - Mapped transaction object
     * @param {string} mapped.date - Transaction date
     * @param {string} mapped.description - Transaction description
     * @returns {boolean} True if row has required fields, false otherwise
     */
    isValidRow(mapped) {
        return !!(mapped.date && mapped.description);
    }
}
