/**
 * CSVMapper - Column Mapping and Data Transformation
 * 
 * Handles transformation of CSV data from various bank formats into the
 * application's internal transaction format. Supports multiple CSV formats
 * through format-specific mapper functions. Also manages description and
 * account mappings for auto-categorization.
 * 
 * DEPENDENCIES:
 * - csv-formats.js: Format definitions and mapper functions
 * - SecurityManager: For encrypting transactions before database save
 * - DatabaseManager: For querying mappings and preparing transactions
 * 
 * @module Core/CSVMapper
 * @layer 3 - Core Services
 */

import { getFormatMapper } from './csv-formats.js';

/**
 * CSV Mapper for transforming bank CSV data to internal format
 */
export class CSVMapper {
    /**
     * Initialize CSV mapper with required dependencies
     * @param {SecurityManager} security - SecurityManager instance for encryption
     * @param {DatabaseManager} db - DatabaseManager instance for mappings
     */
    constructor(security, db) {
        this.security = security;
        this.db = db;
        this.currentFormat = 'capital-one-checking'; // Default format
    }

    /**
     * Set the CSV format to use for mapping
     * 
     * @param {string} formatId - Format identifier (e.g., 'capital-one-checking')
     * @see csv-formats.js for available format IDs
     */
    setFormat(formatId) {
        this.currentFormat = formatId;
    }

    /**
     * Normalize CSV row keys (lowercase, trim whitespace)
     * 
     * Ensures consistent column name matching across different CSV exports
     * by converting all keys to lowercase and removing whitespace.
     * 
     * @param {Object} row - Raw CSV row object with original column names
     * @returns {Object} Normalized row with lowercase, trimmed keys
     * 
     * @example
     * normalizeRow({ 'Transaction Date': '2024-12-30' })
     * // Returns: { 'transaction date': '2024-12-30' }
     */
    normalizeRow(row) {
        const normalized = {};
        Object.keys(row).forEach(key => {
            normalized[key.toLowerCase().trim()] = row[key];
        });
        return normalized;
    }

    /**
     * Map CSV columns to internal transaction format using selected format
     * 
     * Transforms a raw CSV row into standardized transaction object using
     * the currently selected format mapper. Preserves original row for reference.
     * 
     * @param {Object} row - Raw CSV row with bank-specific column names
     * @returns {Object} Mapped transaction with standardized fields
     * @returns {string} return.date - Transaction date
     * @returns {number} return.amount - Transaction amount (negative for expenses)
     * @returns {string} return.description - Transaction description
     * @returns {string} return.accountNumber - Account number
     * @returns {string} return.transactionType - Transaction type (Debit/Credit)
     * @returns {Object} return.originalRow - Original CSV row for reference
     */
    mapCSVRow(row) {
        const normalized = this.normalizeRow(row);
        const mapper = getFormatMapper(this.currentFormat);
        const mapped = mapper(normalized);
        
        return {
            ...mapped,
            originalRow: row
        };
    }

    /**
     * Get description mapping from database
     * 
     * Looks up saved mapping for a transaction description to retrieve
     * associated category and payee for auto-categorization.
     * 
     * @param {string} description - Transaction description to look up
     * @returns {Promise<Object|null>} Mapping object or null if not found
     * @returns {string} return.description - Original description
     * @returns {string} return.encrypted_category - Encrypted category name
     * @returns {string} return.encrypted_payee - Encrypted payee name
     */
    async getDescriptionMapping(description) {
        const mappings = await this.db.getAllMappingsDescriptions();
        const mapping = mappings.find(m => m.description === description);
        return mapping || null;
    }

    /**
     * Get account mapping from database
     * 
     * Looks up friendly display name for an account number.
     * 
     * @param {string} accountNumber - Account number to look up
     * @returns {Promise<Object|null>} Mapping object or null if not found
     * @returns {string} return.account_number - Account number
     * @returns {string} return.encrypted_name - Encrypted friendly name
     */
    async getAccountMapping(accountNumber) {
        const mappings = await this.db.getAllMappingsAccounts();
        const mapping = mappings.find(m => m.account_number === accountNumber);
        return mapping || null;
    }

    /**
     * Generate mapping suggestions for parsed data (legacy batch method)
     * 
     * Batch-processes CSV rows to generate mapping suggestions based on
     * existing description and account mappings. Identifies rows needing review.
     * 
     * NOTE: This is a legacy method. Modern implementation uses real-time mapping.
     * 
     * @param {Array<Object>} parsedData - Array of parsed CSV rows
     * @returns {Promise<Array<Object>>} Array of suggestion objects
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
     * 
     * Maps and encrypts a CSV row into database-ready format with all
     * required encrypted fields.
     * 
     * @param {Object} row - Raw CSV row
     * @param {number|null} categoryId - Category ID to assign
     * @returns {Promise<Object>} Encrypted transaction ready for database
     * @returns {string} return.encrypted_date - Encrypted transaction date
     * @returns {string} return.encrypted_amount - Encrypted amount string
     * @returns {string} return.encrypted_description - Encrypted description
     * @returns {string} return.encrypted_account - Encrypted account number
     * @returns {number|null} return.categoryId - Category ID
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
