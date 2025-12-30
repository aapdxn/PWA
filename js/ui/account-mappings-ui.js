/**
 * AccountMappingsUI - Account number to friendly name mapping manager
 * 
 * RESPONSIBILITIES:
 * - Render account mappings table with account numbers and assigned names
 * - Auto-populate mappings for all unique account numbers in transactions
 * - Provide edit interface for assigning friendly names to account numbers
 * - Encrypt and store account name mappings in IndexedDB
 * - Display unmapped accounts with "Not mapped yet" indicator
 * - Resolve account display names for transaction rendering
 * 
 * STATE REQUIREMENTS:
 * - Unlocked state (requires encryption/decryption access)
 * - Database access for mappings_accounts table
 * - Transactions must be loaded to extract unique account numbers
 * 
 * MAPPING WORKFLOW:
 * 1. Extract unique account numbers from all transactions (decrypt encrypted_account)
 * 2. Ensure mapping record exists for each account (create empty if missing)
 * 3. Display table with account number (read-only) and name (editable)
 * 4. User edits name in modal → encrypt and save to mappings_accounts
 * 5. Transaction UI calls getAccountDisplayName() to resolve names
 * 
 * ENCRYPTION PATTERN:
 * - Account numbers: Stored encrypted in transactions (encrypted_account)
 * - Account names: Stored encrypted in mappings_accounts (encrypted_name)
 * - Empty mapping: encrypted_name contains encrypted empty string
 * - Decrypted display: Show account number if name not set
 * 
 * DATA STRUCTURE:
 * - mappings_accounts table: { account_number (PK), encrypted_name }
 * - Memory cache: this.accountMappings[] = { accountNumber, name (decrypted) }
 * 
 * @class AccountMappingsUI
 * @module UI/AccountMappings
 * @layer 5 - UI Components
 */
export class AccountMappingsUI {
    /**
     * Initialize account mappings UI component
     * 
     * @param {SecurityManager} security - Encryption/decryption manager
     * @param {DatabaseManager} db - IndexedDB interface via Dexie
     * @param {ModalManager} modalManager - Shared modal controller (unused in current implementation)
     */
    constructor(security, db, modalManager) {
        this.security = security;
        this.db = db;
        this.modalManager = modalManager;
        this.accountMappings = [];
    }

    /**
     * Render account mappings page with full table interface
     * 
     * WORKFLOW:
     * 1. Populate missing account mappings from existing transactions
     * 2. Load and decrypt all account mappings
     * 3. Render table with columns: Account Number, Account Name, Actions
     * 4. Show "Not mapped yet" for accounts without assigned names
     * 5. Attach edit event listeners to all rows
     * 6. Initialize Lucide icons
     * 
     * TABLE STRUCTURE:
     * - Account Number: Read-only display of account identifier
     * - Account Name: Friendly name or "<em>Not mapped yet</em>" if empty
     * - Actions: Edit button (opens modal)
     * 
     * EMPTY STATE:
     * - Shows if no account mappings exist
     * - Message: "No account mappings yet. They will appear automatically when you add transactions."
     * 
     * ERROR HANDLING:
     * - Catches errors and displays "Error loading account mappings"
     * 
     * @async
     * @returns {Promise<void>}
     */
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

    /**
     * Auto-populate account mappings for all transaction account numbers
     * 
     * WORKFLOW:
     * 1. Fetch all transactions from database
     * 2. Decrypt each encrypted_account field
     * 3. Collect unique account numbers (excluding empty/null)
     * 4. Ensure mapping exists for each account (create empty if missing)
     * 
     * PURPOSE:
     * - Ensures every account number has a mapping record
     * - Prevents orphaned accounts from appearing unmapped
     * - Called before rendering page to sync mappings with transactions
     * 
     * ENCRYPTION:
     * - Decrypts encrypted_account from each transaction
     * - Creates encrypted empty name for new mappings
     * 
     * @async
     * @returns {Promise<void>}
     */
    async populateExistingAccountMappings() {
        // Get all transactions and extract unique account numbers
        const transactions = await this.db.getAllTransactions();
        const uniqueAccounts = new Set();
        
        // STATE GUARD: Decrypt requires unlocked state
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

    /**
     * Load and decrypt all account mappings into memory
     * 
     * WORKFLOW:
     * 1. Fetch all encrypted mappings from mappings_accounts table
     * 2. Decrypt encrypted_name for each mapping
     * 3. Store in this.accountMappings with structure: {accountNumber, name}
     * 4. Sort by account number alphabetically
     * 
     * DATA TRANSFORMATION:
     * - Database: { account_number, encrypted_name }
     * - Memory: { accountNumber, name (decrypted) }
     * 
     * EMPTY NAMES:
     * - Empty encrypted_name decrypts to empty string
     * - Displayed as "Not mapped yet" in UI
     * 
     * @async
     * @returns {Promise<void>}
     */
    async loadAccountMappings() {
        const encryptedMappings = await this.db.getAllMappingsAccounts();
        
        // STATE GUARD: Decrypt requires unlocked state
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

    /**
     * Render HTML for a single account mapping table row
     * 
     * ROW STRUCTURE:
     * - Account Number: Escaped account identifier (data-account attribute for lookup)
     * - Account Name: Escaped name or "<em>Not mapped yet</em>" with .unmapped class
     * - Actions: Edit button with edit-2 icon
     * 
     * CSS CLASSES:
     * - .unmapped: Applied to account-name cell if name is empty (gray italic style)
     * - .edit-account-mapping: Click handler for edit button
     * 
     * DATA ATTRIBUTES:
     * - data-account: Stores account number for event listener lookup
     * 
     * @param {Object} mapping - Mapping object: {accountNumber, name}
     * @returns {string} HTML string for table row (<tr>...</tr>)
     */
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

    /**
     * Attach click event listeners to all edit mapping buttons
     * 
     * EVENT HANDLING:
     * - Finds .edit-account-mapping buttons
     * - Extracts account number from parent row's data-account attribute
     * - Looks up mapping object from this.accountMappings
     * - Calls showEditMappingModal(mapping)
     * 
     * DELEGATION PATTERN:
     * - Uses closest('tr') to find parent row
     * - Reads data-account for lookup key
     * 
     * @returns {void}
     */
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

    /**
     * Display modal for editing account name mapping
     * 
     * MODAL STRUCTURE:
     * - Header: "Edit Account Mapping" with close button
     * - Form:
     *   - Account Number: Read-only, disabled input (shows current account)
     *   - Account Name: Editable input (required, auto-focused)
     * - Footer: Cancel and Save Mapping buttons
     * 
     * EVENT HANDLERS:
     * - Form submit: Call saveAccountMapping(accountNumber)
     * - Close buttons: Hide modal (add .hidden class)
     * 
     * FOCUS BEHAVIOR:
     * - Auto-focus on account name input after 100ms delay
     * - Allows immediate typing without clicking
     * 
     * @param {Object} mapping - Mapping object: {accountNumber, name}
     * @returns {void}
     */
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

    /**
     * Save account name mapping to database
     * 
     * WORKFLOW:
     * 1. Extract and validate account name from form input
     * 2. Encrypt name using SecurityManager
     * 3. Save to mappings_accounts table via db.setMappingAccount()
     * 4. Close modal
     * 5. Re-render page to show updated mapping
     * 
     * VALIDATION:
     * - Requires non-empty name (shows alert if empty)
     * - Trims whitespace before saving
     * 
     * ENCRYPTION:
     * - Encrypts name before storage
     * - Account number stored as plaintext key
     * 
     * ERROR HANDLING:
     * - Catches errors and shows alert: "Error saving account mapping"
     * 
     * @async
     * @param {string} accountNumber - Account identifier (used as primary key)
     * @returns {Promise<void>}
     */
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

    /**
     * Create empty account mapping if one doesn't exist
     * 
     * WORKFLOW:
     * 1. Check if accountNumber is valid (not empty)
     * 2. Query existing mappings for this account number
     * 3. If not found, create mapping with encrypted empty name
     * 4. Log creation to console
     * 
     * PURPOSE:
     * - Ensures every account has a mapping record
     * - Called during populateExistingAccountMappings()
     * - Prevents missing mapping errors
     * 
     * ENCRYPTION:
     * - Creates encrypted empty string for unmapped accounts
     * - User can later edit to assign friendly name
     * 
     * @async
     * @param {string} accountNumber - Account identifier to check/create
     * @returns {Promise<void>}
     */
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

    /**
     * Resolve account number to friendly display name
     * 
     * RESOLUTION LOGIC:
     * 1. Return empty string if accountNumber is null/empty
     * 2. Fetch all account mappings from database
     * 3. Find mapping for given account number
     * 4. Decrypt encrypted_name if exists
     * 5. Return decrypted name if non-empty
     * 6. Fallback: Return raw account number if no mapping or empty name
     * 
     * USAGE:
     * - Called by TransactionUI to display account names in transaction list
     * - Used in transaction detail modals
     * - Provides graceful fallback for unmapped accounts
     * 
     * PERFORMANCE:
     * - Fetches all mappings on each call (could be optimized with caching)
     * - Decrypts name for matching account
     * 
     * @async
     * @param {string} accountNumber - Account identifier to resolve
     * @returns {Promise<string>} Friendly name or account number as fallback
     */
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

    /**
     * Escape HTML special characters to prevent XSS injection
     * 
     * METHOD:
     * - Creates temporary div element
     * - Sets textContent (auto-escapes HTML)
     * - Returns escaped innerHTML
     * 
     * ESCAPES:
     * - < → &lt;
     * - > → &gt;
     * - & → &amp;
     * - " → &quot;
     * - ' → &#39;
     * 
     * USAGE:
     * - Escape all user-input data before inserting into HTML
     * - Used for account numbers and names in table rows
     * - Prevents malicious account names from injecting scripts
     * 
     * @param {string} text - Raw text to escape (null-safe)
     * @returns {string} HTML-escaped string
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}
