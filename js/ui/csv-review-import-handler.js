/**
 * CSV Review Import Handler - Handles CSV import processing and account mapping
 * 
 * @module CSVReviewImportHandler
 */

export class CSVReviewImportHandler {
    constructor(security, db, accountMappingsUI) {
        this.security = security;
        this.db = db;
        this.accountMappingsUI = accountMappingsUI;
        
        // Callback for successful import
        this.onImportSuccess = null;
    }

    /**
     * Process and import reviewed CSV transactions
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
