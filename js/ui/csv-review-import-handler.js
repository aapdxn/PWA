/**
 * CSVReviewImportHandler - CSV Import Execution & Account Mapping
 * 
 * RESPONSIBILITIES:
 * - Execute final import of reviewed transactions
 * - Auto-populate account mappings for all unique accounts
 * - Resolve auto-mapped categories before import
 * - Filter out skipped and duplicate transactions
 * - Encrypt transaction data before database storage
 * - Trigger transaction refresh after import
 * 
 * AUTO-MAPPING RESOLUTION:
 * - Transactions with suggestedCategoryId but no categoryId → use suggestion
 * - Ensures all auto-mapped items have categoryId set before encryption
 * - Preserves manual category selections over auto-suggestions
 * 
 * ENCRYPTION WORKFLOW:
 * 1. Filter non-skipped, non-duplicate items
 * 2. Resolve auto-mappings (suggestedCategoryId → categoryId)
 * 3. Ensure account mappings exist for all accounts
 * 4. CSVEngine encrypts fields and stores to database
 * 5. Count uncategorized transactions for user notification
 * 
 * @class CSVReviewImportHandler
 * @module UI/CSV
 * @layer 5 - UI Components
 */

export class CSVReviewImportHandler {
    /**
     * Initialize CSV import handler
     * 
     * @param {SecurityManager} security - For encryption operations
     * @param {DatabaseManager} db - For database access
     * @param {AccountMappingsUI} accountMappingsUI - For auto-creating account mappings
     */
    constructor(security, db, accountMappingsUI) {
        this.security = security;
        this.db = db;
        this.accountMappingsUI = accountMappingsUI;
        
        // Callback for successful import
        this.onImportSuccess = null;
    }

    /**
     * Process and import reviewed CSV transactions
     * Filters selections, resolves auto-mappings, creates account mappings, and imports
     * 
     * IMPORT STEPS:
     * 1. Filter out skipped and duplicate items
     * 2. Resolve auto-mappings (copy suggestedCategoryId to categoryId if needed)
     * 3. Extract unique account numbers
     * 4. Auto-create account mappings for all accounts
     * 5. Call CSVEngine to encrypt and store transactions
     * 6. Count uncategorized items and notify user
     * 7. Trigger transaction refresh callback
     * 
     * @param {Array<Object>} processedData - All CSV transactions from review page
     * @param {CSVEngine} csvEngine - CSV processing engine for final import
     * @returns {Promise<void>}
     * @throws {Error} If import fails (shows alert to user)
     */
    async handleImport(processedData, csvEngine) {
        // Filter out skipped and duplicate items
        const toImport = processedData.filter(item => !item.skip && !item.isDuplicate);
        
        if (toImport.length === 0) {
            alert('No transactions selected for import');
            return;
        }
        
        // Prepare items for import - ensure categoryId is set for auto-mapped items
        const preparedItems = toImport.map(item => {
            // If categoryId is not set but suggestedCategoryId is, use it (Auto mode)
            if (!item.categoryId && item.suggestedCategoryId) {
                return { ...item, categoryId: item.suggestedCategoryId };
            }
            return item;
        });
        
        try {
            // Auto-populate account mappings for all unique accounts
            const uniqueAccounts = new Set();
            for (const item of preparedItems) {
                if (item.accountNumber) {
                    uniqueAccounts.add(item.accountNumber);
                }
            }
            for (const accountNumber of uniqueAccounts) {
                await this.accountMappingsUI.ensureAccountMappingExists(accountNumber);
            }
            
            // SECURITY: CSVEngine will encrypt all fields before database storage
            const imported = await csvEngine.importReviewedTransactions(preparedItems);
            
            // Count uncategorized transactions (no categoryId and no encrypted_linkedTransactionId field)
            const uncategorized = imported.filter(t => !t.categoryId && t.encrypted_linkedTransactionId === undefined);
            
            let message = `Successfully imported ${imported.length} transaction(s)`;
            if (uncategorized.length > 0) {
                message += `\n\n${uncategorized.length} transaction(s) have no category assigned.`;
            }
            alert(message);
            
            // Trigger transaction refresh if available
            if (this.onImportSuccess) {
                await this.onImportSuccess();
            }
        } catch (error) {
            console.error('CSV import failed:', error);
            alert('Import failed: ' + error.message);
        }
    }
}
