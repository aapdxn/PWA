// SettingsUI - Handles settings tab rendering
export class SettingsUI {
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

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
