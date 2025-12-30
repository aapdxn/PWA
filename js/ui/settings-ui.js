/**
 * SettingsUI - Application settings and data management interface
 * 
 * RESPONSIBILITIES:
 * - Render settings tab with navigation buttons
 * - Manage data clearing operations (transactions, mappings, all data)
 * - Handle transfer unlinking functionality
 * - Navigate to account mappings and description mappings pages
 * - Provide multi-step confirmation flows for destructive actions
 * - Execute complete data reset with reload
 * 
 * STATE REQUIREMENTS:
 * - Unlocked state (requires access to encrypted data)
 * - Database access for clearing operations
 * - Security manager for key clearing on reset
 * 
 * NAVIGATION:
 * - Account Mappings: Show account-mappings-page, hide tabs/nav
 * - Description Mappings: Show tab-mappings, hide tabs/nav
 * - Uses custom events to trigger page-specific renders
 * 
 * DANGER ZONE OPERATIONS:
 * - Unlink All Transfers: Remove linkedTransactionId from all transactions
 * - Clear Transactions: Delete all transaction records (preserve categories/budgets/mappings)
 * - Clear Mappings: Delete all description mappings (preserve transactions/categories)
 * - Reset All Data: Nuclear option - delete everything and reload
 * 
 * CONFIRMATION WORKFLOW:
 * - Reset Data: Two-step modal confirmation (warning → final confirmation)
 * - Clear Operations: Single confirmation modal
 * - All confirmations use danger/warning color coding
 * 
 * @class SettingsUI
 * @module UI/Settings
 * @layer 5 - UI Components
 */
export class SettingsUI {
    /**
     * Initialize settings UI component
     * 
     * @param {SecurityManager} security - Encryption/decryption and key management
     * @param {DatabaseManager} db - IndexedDB interface via Dexie
     */
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

    /**
     * Render settings tab with navigation buttons and danger zone
     * 
     * SECTIONS:
     * 1. Data Management:
     *    - Account Name Mappings (navigates to account-mappings-page)
     *    - Description Mappings (navigates to tab-mappings)
     * 2. Danger Zone:
     *    - Unlink All Transfers (warning color)
     *    - Clear All Transactions (warning color)
     *    - Clear Description Mappings (warning color)
     *    - Reset All Data (danger color)
     * 
     * BUTTON STRUCTURE:
     * - Left icon (action type)
     * - Center text (action name)
     * - Right icon (chevron for navigation, alert for danger)
     * 
     * EVENT LISTENERS:
     * - Attached via attachSettingsEventListeners() after DOM insertion
     * 
     * @returns {void}
     */
    renderSettingsTab() {
        console.log('⚙️ Rendering settings tab');
        const container = document.getElementById('settings-content');
        if (container) {
            container.innerHTML = `
                <div class="settings-container">
                    <h3>Settings</h3>
                    
                    <div class="settings-section">
                        <h4>Data Management</h4>
                        <button class="btn-secondary settings-btn" id="btn-account-mappings">
                            <i data-lucide="credit-card"></i>
                            <span>Account Name Mappings</span>
                            <i data-lucide="chevron-right"></i>
                        </button>
                        <button class="btn-secondary settings-btn" id="btn-category-mappings">
                            <i data-lucide="link"></i>
                            <span>Description Mappings</span>
                            <i data-lucide="chevron-right"></i>
                        </button>
                    </div>
                    
                    <div class="settings-section">
                        <h4>Danger Zone</h4>
                        <button class="btn-secondary settings-btn" id="btn-unlink-transfers" style="color: var(--warning-color); border-color: var(--warning-color);">
                            <i data-lucide="unlink"></i>
                            <span>Unlink All Transfers</span>
                            <i data-lucide="alert-circle"></i>
                        </button>
                        <button class="btn-secondary settings-btn" id="btn-clear-transactions" style="color: var(--warning-color); border-color: var(--warning-color);">
                            <i data-lucide="receipt"></i>
                            <span>Clear All Transactions</span>
                            <i data-lucide="alert-circle"></i>
                        </button>
                        <button class="btn-secondary settings-btn" id="btn-clear-mappings" style="color: var(--warning-color); border-color: var(--warning-color);">
                            <i data-lucide="link-2"></i>
                            <span>Clear Description Mappings</span>
                            <i data-lucide="alert-circle"></i>
                        </button>
                        <button class="btn-secondary settings-btn" id="btn-reset-data" style="color: var(--danger-color); border-color: var(--danger-color);">
                            <i data-lucide="trash-2"></i>
                            <span>Reset All Data</span>
                            <i data-lucide="alert-triangle"></i>
                        </button>
                    </div>
                </div>
            `;

            // Initialize Lucide icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            // Attach event listeners
            this.attachSettingsEventListeners();
        }
    }

    /**
     * Attach click event listeners to all settings buttons
     * 
     * ATTACHED LISTENERS:
     * - btn-account-mappings: Navigate to account mappings page
     * - btn-category-mappings: Navigate to description mappings page
     * - btn-unlink-transfers: Show unlink confirmation dialog
     * - btn-clear-transactions: Show clear transactions warning
     * - btn-clear-mappings: Show clear mappings warning
     * - btn-reset-data: Show reset data warning (first of two-step confirmation)
     * 
     * @returns {void}
     */
    attachSettingsEventListeners() {
        const accountMappingsBtn = document.getElementById('btn-account-mappings');
        if (accountMappingsBtn) {
            accountMappingsBtn.addEventListener('click', () => {
                this.navigateToAccountMappings();
            });
        }
        
        const categoryMappingsBtn = document.getElementById('btn-category-mappings');
        if (categoryMappingsBtn) {
            categoryMappingsBtn.addEventListener('click', () => {
                this.navigateToCategoryMappings();
            });
        }
        
        const unlinkTransfersBtn = document.getElementById('btn-unlink-transfers');
        if (unlinkTransfersBtn) {
            unlinkTransfersBtn.addEventListener('click', () => {
                this.showUnlinkTransfersWarning();
            });
        }
        
        const clearTransactionsBtn = document.getElementById('btn-clear-transactions');
        if (clearTransactionsBtn) {
            clearTransactionsBtn.addEventListener('click', () => {
                this.showClearTransactionsWarning();
            });
        }
        
        const clearMappingsBtn = document.getElementById('btn-clear-mappings');
        if (clearMappingsBtn) {
            clearMappingsBtn.addEventListener('click', () => {
                this.showClearMappingsWarning();
            });
        }
        
        const resetDataBtn = document.getElementById('btn-reset-data');
        if (resetDataBtn) {
            resetDataBtn.addEventListener('click', () => {
                this.showResetDataWarning();
            });
        }
    }

    /**
     * Show first warning modal for reset data operation
     * 
     * MODAL CONTENT:
     * - Red alert icon and title
     * - Bulleted list of data to be deleted:
     *   - All transactions
     *   - All categories and budgets
     *   - All mappings
     *   - Master password
     *   - All settings
     * - Warning: "This action cannot be undone."
     * 
     * ACTIONS:
     * - Cancel: Close modal
     * - I Understand: Proceed to showResetDataConfirmation (second confirmation)
     * 
     * @returns {void}
     */
    showResetDataWarning() {
        const modalHTML = `
            <div class="modal-overlay" id="reset-warning-modal">
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h2 style="color: var(--danger-color); display: flex; align-items: center; gap: 0.5rem;">
                            <i data-lucide="alert-triangle"></i>
                            Warning: Irreversible Action
                        </h2>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 1rem;">This will permanently delete:</p>
                        <ul style="margin: 0 0 1rem 1.5rem; line-height: 1.8;">
                            <li>All transactions</li>
                            <li>All categories and budgets</li>
                            <li>All mappings</li>
                            <li>Your master password</li>
                            <li>All settings</li>
                        </ul>
                        <p style="font-weight: 600; color: var(--danger-color);">This action cannot be undone.</p>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="reset-warning-cancel">Cancel</button>
                        <button class="btn btn-primary" id="reset-warning-acknowledge" style="background: var(--danger-color); border-color: var(--danger-color);">I Understand</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('reset-warning-modal');
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        document.getElementById('reset-warning-cancel').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('reset-warning-acknowledge').addEventListener('click', () => {
            modal.remove();
            this.showResetDataConfirmation();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Show confirmation dialog for unlinking all transfer transactions
     * 
     * WORKFLOW:
     * - Count transactions with encrypted_linkedTransactionId
     * - Display count in confirmation dialog
     * - If no linked transfers, show alert and exit
     * - On confirmation, call unlinkAllTransfers()
     * 
     * TRANSFER LINKING:
     * - Linked transfers have encrypted_linkedTransactionId pointing to paired transaction
     * - Unlinking removes connection but preserves both transactions
     * - Used to break transfer pairs (e.g., after importing duplicates)
     * 
     * @async
     * @returns {Promise<void>}
     */
    async showUnlinkTransfersWarning() {
        const allTransactions = await this.db.getAllTransactions();
        const linkedCount = allTransactions.filter(t => t.encrypted_linkedTransactionId).length;
        
        if (linkedCount === 0) {
            alert('No linked transfers found.');
            return;
        }
        
        const confirmed = confirm(`This will unlink all ${linkedCount} linked transfer transactions, keeping the transactions but removing their connections.\n\nThis action cannot be undone. Continue?`);
        
        if (confirmed) {
            await this.unlinkAllTransfers();
        }
    }

    /**
     * Remove all transfer links from transactions
     * 
     * OPERATION:
     * - Iterate through all transactions
     * - Set encrypted_linkedTransactionId to null for linked transactions
     * - Save each modified transaction back to database
     * - Count and report number of unlinked transactions
     * 
     * POST-OPERATION:
     * - Display success alert with count
     * - Trigger transaction tab refresh if UIManager available
     * 
     * @async
     * @returns {Promise<void>}
     * @throws {Error} If database operation fails
     */
    async unlinkAllTransfers() {
        try {
            const allTransactions = await this.db.getAllTransactions();
            let unlinkCount = 0;
            
            for (const transaction of allTransactions) {
                if (transaction.encrypted_linkedTransactionId) {
                    transaction.encrypted_linkedTransactionId = null;
                    await this.db.saveTransaction(transaction);
                    unlinkCount++;
                }
            }
            
            alert(`Successfully unlinked ${unlinkCount} transfer transactions.`);
            
            // Trigger a refresh if there's a callback
            if (window.uiManager) {
                await window.uiManager.transactionUI.renderTransactionsTab();
            }
        } catch (error) {
            console.error('Failed to unlink transfers:', error);
            alert('Failed to unlink transfers: ' + error.message);
        }
    }

    /**
     * Show second (final) confirmation modal for reset data operation
     * 
     * MODAL CONTENT:
     * - Title: "Are You Sure?"
     * - Message: Final warning about permanent deletion
     * - "This is your last chance to cancel."
     * 
     * ACTIONS:
     * - Cancel: Close modal and abort operation
     * - Delete All Data (danger color): Execute resetAllData()
     * 
     * WORKFLOW:
     * - Called from showResetDataWarning after user acknowledges first warning
     * - Final checkpoint before irreversible data deletion
     * 
     * @returns {void}
     */
    showResetDataConfirmation() {
        const modalHTML = `
            <div class="modal-overlay" id="reset-confirm-modal">
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h2 style="color: var(--danger-color);">Are You Sure?</h2>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 1rem;">All your data will be permanently deleted and you will be returned to the setup screen.</p>
                        <p style="font-weight: 600;">This is your last chance to cancel.</p>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="reset-confirm-cancel">Cancel</button>
                        <button class="btn btn-primary" id="reset-confirm-delete" style="background: var(--danger-color); border-color: var(--danger-color);">Delete All Data</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('reset-confirm-modal');
        
        document.getElementById('reset-confirm-cancel').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('reset-confirm-delete').addEventListener('click', async () => {
            modal.remove();
            await this.resetAllData();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Execute complete data reset and reload application
     * 
     * OPERATION STEPS:
     * 1. Display loading overlay ("Deleting all data...")
     * 2. Call db.clearAllData() to wipe IndexedDB
     * 3. Clear encryption keys from SecurityManager memory
     * 4. Reload page (returns user to setup screen)
     * 
     * DATA DELETED:
     * - All transactions
     * - All categories and budgets
     * - All mappings (account and description)
     * - Master password hash
     * - All settings
     * 
     * POST-RESET STATE:
     * - User returned to initial setup screen
     * - Must create new master password
     * - Fresh IndexedDB with no data
     * 
     * @async
     * @returns {Promise<void>}
     * @throws {Error} Shows alert if reset fails (with manual clearing instructions)
     */
    async resetAllData() {
        try {
            // Show loading indicator
            const loadingHTML = `
                <div class="modal-overlay" id="reset-loading-modal" style="background: rgba(0, 0, 0, 0.9);">
                    <div style="text-align: center; color: white;">
                        <div style="font-size: 2rem; margin-bottom: 1rem;">🔄</div>
                        <p>Deleting all data...</p>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', loadingHTML);
            
            // Clear all data
            await this.db.clearAllData();
            
            // Clear security keys from memory
            this.security.masterKey = null;
            this.security.encryptionKey = null;
            
            // Reload the page to start fresh
            window.location.reload();
        } catch (error) {
            console.error('Error resetting data:', error);
            alert('An error occurred while resetting data. Please try again or clear your browser data manually.');
        }
    }

    /**
     * Navigate to account mappings page (hide tabs, show dedicated page)
     * 
     * NAVIGATION WORKFLOW:
     * 1. Hide all .tab-content elements
     * 2. Show #account-mappings-page
     * 3. Hide bottom navigation bar
     * 4. Hide all FABs (floating action buttons)
     * 5. Dispatch 'show-account-mappings' custom event
     * 
     * EVENT HANDLING:
     * - UIManager listens for 'show-account-mappings' event
     * - Triggers AccountMappingsUI.renderAccountMappingsPage()
     * 
     * @returns {void}
     */
    navigateToAccountMappings() {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
            tab.classList.add('hidden');
        });

        // Show account mappings page
        const accountMappingsPage = document.getElementById('account-mappings-page');
        if (accountMappingsPage) {
            accountMappingsPage.classList.remove('hidden');
            accountMappingsPage.classList.add('active');
        }

        // Hide bottom nav and FABs
        document.querySelector('.bottom-nav')?.classList.add('hidden');
        document.querySelectorAll('.fab').forEach(fab => fab.classList.add('hidden'));

        // Trigger render via custom event
        window.dispatchEvent(new CustomEvent('show-account-mappings'));
    }

    /**
     * Navigate to description mappings page (hide tabs, show mappings tab)
     * 
     * NAVIGATION WORKFLOW:
     * 1. Hide all .tab-content elements
     * 2. Show #tab-mappings
     * 3. Hide bottom navigation bar
     * 4. Hide all FABs
     * 5. Show #fab-add-mapping (dedicated FAB for adding mappings)
     * 6. Dispatch 'show-category-mappings' custom event
     * 
     * EVENT HANDLING:
     * - UIManager listens for 'show-category-mappings' event
     * - Triggers MappingsUI.renderMappingsTab()
     * 
     * @returns {void}
     */
    navigateToCategoryMappings() {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
            tab.classList.add('hidden');
        });

        // Show description mappings page
        const categoryMappingsPage = document.getElementById('tab-mappings');
        if (categoryMappingsPage) {
            categoryMappingsPage.classList.remove('hidden');
            categoryMappingsPage.classList.add('active');
        }

        // Hide bottom nav and show FAB for mappings
        document.querySelector('.bottom-nav')?.classList.add('hidden');
        document.querySelectorAll('.fab').forEach(fab => fab.classList.add('hidden'));
        const mappingFab = document.getElementById('fab-add-mapping');
        if (mappingFab) {
            mappingFab.classList.remove('hidden');
        }

        // Trigger render via custom event
        window.dispatchEvent(new CustomEvent('show-category-mappings'));
    }

    /**
     * Show confirmation modal for clearing all transactions
     * 
     * MODAL CONTENT:
     * - Warning icon and title (warning color)
     * - Description: "Permanently delete all transaction records"
     * - Note: "Your categories, budgets, and mappings will be preserved."
     * - Warning: "This action cannot be undone."
     * 
     * ACTIONS:
     * - Cancel: Close modal
     * - Clear Transactions (warning color): Execute clearTransactionsData()
     * 
     * DATA PRESERVED:
     * - All categories and budgets
     * - All mappings (account and description)
     * - Master password and settings
     * 
     * @returns {void}
     */
    showClearTransactionsWarning() {
        const modalHTML = `
            <div class="modal-overlay" id="clear-transactions-modal">
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h2 style="color: var(--warning-color); display: flex; align-items: center; gap: 0.5rem;">
                            <i data-lucide="alert-circle"></i>
                            Clear All Transactions
                        </h2>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 1rem;">This will permanently delete all transaction records.</p>
                        <p style="font-weight: 600;">Your categories, budgets, and mappings will be preserved.</p>
                        <p style="color: var(--danger-color); margin-top: 1rem;">This action cannot be undone.</p>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="clear-transactions-cancel">Cancel</button>
                        <button class="btn btn-primary" id="clear-transactions-confirm" style="background: var(--warning-color); border-color: var(--warning-color);">Clear Transactions</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('clear-transactions-modal');
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        document.getElementById('clear-transactions-cancel').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('clear-transactions-confirm').addEventListener('click', async () => {
            modal.remove();
            await this.clearTransactionsData();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Show confirmation modal for clearing all description mappings
     * 
     * MODAL CONTENT:
     * - Warning icon and title (warning color)
     * - Description: "Permanently delete all description mapping rules"
     * - Note: "Your transactions, categories, and budgets will be preserved."
     * - Warning: "This action cannot be undone."
     * 
     * ACTIONS:
     * - Cancel: Close modal
     * - Clear Mappings (warning color): Execute clearMappingsData()
     * 
     * DATA PRESERVED:
     * - All transactions
     * - All categories and budgets
     * - Account mappings
     * - Master password and settings
     * 
     * @returns {void}
     */
    showClearMappingsWarning() {
        const modalHTML = `
            <div class="modal-overlay" id="clear-mappings-modal">
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h2 style="color: var(--warning-color); display: flex; align-items: center; gap: 0.5rem;">
                            <i data-lucide="alert-circle"></i>
                            Clear Description Mappings
                        </h2>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 1rem;">This will permanently delete all description mapping rules.</p>
                        <p style="font-weight: 600;">Your transactions, categories, and budgets will be preserved.</p>
                        <p style="color: var(--danger-color); margin-top: 1rem;">This action cannot be undone.</p>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="clear-mappings-cancel">Cancel</button>
                        <button class="btn btn-primary" id="clear-mappings-confirm" style="background: var(--warning-color); border-color: var(--warning-color);">Clear Mappings</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('clear-mappings-modal');
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        document.getElementById('clear-mappings-cancel').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('clear-mappings-confirm').addEventListener('click', async () => {
            modal.remove();
            await this.clearMappingsData();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Execute transaction clearing operation
     * 
     * OPERATION STEPS:
     * 1. Display loading overlay ("Clearing transactions...")
     * 2. Call db.clearTransactions() to delete all transaction records
     * 3. Remove loading overlay
     * 4. Show success alert
     * 5. Dispatch 'data-updated' custom event to refresh UI
     * 
     * DATABASE OPERATION:
     * - Deletes all records from 'transactions' table
     * - Preserves all other tables (categories, payees, mappings, settings)
     * 
     * ERROR HANDLING:
     * - Catches errors and shows alert with error message
     * - Removes loading overlay on error
     * 
     * @async
     * @returns {Promise<void>}
     * @throws {Error} If database clear operation fails
     */
    async clearTransactionsData() {
        try {
            const loadingHTML = `
                <div class="modal-overlay" id="clear-loading-modal" style="background: rgba(0, 0, 0, 0.9);">
                    <div style="text-align: center; color: white;">
                        <div style="font-size: 2rem; margin-bottom: 1rem;">🔄</div>
                        <p>Clearing transactions...</p>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', loadingHTML);
            
            await this.db.clearTransactions();
            
            document.getElementById('clear-loading-modal')?.remove();
            
            // Show success message
            alert('All transactions have been cleared successfully.');
            
            // Refresh the current view if on transactions tab
            window.dispatchEvent(new CustomEvent('data-updated'));
        } catch (error) {
            console.error('Error clearing transactions:', error);
            document.getElementById('clear-loading-modal')?.remove();
            alert('An error occurred while clearing transactions. Please try again.');
        }
    }

    /**
     * Execute description mappings clearing operation
     * 
     * OPERATION STEPS:
     * 1. Display loading overlay ("Clearing description mappings...")
     * 2. Call db.clearMappings() to delete all mapping records
     * 3. Remove loading overlay
     * 4. Show success alert
     * 5. Dispatch 'data-updated' custom event to refresh UI
     * 
     * DATABASE OPERATION:
     * - Deletes all records from 'mappings_descriptions' table
     * - Preserves account mappings, transactions, categories, settings
     * 
     * IMPACT:
     * - Existing transactions with useAutoCategory/useAutoPayee lose mappings
     * - Auto-mapped transactions will show as unmapped until new mappings created
     * - Manually-set categories/payees on transactions are unaffected
     * 
     * ERROR HANDLING:
     * - Catches errors and shows alert with error message
     * - Removes loading overlay on error
     * 
     * @async
     * @returns {Promise<void>}
     * @throws {Error} If database clear operation fails
     */
    async clearMappingsData() {
        try {
            const loadingHTML = `
                <div class="modal-overlay" id="clear-loading-modal" style="background: rgba(0, 0, 0, 0.9);">
                    <div style="text-align: center; color: white;">
                        <div style="font-size: 2rem; margin-bottom: 1rem;">🔄</div>
                        <p>Clearing description mappings...</p>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', loadingHTML);
            
            await this.db.clearMappings();
            
            document.getElementById('clear-loading-modal')?.remove();
            
            // Show success message
            alert('All description mappings have been cleared successfully.');
            
            // Refresh the current view if on mappings tab
            window.dispatchEvent(new CustomEvent('data-updated'));
        } catch (error) {
            console.error('Error clearing mappings:', error);
            document.getElementById('clear-loading-modal')?.remove();
            alert('An error occurred while clearing mappings. Please try again.');
        }
    }
}
