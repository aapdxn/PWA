/**
 * CSVFormats - CSV Format Definitions and Mappers
 * 
 * Defines mapping configurations for different bank CSV export formats.
 * Each format includes a mapper function that transforms bank-specific
 * column names and data structures into the application's standardized
 * transaction format.
 * 
 * SUPPORTED FORMATS:
 * - capital-one-checking: Capital One Checking/Savings accounts
 * - capital-one-credit: Capital One Credit Card accounts
 * 
 * Each mapper handles:
 * - Column name variations (flexible matching)
 * - Amount sign normalization (debit=negative, credit=positive)
 * - Data type conversions
 * 
 * @module Core/CSVFormats
 * @layer 3 - Core Services
 */

/**
 * CSV format definitions with mapper functions
 * 
 * Each format object contains:
 * @property {string} name - Human-readable format name
 * @property {string} description - CSV column structure description
 * @property {Function} mapper - Mapper function (normalizedRow) => transaction
 * 
 * Mapper function signature:
 * @param {Object} normalizedRow - Row with lowercase, trimmed keys
 * @returns {Object} Standardized transaction object
 * @returns {string} return.accountNumber - Account identifier
 * @returns {string} return.description - Transaction description
 * @returns {string} return.date - Transaction date
 * @returns {string} return.transactionType - Transaction type (Debit/Credit)
 * @returns {number} return.amount - Signed amount (negative for debits)
 */
export const CSV_FORMATS = {
    'capital-one-checking': {
        name: 'Capital One Checking/Savings',
        description: 'Account Number, Transaction Description, Transaction Date, Transaction Type, Transaction Amount, Balance',
        mapper: (normalizedRow) => {
            const accountNumber = normalizedRow['account number'] || 
                                 normalizedRow['account_number'] || 
                                 normalizedRow['account'] || '';
            
            const description = normalizedRow['transaction description'] || 
                               normalizedRow['description'] || 
                               normalizedRow['desc'] || '';
            
            const date = normalizedRow['transaction date'] || 
                        normalizedRow['date'] || 
                        normalizedRow['trans date'] || '';
            
            const transactionType = normalizedRow['transaction type'] || 
                                   normalizedRow['type'] || 
                                   normalizedRow['trans type'] || '';
            
            let amount = parseFloat(normalizedRow['transaction amount'] || 
                                   normalizedRow['amount'] || 
                                   normalizedRow['trans amount'] || '0');
            
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
                amount
            };
        }
    },
    
    'capital-one-credit': {
        name: 'Capital One Credit',
        description: 'Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit',
        mapper: (normalizedRow) => {
            // Transaction Date maps to our date
            const date = normalizedRow['transaction date'] || 
                        normalizedRow['trans date'] || 
                        normalizedRow['date'] || '';
            
            // Card No. maps to our account number
            const accountNumber = normalizedRow['card no.'] || 
                                 normalizedRow['card no'] || 
                                 normalizedRow['card number'] || 
                                 normalizedRow['card'] || '';
            
            // Description maps directly
            const description = normalizedRow['description'] || 
                               normalizedRow['desc'] || '';
            
            // Combine debit and credit columns
            // Debit should be negative, credit should be positive
            const debit = parseFloat(normalizedRow['debit'] || '0');
            const credit = parseFloat(normalizedRow['credit'] || '0');
            
            let amount = 0;
            if (debit !== 0) {
                amount = -Math.abs(debit); // Debit is negative
            } else if (credit !== 0) {
                amount = Math.abs(credit); // Credit is positive
            }
            
            return {
                accountNumber,
                description,
                date,
                transactionType: debit !== 0 ? 'Debit' : 'Credit', // For consistency
                amount
            };
        }
    }
};

/**
 * Get list of all available CSV formats
 * 
 * Returns an array of format metadata for UI display and selection.
 * 
 * @returns {Array<Object>} Array of format objects
 * @returns {string} return[].id - Format identifier
 * @returns {string} return[].name - Human-readable name
 * @returns {string} return[].description - Column structure description
 * 
 * @example
 * const formats = getFormatList();
 * // [{ id: 'capital-one-checking', name: 'Capital One Checking/Savings', ... }]
 */
export function getFormatList() {
    return Object.keys(CSV_FORMATS).map(key => ({
        id: key,
        name: CSV_FORMATS[key].name,
        description: CSV_FORMATS[key].description
    }));
}

/**
 * Get mapper function for a specific CSV format
 * 
 * Retrieves the mapper function for transforming CSV rows from the
 * specified format into standardized transaction objects.
 * 
 * @param {string} formatId - Format identifier (e.g., 'capital-one-checking')
 * @returns {Function} Mapper function for the specified format
 * @throws {Error} If formatId is not recognized
 * 
 * @example
 * const mapper = getFormatMapper('capital-one-checking');
 * const transaction = mapper(normalizedRow);
 */
export function getFormatMapper(formatId) {
    const format = CSV_FORMATS[formatId];
    if (!format) {
        throw new Error(`Unknown CSV format: ${formatId}`);
    }
    return format.mapper;
}
