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
     */
    async processTransactionCSV(file) {
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
            const suggestedCategoryId = descMapping ? 
                parseInt(await this.security.decrypt(descMapping.encrypted_category)) : null;
            
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
            
            // Create transaction object
            const transaction = {
                encrypted_date: await this.security.encrypt(item.date),
                encrypted_amount: await this.security.encrypt(item.amount.toString()),
                encrypted_description: await this.security.encrypt(item.description),
                encrypted_account: await this.security.encrypt(item.accountNumber),
                categoryId: item.categoryId || null
            };
            
            const id = await this.db.saveTransaction(transaction);
            imported.push(id);
            
            // Save mapping if requested
            if (item.saveMapping && item.categoryId) {
                await this.db.setMappingDescription(
                    item.description,
                    await this.security.encrypt(item.categoryId.toString()),
                    await this.security.encrypt('')
                );
            }
        }
        
        return imported;
    }

    /**
     * Process mappings CSV for import
     * Format: Description,Category (2 columns)
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
                let description, categoryName;
                
                if (hasProperHeaders) {
                    description = (row['Description'] || row['description'] || '').trim();
                    categoryName = (row['Category'] || row['category'] || '').trim();
                } else {
                    // Use first two columns by their keys
                    const keys = Object.keys(row);
                    description = (row[keys[0]] || '').trim();
                    categoryName = (row[keys[1]] || '').trim();
                }
                
                if (!description) continue;
                
                const normalizedCategoryName = categoryName.toLowerCase();
                const categoryId = categoryByName[normalizedCategoryName] || null;
                const isDuplicate = existingDescriptions.has(description.toLowerCase());
                
                processedMappings.push({
                    description,
                    payee: '',
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
            
            await this.db.setMappingDescription(
                item.description,
                await this.security.encrypt(item.categoryId.toString()),
                await this.security.encrypt('')
            );
            
            imported.push(item.description);
        }
        
        return imported;
    }
}
