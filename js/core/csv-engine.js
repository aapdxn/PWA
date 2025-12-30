/**
 * CSVEngine - Main CSV processing coordinator
 * 
 * Orchestrates CSV import/export operations:
 * - File parsing (PapaParse)
 * - Column mapping (CSVMapper)
 * - Duplicate detection (CSVValidator)
 * - Transaction import coordination
 * - CSV export generation
 * 
 * DEPENDENCIES:
 * - PapaParse (global CDN variable, loaded in index.html)
 * - CSVValidator (duplicate detection)
 * - CSVMapper (column mapping)
 * 
 * @class CSVEngine
 * @module Core/CSV
 * @layer 3 - Core Services (CSV processing)
 */
import { CSVValidator } from './csv-validator.js';
import { CSVMapper } from './csv-mapper.js';

export class CSVEngine {
    /**
     * Create a new CSVEngine instance
     * 
     * @param {SecurityManager} securityManager - SecurityManager instance for encryption/decryption
     * @param {DatabaseManager} databaseManager - DatabaseManager instance for database operations
     * @throws {Error} If PapaParse is not loaded (global Papa variable missing)
     */
    constructor(securityManager, databaseManager) {
        if (typeof Papa === 'undefined') {
            throw new Error('PapaParse is not loaded. Ensure PapaParse CDN is loaded in index.html');
        }
        
        this.security = securityManager;
        this.db = databaseManager;
        this.validator = new CSVValidator(securityManager, databaseManager);
        this.mapper = new CSVMapper(securityManager, databaseManager);
    }

    /**
     * Parse CSV file using PapaParse library
     * 
     * Wraps PapaParse in a Promise for async/await compatibility.
     * Automatically treats first row as headers and skips empty lines.
     * 
     * @param {File} file - CSV file object (from file input)
     * @returns {Promise<Array<Object>>} Array of row objects with column headers as keys
     * @throws {Error} If Papa.parse encounters an error
     * 
     * @example
     * const rows = await csvEngine.parseCSV(fileInput.files[0]);
     * // Returns: [{Date: '2024-01-01', Amount: '100.00', ...}, ...]
     */
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

    /**
     * Process transaction CSV and return structured data for review
     * 
     * Main workflow:
     * 1. Parse CSV using PapaParse
     * 2. Map columns to standard format using CSVMapper
     * 3. Validate rows and detect duplicates using CSVValidator
     * 4. Apply description mappings (category/payee suggestions)
     * 5. Apply account mappings for display names
     * 6. Return enriched data for UI review
     * 
     * STATE REQUIREMENT: Unlocked (requires decryption for mappings)
     * 
     * @param {File} file - CSV file to process (from file input)
     * @param {string} [formatId='capital-one-checking'] - CSV format identifier from csv-formats.js
     * @returns {Promise<Array<Object>>} Array of processed transactions for review
     * @returns {string} return[].date - Transaction date (YYYY-MM-DD)
     * @returns {string} return[].description - Transaction description
     * @returns {number} return[].amount - Transaction amount (positive or negative)
     * @returns {string} return[].accountNumber - Account identifier from CSV
     * @returns {string} return[].accountName - Mapped account name or "Account {number}"
     * @returns {string} return[].transactionType - 'debit' or 'credit'
     * @returns {number|string|null} return[].suggestedCategoryId - Category ID from mapping or 'TRANSFER'
     * @returns {number|null} return[].suggestedPayeeId - Payee ID from mapping (auto-created if needed)
     * @returns {boolean} return[].isDuplicate - Whether transaction already exists
     * @returns {Object} return[].originalRow - Original CSV row data
     * 
     * @example
     * const processed = await csvEngine.processTransactionCSV(file, 'chase-checking');
     * // Display in review UI
     */
    async processTransactionCSV(file, formatId = 'capital-one-checking') {
        // Set the format for the mapper
        this.mapper.setFormat(formatId);
        
        const rows = await this.parseCSV(file);
        const processed = [];
        
        for (const row of rows) {
            const mapped = this.mapper.mapCSVRow(row);
            
            // Skip empty rows
            if (!this.validator.isValidRow(mapped)) {
                continue;
            }
            
            // Check for duplicate
            const isDuplicate = await this.validator.checkDuplicate(mapped);
            
            // Try to find category from mappings
            const descMapping = await this.mapper.getDescriptionMapping(mapped.description);
            let suggestedCategoryId = null;
            let suggestedPayeeId = null;
            
            if (descMapping && descMapping.encrypted_category) {
                try {
                    // STATE GUARD: Decrypt requires unlocked state
                    const categoryName = await this.security.decrypt(descMapping.encrypted_category);
                    
                    // Check if it's Transfer type
                    if (categoryName === 'Transfer') {
                        suggestedCategoryId = 'TRANSFER';
                    } else {
                        // Find the category by name
                        const allCategories = await this.db.getAllCategories();
                        for (const cat of allCategories) {
                            const name = await this.security.decrypt(cat.encrypted_name);
                            if (name === categoryName) {
                                suggestedCategoryId = cat.id;
                                break;
                            }
                        }
                    }
                } catch (error) {
                    console.warn('Failed to decrypt category mapping:', error);
                }
            }
            
            // Try to find payee from mappings
            if (descMapping && descMapping.encrypted_payee) {
                try {
                    const payeeName = await this.security.decrypt(descMapping.encrypted_payee);
                    if (payeeName) {
                        // Find the payee by name
                        const allPayees = await this.db.getAllPayees();
                        for (const payee of allPayees) {
                            const name = await this.security.decrypt(payee.encrypted_name);
                            if (name === payeeName) {
                                suggestedPayeeId = payee.id;
                                break;
                            }
                        }
                        
                        // If payee doesn't exist, create it
                        if (!suggestedPayeeId) {
                            suggestedPayeeId = await this.db.savePayee({
                                encrypted_name: await this.security.encrypt(payeeName)
                            });
                        }
                    }
                } catch (error) {
                    console.warn('Failed to decrypt payee mapping:', error);
                }
            }
            
            // Get account name from mapping
            const acctMapping = await this.mapper.getAccountMapping(mapped.accountNumber);
            const accountName = acctMapping ? 
                await this.security.decrypt(acctMapping.encrypted_name) : 
                `Account ${mapped.accountNumber}`;
            
            processed.push({
                date: mapped.date,
                description: mapped.description,
                amount: mapped.amount,
                accountNumber: mapped.accountNumber,
                accountName: accountName,
                transactionType: mapped.transactionType,
                suggestedCategoryId: suggestedCategoryId,
                suggestedPayeeId: suggestedPayeeId,
                isDuplicate: isDuplicate,
                originalRow: mapped.originalRow
            });
        }
        
        return processed;
    }

    /**
     * Import reviewed transactions to database after user confirmation
     * 
     * Workflow:
     * 1. Skip duplicates and user-marked items
     * 2. Apply category/payee selections (explicit or suggested)
     * 3. Set auto-mapping flags if using description mapping
     * 4. Encrypt all sensitive data
     * 5. Save to database
     * 6. Optionally save new description mappings
     * 
     * SPECIAL HANDLING:
     * - Transfer transactions: categoryId is null, encrypted_linkedTransactionId field exists (initially null)
     * - Uncategorized: categoryId is null, no encrypted_linkedTransactionId field
     * - Auto-mapped: useAutoCategory/useAutoPayee flags set to true
     * 
     * STATE REQUIREMENT: Unlocked (requires encryption)
     * 
     * @param {Array<Object>} reviewedData - Reviewed transactions from CSVReviewUI
     * @param {boolean} reviewedData[].skip - Whether to skip this transaction
     * @param {boolean} reviewedData[].isDuplicate - Whether transaction is duplicate
     * @param {string} reviewedData[].date - Transaction date (YYYY-MM-DD)
     * @param {string} reviewedData[].description - Transaction description
     * @param {number} reviewedData[].amount - Transaction amount
     * @param {string} reviewedData[].accountNumber - Account identifier
     * @param {number|string|null} reviewedData[].categoryId - Selected category ID or 'TRANSFER'
     * @param {number|null} reviewedData[].payeeId - Selected payee ID
     * @param {number|string|null} reviewedData[].suggestedCategoryId - Mapping-suggested category ID
     * @param {number|null} reviewedData[].suggestedPayeeId - Mapping-suggested payee ID
     * @param {boolean} reviewedData[].saveMapping - Whether to save description mapping
     * @returns {Promise<Array<number>>} Array of imported transaction IDs
     * 
     * @example
     * const importedIds = await csvEngine.importReviewedTransactions(reviewedData);
     * console.log(`Imported ${importedIds.length} transactions`);
     */
    async importReviewedTransactions(reviewedData) {
        const imported = [];
        
        for (const item of reviewedData) {
            if (item.skip || item.isDuplicate) {
                continue;
            }
            
            // Check if Transfer type (categoryId === 'TRANSFER')
            const isTransfer = item.categoryId === 'TRANSFER' || item.suggestedCategoryId === 'TRANSFER';
            
            // Use suggested IDs if no explicit override was set during review
            const categoryId = item.categoryId !== undefined ? item.categoryId : item.suggestedCategoryId;
            const payeeId = item.payeeId !== undefined ? item.payeeId : item.suggestedPayeeId;
            
            // Determine if we should use auto-mapping flags
            // If a mapping exists and wasn't explicitly overridden, use auto mode
            const hasMapping = await this.mapper.getDescriptionMapping(item.description);
            const useAutoCategory = !isTransfer && hasMapping && hasMapping.encrypted_category && item.categoryId === undefined;
            const useAutoPayee = hasMapping && hasMapping.encrypted_payee && item.payeeId === undefined;
            
            // SECURITY: Encrypt all fields before database storage
            const transaction = {
                encrypted_date: await this.security.encrypt(item.date),
                encrypted_amount: await this.security.encrypt(item.amount.toString()),
                encrypted_description: await this.security.encrypt(item.description),
                encrypted_account: await this.security.encrypt(item.accountNumber),
                categoryId: isTransfer ? null : (categoryId || null),
                payeeId: payeeId || null,
                useAutoCategory: useAutoCategory,
                useAutoPayee: useAutoPayee
            };
            
            // Only add encrypted_linkedTransactionId for Transfer type
            // This distinguishes Transfers (has field = null) from Uncategorized (no field)
            if (isTransfer) {
                transaction.encrypted_linkedTransactionId = null; // Transfers imported via CSV are initially unlinked
            }
            
            const id = await this.db.saveTransaction(transaction);
            imported.push(id);
            
            // Save mapping if requested (not applicable for Transfer type)
            if (item.saveMapping && item.categoryId && !isTransfer) {
                const category = await this.db.getCategory(item.categoryId);
                const categoryName = await this.security.decrypt(category.encrypted_name);
                await this.db.setMappingDescription(
                    item.description,
                    await this.security.encrypt(categoryName),
                    await this.security.encrypt('')
                );
            }
        }
        
        return imported;
    }

    /**
     * Process mappings CSV for import and return structured data for review
     * 
     * Expected CSV format:
     * - Column 1: Description (transaction description pattern)
     * - Column 2: Category (category name - must exist in system or be "Transfer")
     * - Column 3: Payee (payee name - optional)
     * 
     * Headers can be:
     * - Standard: "Description", "Category", "Payee" (case-insensitive)
     * - Or use first 3 columns regardless of header names
     * 
     * Workflow:
     * 1. Parse CSV files
     * 2. Lookup category IDs by name (case-insensitive, trimmed)
     * 3. Detect duplicates against existing mappings
     * 4. Return enriched data for UI review
     * 
     * STATE REQUIREMENT: Unlocked (requires decryption for category lookup)
     * 
     * @param {Array<File>} files - Array of CSV files to process
     * @returns {Promise<Array<Object>>} Array of processed mappings for review
     * @returns {string} return[].description - Transaction description pattern
     * @returns {string} return[].categoryName - Category name from CSV
     * @returns {number|string|null} return[].categoryId - Resolved category ID or 'TRANSFER' or null if not found
     * @returns {string} return[].payee - Payee name from CSV
     * @returns {boolean} return[].isDuplicate - Whether mapping already exists
     * @returns {boolean} return[].skip - Auto-set to true for duplicates
     * 
     * @example
     * const mappings = await csvEngine.processMappingsCSV([file1, file2]);
     * // Display in review UI
     */
    async processMappingsCSV(files) {
        const allCategories = await this.db.getAllCategories();
        const existingMappings = await this.db.getAllMappingsDescriptions();
        
        // Create category name lookup (case-insensitive and trim whitespace)
        const categoryByName = {};
        for (const cat of allCategories) {
            // STATE GUARD: Decrypt requires unlocked state
            const name = await this.security.decrypt(cat.encrypted_name);
            const normalizedName = name.trim().toLowerCase();
            categoryByName[normalizedName] = cat.id;
        }
        
        // Create existing mappings lookup
        const existingDescriptions = new Set();
        for (const mapping of existingMappings) {
            existingDescriptions.add(mapping.description.toLowerCase());
        }
        
        const processedMappings = [];
        
        for (const file of files) {
            const rows = await this.parseCSV(file);
            
            if (rows.length === 0) continue;
            
            // Detect if CSV has proper headers
            const firstRow = rows[0];
            const hasProperHeaders = 'Description' in firstRow || 'description' in firstRow;
            
            for (const row of rows) {
                let description, categoryName, payeeName;
                
                if (hasProperHeaders) {
                    description = (row['Description'] || row['description'] || '').trim();
                    categoryName = (row['Category'] || row['category'] || '').trim();
                    payeeName = (row['Payee'] || row['payee'] || '').trim();
                } else {
                    // Use first three columns by their keys
                    const keys = Object.keys(row);
                    description = (row[keys[0]] || '').trim();
                    categoryName = (row[keys[1]] || '').trim();
                    payeeName = (row[keys[2]] || '').trim();
                }
                
                if (!description) continue;
                
                const normalizedCategoryName = categoryName.toLowerCase();
                
                // Check if Transfer type (special case - not a category)
                const isTransfer = normalizedCategoryName === 'transfer';
                const categoryId = isTransfer ? 'TRANSFER' : (categoryByName[normalizedCategoryName] || null);
                const isDuplicate = existingDescriptions.has(description.toLowerCase());
                
                console.log(`📋 Mapping: "${description}" → Category: "${categoryName}" (ID: ${categoryId}), Payee: "${payeeName}", Duplicate: ${isDuplicate}`);
                
                processedMappings.push({
                    description,
                    payee: payeeName,
                    categoryName,
                    categoryId,
                    isDuplicate,
                    skip: isDuplicate
                });
            }
        }
        
        return processedMappings;
    }

    /**
     * Import reviewed mappings to database after user confirmation
     * 
     * Workflow:
     * 1. Skip duplicates and user-marked items
     * 2. Skip items without valid categoryId
     * 3. Resolve category name (including special "Transfer" case)
     * 4. Encrypt category and payee names
     * 5. Save to mappings database
     * 
     * SPECIAL HANDLING:
     * - Transfer mappings: categoryId is 'TRANSFER', stored as encrypted "Transfer" string
     * - Empty payee names are stored as encrypted empty string
     * 
     * STATE REQUIREMENT: Unlocked (requires encryption/decryption)
     * 
     * @param {Array<Object>} mappingsToImport - Reviewed mappings from MappingsUI
     * @param {boolean} mappingsToImport[].skip - Whether to skip this mapping
     * @param {boolean} mappingsToImport[].isDuplicate - Whether mapping already exists
     * @param {string} mappingsToImport[].description - Transaction description pattern
     * @param {number|string|null} mappingsToImport[].categoryId - Category ID or 'TRANSFER'
     * @param {string} mappingsToImport[].payee - Payee name
     * @returns {Promise<Array<string>>} Array of imported description patterns
     * 
     * @example
     * const imported = await csvEngine.importReviewedMappings(mappingsToImport);
     * console.log(`Imported ${imported.length} mappings`);
     */
    async importReviewedMappings(mappingsToImport) {
        const imported = [];
        
        for (const item of mappingsToImport) {
            if (item.skip || item.isDuplicate) continue;
            if (!item.categoryId) continue;
            
            let categoryName;
            
            // Check if Transfer type
            if (item.categoryId === 'TRANSFER') {
                categoryName = 'Transfer';
            } else {
                const category = await this.db.getCategory(item.categoryId);
                categoryName = await this.security.decrypt(category.encrypted_name);
            }
            
            // Handle payee
            const payeeName = item.payee || '';
            
            await this.db.setMappingDescription(
                item.description,
                await this.security.encrypt(categoryName),
                await this.security.encrypt(payeeName)
            );
            
            imported.push(item.description);
        }
        
        return imported;
    }
}
