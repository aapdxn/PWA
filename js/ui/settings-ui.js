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
                            <span>Category Mappings</span>
                            <i data-lucide="chevron-right"></i>
                        </button>
                    </div>
                    
                    <div class="settings-section">
                        <h4>Danger Zone</h4>
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

        // Show category mappings page
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
}
