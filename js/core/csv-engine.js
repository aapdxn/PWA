// CSVEngine - Main CSV processing coordinator
// Uses global Papa (PapaParse loaded via CDN)
import { CSVValidator } from './csv-validator.js';
import { CSVMapper } from './csv-mapper.js';

export class CSVEngine {
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
     * Parse CSV file using PapaParse
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
     * @param {File} file - CSV file to process
     * @param {string} formatId - CSV format identifier (e.g., 'capital-one-checking')
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
                    // Decrypt the category name
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
     * Import reviewed transactions to database
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
            
            // Create transaction object
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
     * Process mappings CSV for import
     * Format: Description,Category,Payee (3 columns)
     */
    async processMappingsCSV(files) {
        const allCategories = await this.db.getAllCategories();
        const existingMappings = await this.db.getAllMappingsDescriptions();
        
        // Create category name lookup (case-insensitive and trim whitespace)
        const categoryByName = {};
        for (const cat of allCategories) {
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
     * Import reviewed mappings to database
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
