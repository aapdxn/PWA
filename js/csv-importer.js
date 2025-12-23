// CSVEngine - Uses global Papa (PapaParse loaded via CDN)
// DO NOT import PapaParse - it's loaded globally in index.html
export class CSVEngine {
    constructor(securityManager, databaseManager) {
        if (typeof Papa === 'undefined') {
            throw new Error('PapaParse is not loaded. Ensure PapaParse CDN is loaded in index.html');
        }
        
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
        
        const allTransactions = await this.db.getAllTransactions();
        
        for (const row of this.parsedData) {
            const mapped = this.mapCSVRow(row);
            
            // Simple duplicate detection - check for matching date, amount, description
            for (const existing of allTransactions) {
                const existingDate = await this.security.decrypt(existing.encrypted_date);
                const existingAmount = await this.security.decrypt(existing.encrypted_amount);
                const existingDesc = existing.encrypted_description 
                    ? await this.security.decrypt(existing.encrypted_description) 
                    : '';
                
                if (existingDate === mapped.date && 
                    existingAmount === mapped.amount.toString() && 
                    existingDesc === mapped.description) {
                    this.duplicates.push({
                        row: row,
                        existing: existing
                    });
                    break;
                }
            }
        }
    }

    async generateMappingSuggestions() {
        this.mappingSuggestions = [];
        
        for (const row of this.parsedData) {
            const mapped = this.mapCSVRow(row);
            
            const descMapping = await this.getDescriptionMapping(mapped.description);
            const acctMapping = await this.getAccountMapping(mapped.accountNumber);
            
            this.mappingSuggestions.push({
                row: row,
                mapped: mapped,
                descriptionMapping: descMapping,
                accountMapping: acctMapping,
                needsReview: !descMapping || !acctMapping
            });
        }
    }

    normalizeRow(row) {
        const normalized = {};
        Object.keys(row).forEach(key => {
            normalized[key.toLowerCase().trim()] = row[key];
        });
        return normalized;
    }

    /**
     * Map CSV columns to internal format
     * Handles: Account Number, Transaction Description, Transaction Date, 
     *          Transaction Type, Transaction Amount, Balance
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

    async getDescriptionMapping(description) {
        const mappings = await this.db.getAllMappingsDescriptions();
        const mapping = mappings.find(m => m.description === description);
        return mapping || null;
    }

    async getAccountMapping(accountNumber) {
        const mappings = await this.db.getAllMappingsAccounts();
        const mapping = mappings.find(m => m.account_number === accountNumber);
        return mapping || null;
    }

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

    async saveTransactions(reviewedData, saveMappings = false) {
        const saved = [];
        
        for (const item of reviewedData) {
            if (item.skip) continue;
            
            const transaction = await this.prepareTransaction(item.row, item.categoryId);
            const transactionId = await this.db.saveTransaction(transaction);
            
            saved.push(transactionId);
            
            if (saveMappings) {
                const normalizedRow = this.normalizeRow(item.row);
                const description = normalizedRow['description'] || '';
                const accountNumber = normalizedRow['account number'] || normalizedRow['account_number'] || '';
                
                if (description && item.categoryId) {
                    const category = await this.db.getCategory(item.categoryId);
                    if (category) {
                        await this.db.setMappingDescription(
                            description,
                            category.encrypted_name,
                            await this.security.encrypt('')
                        );
                    }
                }
                
                if (accountNumber) {
                    await this.db.setMappingAccount(
                        accountNumber,
                        await this.security.encrypt(`Account ${accountNumber}`)
                    );
                }
            }
        }
        
        return saved;
    }

    async saveTransactionsWithDetails(items, saveMappings = false) {
        const saved = [];
        
        for (const item of items) {
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

    /**
     * Process CSV and return structured data for review
     * Returns array of transactions ready for UI review
     */
    async processTransactionCSV(file) {
        const rows = await this.parseCSV(file);
        const processed = [];
        
        for (const row of rows) {
            const mapped = this.mapCSVRow(row);
            
            // Skip empty rows
            if (!mapped.date || !mapped.description) {
                continue;
            }
            
            // Check for duplicate
            const isDuplicate = await this.checkDuplicate(mapped);
            
            // Try to find category from mappings
            const descMapping = await this.getDescriptionMapping(mapped.description);
            const suggestedCategoryId = descMapping ? 
                parseInt(await this.security.decrypt(descMapping.encrypted_category)) : null;
            
            // Get account name from mapping
            const acctMapping = await this.getAccountMapping(mapped.accountNumber);
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
     * Check if a transaction already exists
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
     * Import reviewed transactions
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
            console.log('Available category:', normalizedName, '→', cat.id);
        }
        
        // Create existing mappings lookup (description is stored as plain text)
        const existingDescriptions = new Set();
        for (const mapping of existingMappings) {
            existingDescriptions.add(mapping.description.toLowerCase());
        }
        
        const processedMappings = [];
        
        for (const file of files) {
            const rows = await this.parseCSV(file);
            console.log('Parsed CSV rows:', rows.length, rows);
            
            if (rows.length === 0) continue;
            
            // Detect if CSV has proper headers (Description/Category) or if we need to use column indices
            const firstRow = rows[0];
            const hasProperHeaders = 'Description' in firstRow || 'description' in firstRow;
            console.log('CSV has proper headers:', hasProperHeaders);
            
            if (!hasProperHeaders) {
                console.log('CSV appears to have no headers - using column indices');
                console.log('First row keys:', Object.keys(firstRow));
            }
            
            for (const row of rows) {
                // Try named columns first, then fall back to using first two columns by index
                let description, categoryName;
                
                if (hasProperHeaders) {
                    description = (row['Description'] || row['description'] || '').trim();
                    categoryName = (row['Category'] || row['category'] || '').trim();
                } else {
                    // Use first two columns (by their actual keys)
                    const keys = Object.keys(row);
                    description = (row[keys[0]] || '').trim();
                    categoryName = (row[keys[1]] || '').trim();
                }
                
                console.log('Processing row:', row, '→ Description:', description, 'Category:', categoryName);
                
                if (!description) {
                    console.log('Skipping row - no description');
                    continue;
                }
                
                const normalizedCategoryName = categoryName.toLowerCase();
                const categoryId = categoryByName[normalizedCategoryName] || null;
                const isDuplicate = existingDescriptions.has(description.toLowerCase());
                
                console.log(`Mapping: "${description}" → "${categoryName}" (normalized: "${normalizedCategoryName}") → ${categoryId ? 'Found' : 'NOT FOUND'}`);
                
                processedMappings.push({
                    description,
                    payee: '', // No payee in this CSV format
                    categoryName,
                    categoryId,
                    isDuplicate,
                    skip: isDuplicate // Auto-skip duplicates
                });
            }
        }
        
        console.log('Total processed mappings:', processedMappings.length, processedMappings);
        return processedMappings;
    }

    /**
     * Import reviewed mappings
     */
    async importReviewedMappings(mappingsToImport) {
        const imported = [];
        
        for (const item of mappingsToImport) {
            if (item.skip || item.isDuplicate) continue;
            if (!item.categoryId) continue; // Skip unmapped items
            
            await this.db.setMappingDescription(
                item.description,
                await this.security.encrypt(item.categoryId.toString()),
                await this.security.encrypt('') // Empty payee for this format
            );
            
            imported.push(item.description);
        }
        
        return imported;
    }
}