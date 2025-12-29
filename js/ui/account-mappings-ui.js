// AccountMappingsUI - Account number to name mapping management
export class AccountMappingsUI {
    constructor(security, db, modalManager) {
        this.security = security;
        this.db = db;
        this.modalManager = modalManager;
        this.accountMappings = [];
    }

    async renderAccountMappingsPage() {
        console.log('🔢 Rendering account mappings page');
        const container = document.getElementById('account-mappings-content');
        if (!container) return;

        try {
            // First, ensure all existing transactions have account mappings
            await this.populateExistingAccountMappings();
            
            await this.loadAccountMappings();
            
            container.innerHTML = `
                <div class="mappings-container">
                    <div class="mappings-header">
                        <h3>Account Name Mappings</h3>
                        <p class="info-text">Map account numbers to friendly names. Unmapped accounts will appear here automatically when transactions are added.</p>
                    </div>
                    
                    <div class="mappings-table-wrapper">
                        <table class="mappings-table">
                            <thead>
                                <tr>
                                    <th>Account Number</th>
                                    <th>Account Name</th>
                                    <th class="actions-col">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="account-mappings-tbody">
                                ${this.accountMappings.length === 0 ? 
                                    '<tr><td colspan="3" class="empty-state">No account mappings yet. They will appear automatically when you add transactions.</td></tr>' :
                                    this.accountMappings.map(mapping => this.renderMappingRow(mapping)).join('')
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            // Attach event listeners for edit/delete actions
            this.attachMappingEventListeners();

            // Initialize Lucide icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        } catch (error) {
            console.error('Error rendering account mappings:', error);
            container.innerHTML = `<p class="error-text">Error loading account mappings</p>`;
        }
    }

    async populateExistingAccountMappings() {
        // Get all transactions and extract unique account numbers
        const transactions = await this.db.getAllTransactions();
        const uniqueAccounts = new Set();
        
        for (const t of transactions) {
            if (t.encrypted_account) {
                const account = await this.security.decrypt(t.encrypted_account);
                if (account && account.trim() !== '') {
                    uniqueAccounts.add(account);
                }
            }
        }
        
        // Ensure mapping exists for each account
        for (const accountNumber of uniqueAccounts) {
            await this.ensureAccountMappingExists(accountNumber);
        }
    }

    async loadAccountMappings() {
        const encryptedMappings = await this.db.getAllMappingsAccounts();
        
        // Decrypt all mappings
        this.accountMappings = await Promise.all(
            encryptedMappings.map(async (mapping) => {
                const decryptedName = mapping.encrypted_name ? 
                    await this.security.decrypt(mapping.encrypted_name) : '';
                
                return {
                    accountNumber: mapping.account_number,
                    name: decryptedName
                };
            })
        );

        // Sort by account number
        this.accountMappings.sort((a, b) => {
            const aNum = a.accountNumber || '';
            const bNum = b.accountNumber || '';
            return aNum.localeCompare(bNum);
        });
    }

    renderMappingRow(mapping) {
        const hasName = mapping.name && mapping.name.trim() !== '';
        
        return `
            <tr data-account="${this.escapeHtml(mapping.accountNumber)}">
                <td class="account-number">${this.escapeHtml(mapping.accountNumber)}</td>
                <td class="account-name ${!hasName ? 'unmapped' : ''}">
                    ${hasName ? this.escapeHtml(mapping.name) : '<em>Not mapped yet</em>'}
                </td>
                <td class="actions-col">
                    <button class="icon-btn edit-account-mapping" title="Edit">
                        <i data-lucide="edit-2"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    attachMappingEventListeners() {
        // Edit mapping
        document.querySelectorAll('.edit-account-mapping').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                const accountNumber = row.dataset.account;
                const mapping = this.accountMappings.find(m => m.accountNumber === accountNumber);
                if (mapping) {
                    this.showEditMappingModal(mapping);
                }
            });
        });
    }

    showEditMappingModal(mapping) {
        const modal = document.getElementById('account-mapping-modal');
        if (!modal) return;

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Account Mapping</h3>
                    <button class="icon-btn close-modal" data-modal="account-mapping-modal">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="account-mapping-form">
                    <div class="input-group">
                        <label for="account-mapping-number">Account Number</label>
                        <input type="text" id="account-mapping-number" 
                               value="${this.escapeHtml(mapping.accountNumber)}" 
                               readonly disabled>
                    </div>
                    <div class="input-group">
                        <label for="account-mapping-name">Account Name *</label>
                        <input type="text" id="account-mapping-name" 
                               value="${this.escapeHtml(mapping.name || '')}"
                               placeholder="e.g., Chase Checking, Savings Account"
                               required autocomplete="off">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary close-modal" data-modal="account-mapping-modal">
                            Cancel
                        </button>
                        <button type="submit" class="btn-primary">
                            Save Mapping
                        </button>
                    </div>
                </form>
            </div>
        `;

        modal.classList.remove('hidden');
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Focus on name input
        setTimeout(() => {
            document.getElementById('account-mapping-name')?.focus();
        }, 100);

        // Handle form submission
        const form = document.getElementById('account-mapping-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveAccountMapping(mapping.accountNumber);
        });

        // Handle close buttons
        modal.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        });
    }

    async saveAccountMapping(accountNumber) {
        try {
            const nameInput = document.getElementById('account-mapping-name');
            const name = nameInput.value.trim();

            if (!name) {
                alert('Please enter an account name');
                return;
            }

            // Encrypt and save
            const encryptedName = await this.security.encrypt(name);
            await this.db.setMappingAccount(accountNumber, encryptedName);

            // Close modal
            document.getElementById('account-mapping-modal').classList.add('hidden');

            // Refresh the page
            await this.renderAccountMappingsPage();
        } catch (error) {
            console.error('Error saving account mapping:', error);
            alert('Error saving account mapping');
        }
    }

    async ensureAccountMappingExists(accountNumber) {
        if (!accountNumber || accountNumber.trim() === '') return;

        const existingMapping = await this.db.getAllMappingsAccounts();
        const found = existingMapping.find(m => m.account_number === accountNumber);

        if (!found) {
            // Create empty mapping (unmapped)
            await this.db.setMappingAccount(accountNumber, await this.security.encrypt(''));
            console.log(`Created empty mapping for account: ${accountNumber}`);
        }
    }

    async getAccountDisplayName(accountNumber) {
        if (!accountNumber) return '';

        const mappings = await this.db.getAllMappingsAccounts();
        const mapping = mappings.find(m => m.account_number === accountNumber);

        if (mapping && mapping.encrypted_name) {
            const decryptedName = await this.security.decrypt(mapping.encrypted_name);
            if (decryptedName && decryptedName.trim() !== '') {
                return decryptedName;
            }
        }

        // Return raw account number as fallback
        return accountNumber;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}
