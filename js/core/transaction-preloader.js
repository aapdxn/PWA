/**
 * Transaction Preloader - Optimized async transaction loading
 * Extracts the complex preloadTransactions logic from UIManager
 * Handles parallel loading, auto-mapping resolution, and decryption
 * 
 * @module TransactionPreloader
 */

import { decryptTransaction } from './ui-helpers.js';

export class TransactionPreloader {
    constructor(database, security) {
        this.db = database;
        this.security = security;
    }

    /**
     * Preload and decrypt all transactions with optimal parallelization
     * @returns {Promise<Array>} Decrypted transaction objects
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
     * @private
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
