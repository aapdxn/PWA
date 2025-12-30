/**
 * TransactionPreloader - Optimized Async Transaction Loading
 * 
 * Extracts the complex preloadTransactions logic from UIManager into a
 * dedicated service. Handles parallel loading of transactions and related
 * data (categories, payees, mappings), then performs batch decryption with
 * auto-mapping resolution.
 * 
 * OPTIMIZATION STRATEGY:
 * - Parallel data loading (transactions, categories, payees, mappings)
 * - Lookup map creation for O(1) resolution
 * - Batch processing to avoid overwhelming the event loop
 * - Reuses decryptTransaction helper for consistency
 * 
 * DEPENDENCIES:
 * - DatabaseManager: For parallel data queries
 * - SecurityManager: For decryption operations
 * - ui-helpers.js: Shared decryptTransaction function
 * 
 * @module Core/TransactionPreloader
 * @layer 3 - Core Services
 */

import { decryptTransaction } from './ui-helpers.js';

export class TransactionPreloader {
    /**
     * Initialize transaction preloader with required dependencies
     * 
     * @param {DatabaseManager} database - DatabaseManager instance
     * @param {SecurityManager} security - SecurityManager instance
     */
    constructor(database, security) {
        this.db = database;
        this.security = security;
    }

    /**
     * Preload and decrypt all transactions with optimal parallelization
     * 
     * Loads all transactions and related data in parallel, builds lookup maps,
     * then decrypts transactions in batches with auto-mapping resolution.
     * 
     * PERFORMANCE:
     * - Batch size: 50 transactions per parallel batch
     * - Avoids event loop blocking
     * - Uses O(1) lookup maps for categories/payees/mappings
     * 
     * @returns {Promise<Array<Object>>} Array of fully decrypted transactions
     * @returns {number} return[].id - Transaction ID
     * @returns {string} return[].date - Decrypted date
     * @returns {number} return[].amount - Decrypted amount
     * @returns {string} return[].description - Decrypted description
     * @returns {string} return[].categoryName - Resolved category name
     * @returns {string} return[].payeeName - Resolved payee name
     * 
     * @example
     * const transactions = await preloader.preloadTransactions();
     * console.log(`Loaded ${transactions.length} transactions`);
     */
    async preloadTransactions() {
        try {
            // Load data in parallel using DatabaseManager methods
            const [transactions, categories, payees, descriptionMappings] = await Promise.all([
                this.db.getAllTransactions(),
                this.db.getAllCategories(),
                this.db.getAllPayees(),
                this.db.getAllMappingsDescriptions()
            ]);

            // Build lookup maps for fast resolution
            const categoryMap = new Map(categories.map(c => [c.id, c]));
            const payeeMap = new Map(payees.map(p => [p.id, p]));
            
            // Build normalized description→mapping lookup
            const mappingMap = new Map();
            for (const mapping of descriptionMappings) {
                const normalizedDesc = mapping.description.trim().toLowerCase();
                mappingMap.set(normalizedDesc, mapping);
            }

            // Decrypt all transactions in parallel batches
            const batchSize = 50; // Process 50 at a time to avoid overwhelming
            const decryptedTransactions = [];
            
            for (let i = 0; i < transactions.length; i += batchSize) {
                const batch = transactions.slice(i, i + batchSize);
                const decryptedBatch = await Promise.all(
                    batch.map(tx => this.decryptTransactionWithMappings(
                        tx,
                        categoryMap,
                        payeeMap,
                        mappingMap
                    ))
                );
                decryptedTransactions.push(...decryptedBatch);
            }

            return decryptedTransactions;
        } catch (error) {
            console.error('❌ Failed to preload transactions:', error);
            return [];
        }
    }

    /**
     * Decrypt a single transaction and resolve auto-mappings
     * 
     * Internal helper that wraps the shared decryptTransaction function
     * with preloader-specific context (using Maps instead of Arrays).
     * 
     * @private
     * @param {Object} tx - Encrypted transaction from database
     * @param {Map} categoryMap - Category ID → category object map
     * @param {Map} payeeMap - Payee ID → payee object map
     * @param {Map} mappingMap - Description → mapping object map
     * @returns {Promise<Object>} Fully decrypted and enriched transaction
     */
    async decryptTransactionWithMappings(tx, categoryMap, payeeMap, mappingMap) {
        // Use shared decryptTransaction helper with proper context object
        return await decryptTransaction(tx, {
            security: this.security,
            categories: Array.from(categoryMap.values()),
            payees: Array.from(payeeMap.values()),
            mappings: Array.from(mappingMap.values())
        });
    }
}
