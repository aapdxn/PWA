/* ==================== SECURITY MANAGER ==================== */
class SecurityManager {
    constructor() {
        this.cryptoKey = null;
        this.salt = null;
    }

    // Generate a random salt for key derivation
    generateSalt() {
        return window.crypto.getRandomValues(new Uint8Array(16));
    }

    // Generate a random IV for AES-GCM encryption
    generateIV() {
        return window.crypto.getRandomValues(new Uint8Array(12));
    }

    // Convert Uint8Array to Base64 string for storage
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Convert Base64 string back to Uint8Array
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // Derive a CryptoKey from password using PBKDF2
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordKey = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        return await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

    // Create a password hash for verification (separate from encryption key)
    async hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const passwordKey = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );

        const bits = await window.crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            256
        );

        return this.arrayBufferToBase64(bits);
    }

    // Encrypt data using AES-GCM
    async encrypt(plaintext) {
        if (!this.cryptoKey) {
            throw new Error('Encryption key not initialized');
        }

        const encoder = new TextEncoder();
        const iv = this.generateIV();
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            this.cryptoKey,
            encoder.encode(plaintext)
        );

        return {
            ciphertext: this.arrayBufferToBase64(encrypted),
            iv: this.arrayBufferToBase64(iv)
        };
    }

    // Decrypt data using AES-GCM
    async decrypt(encryptedData) {
        if (!this.cryptoKey) {
            throw new Error('Decryption key not initialized');
        }

        const decoder = new TextDecoder();
        const iv = this.base64ToArrayBuffer(encryptedData.iv);
        const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            this.cryptoKey,
            ciphertext
        );

        return decoder.decode(decrypted);
    }

    // Initialize encryption with a password (for setup and unlock)
    async initialize(password, storedSalt = null) {
        this.salt = storedSalt || this.generateSalt();
        this.cryptoKey = await this.deriveKey(password, this.salt);
        return this.salt;
    }

    // Verify password against stored hash
    async verifyPassword(password, storedHash, storedSalt) {
        const salt = this.base64ToArrayBuffer(storedSalt);
        const hash = await this.hashPassword(password, salt);
        return hash === storedHash;
    }

    // Clear encryption key from memory (lock)
    clear() {
        this.cryptoKey = null;
        this.salt = null;
    }
}

/* ==================== DATABASE MANAGER ==================== */
class DatabaseManager {
    constructor() {
        this.db = new Dexie('VaultBudgetDB');
        this.db.version(1).stores({
            settings: 'key',
            categories: '++id',
            transactions: '++id, categoryId'
        });
    }

    // Settings
    async getSetting(key) {
        const result = await this.db.settings.get(key);
        return result ? result.value : null;
    }

    async setSetting(key, value) {
        await this.db.settings.put({ key, value });
    }

    // Categories
    async addCategory(encryptedData) {
        return await this.db.categories.add(encryptedData);
    }

    async getCategories() {
        return await this.db.categories.toArray();
    }

    async updateCategory(id, encryptedData) {
        await this.db.categories.update(id, encryptedData);
    }

    async deleteCategory(id) {
        await this.db.categories.delete(id);
        // Also delete associated transactions
        await this.db.transactions.where('categoryId').equals(id).delete();
    }

    // Transactions
    async addTransaction(encryptedData) {
        return await this.db.transactions.add(encryptedData);
    }

    async getTransactions() {
        return await this.db.transactions.toArray();
    }

    async updateTransaction(id, encryptedData) {
        await this.db.transactions.update(id, encryptedData);
    }

    async deleteTransaction(id) {
        await this.db.transactions.delete(id);
    }

    async getTransactionsByCategory(categoryId) {
        return await this.db.transactions.where('categoryId').equals(categoryId).toArray();
    }

    // Reset all data
    async resetDatabase() {
        await this.db.delete();
        this.db = new Dexie('VaultBudgetDB');
        this.db.version(1).stores({
            settings: 'key',
            categories: '++id',
            transactions: '++id, categoryId'
        });
    }
}

/* ==================== APPLICATION MANAGER ==================== */
class App {
    constructor() {
        this.security = new SecurityManager();
        this.database = new DatabaseManager();
        this.currentState = null;
        this.decryptedCategories = [];
        this.decryptedTransactions = [];
        this.editingTransactionId = null;
        this.editingCategoryId = null;

        this.init();
    }

    async init() {
        // Check if password is already set
        const passwordHash = await this.database.getSetting('password_hash');
        
        if (!passwordHash) {
            this.showScreen('setup');
        } else {
            this.showScreen('locked');
        }

        this.attachEventListeners();
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    attachEventListeners() {
        // Setup screen
        document.getElementById('setup-submit')?.addEventListener('click', () => this.handleSetup());
        document.getElementById('setup-password')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSetup();
        });

        // Locked screen
        document.getElementById('unlock-submit')?.addEventListener('click', () => this.handleUnlock());
        document.getElementById('unlock-password')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleUnlock();
        });

        // Dashboard
        document.getElementById('lock-btn')?.addEventListener('click', () => this.handleLock());
        
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.closest('.tab-btn').dataset.tab));
        });

        // Category actions
        document.getElementById('add-category-btn')?.addEventListener('click', () => this.showCategoryModal());
        document.getElementById('category-form')?.addEventListener('submit', (e) => this.handleCategorySubmit(e));

        // Transaction actions
        document.getElementById('add-transaction-btn')?.addEventListener('click', () => this.showTransactionModal());
        document.getElementById('transaction-form')?.addEventListener('submit', (e) => this.handleTransactionSubmit(e));

        // Settings actions
        document.getElementById('export-btn')?.addEventListener('click', () => this.exportData());
        document.getElementById('reset-btn')?.addEventListener('click', () => this.handleReset());

        // Modal close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.closest('.close-modal').dataset.modal;
                this.hideModal(modalId);
            });
        });

        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }

    showScreen(screen) {
        this.currentState = screen;
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(`${screen}-screen`)?.classList.remove('hidden');
    }

    async handleSetup() {
        const password = document.getElementById('setup-password').value;
        const confirmPassword = document.getElementById('setup-password-confirm').value;
        const errorEl = document.getElementById('setup-error');

        errorEl.classList.add('hidden');

        if (password.length < 8) {
            errorEl.textContent = 'Password must be at least 8 characters';
            errorEl.classList.remove('hidden');
            return;
        }

        if (password !== confirmPassword) {
            errorEl.textContent = 'Passwords do not match';
            errorEl.classList.remove('hidden');
            return;
        }

        try {
            const salt = await this.security.initialize(password);
            const passwordHash = await this.security.hashPassword(password, salt);
            
            await this.database.setSetting('password_hash', passwordHash);
            await this.database.setSetting('password_salt', this.security.arrayBufferToBase64(salt));
            
            // Clear inputs
            document.getElementById('setup-password').value = '';
            document.getElementById('setup-password-confirm').value = '';
            
            this.showScreen('dashboard');
            await this.loadDashboard();
        } catch (error) {
            errorEl.textContent = 'Setup failed. Please try again.';
            errorEl.classList.remove('hidden');
            console.error(error);
        }
    }

    async handleUnlock() {
        const password = document.getElementById('unlock-password').value;
        const errorEl = document.getElementById('unlock-error');

        errorEl.classList.add('hidden');

        try {
            const storedHash = await this.database.getSetting('password_hash');
            const storedSalt = await this.database.getSetting('password_salt');

            const isValid = await this.security.verifyPassword(password, storedHash, storedSalt);

            if (!isValid) {
                errorEl.textContent = 'Incorrect password';
                errorEl.classList.remove('hidden');
                return;
            }

            const salt = this.security.base64ToArrayBuffer(storedSalt);
            await this.security.initialize(password, salt);

            document.getElementById('unlock-password').value = '';
            
            this.showScreen('dashboard');
            await this.loadDashboard();
        } catch (error) {
            errorEl.textContent = 'Unlock failed. Please try again.';
            errorEl.classList.remove('hidden');
            console.error(error);
        }
    }

    handleLock() {
        this.security.clear();
        this.decryptedCategories = [];
        this.decryptedTransactions = [];
        this.showScreen('locked');
    }

    async loadDashboard() {
        await this.loadCategories();
        await this.loadTransactions();
        this.updateSummary();
        this.renderCategories();
        this.renderTransactions();
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async loadCategories() {
        const encrypted = await this.database.getCategories();
        this.decryptedCategories = [];

        for (const cat of encrypted) {
            try {
                const name = await this.security.decrypt(JSON.parse(cat.encrypted_name));
                const limit = await this.security.decrypt(JSON.parse(cat.encrypted_limit));
                
                this.decryptedCategories.push({
                    id: cat.id,
                    name,
                    limit: parseFloat(limit)
                });
            } catch (error) {
                console.error('Failed to decrypt category:', error);
            }
        }
    }

    async loadTransactions() {
        const encrypted = await this.database.getTransactions();
        this.decryptedTransactions = [];

        for (const tx of encrypted) {
            try {
                const date = await this.security.decrypt(JSON.parse(tx.encrypted_date));
                const amount = await this.security.decrypt(JSON.parse(tx.encrypted_amount));
                const note = tx.encrypted_note ? await this.security.decrypt(JSON.parse(tx.encrypted_note)) : '';
                
                this.decryptedTransactions.push({
                    id: tx.id,
                    date,
                    amount: parseFloat(amount),
                    categoryId: tx.categoryId,
                    note
                });
            } catch (error) {
                console.error('Failed to decrypt transaction:', error);
            }
        }

        // Sort by date descending
        this.decryptedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    renderCategories() {
        const container = document.getElementById('categories-list');
        container.innerHTML = '';

        if (this.decryptedCategories.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="folder"></i>
                    <p>No categories yet. Add one to get started!</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        this.decryptedCategories.forEach(cat => {
            const spent = this.decryptedTransactions
                .filter(tx => tx.categoryId === cat.id)
                .reduce((sum, tx) => sum + tx.amount, 0);
            
            const remaining = cat.limit - spent;
            const percentage = (spent / cat.limit) * 100;

            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="list-item-content">
                    <div class="list-item-title">${this.escapeHtml(cat.name)}</div>
                    <div class="list-item-subtitle">
                        $${spent.toFixed(2)} / $${cat.limit.toFixed(2)} 
                        (${percentage.toFixed(0)}%)
                    </div>
                </div>
                <div class="list-item-actions">
                    <button class="icon-btn" onclick="app.editCategory(${cat.id})">
                        <i data-lucide="edit-2"></i>
                    </button>
                    <button class="icon-btn" onclick="app.deleteCategory(${cat.id})">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    renderTransactions() {
        const container = document.getElementById('transactions-list');
        container.innerHTML = '';

        if (this.decryptedTransactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="receipt"></i>
                    <p>No transactions yet. Add one to start tracking!</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        this.decryptedTransactions.forEach(tx => {
            const category = this.decryptedCategories.find(c => c.id === tx.categoryId);
            const categoryName = category ? category.name : 'Unknown';

            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="list-item-content">
                    <div class="list-item-title">$${tx.amount.toFixed(2)}</div>
                    <div class="list-item-subtitle">
                        ${this.escapeHtml(categoryName)} • ${this.formatDate(tx.date)}
                        ${tx.note ? `<br>${this.escapeHtml(tx.note)}` : ''}
                    </div>
                </div>
                <div class="list-item-actions">
                    <button class="icon-btn" onclick="app.deleteTransaction(${tx.id})">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
            container.appendChild(item);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    updateSummary() {
        const totalBudget = this.decryptedCategories.reduce((sum, cat) => sum + cat.limit, 0);
        const totalSpent = this.decryptedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
        const totalRemaining = totalBudget - totalSpent;

        document.getElementById('total-budget').textContent = `$${totalBudget.toFixed(2)}`;
        document.getElementById('total-spent').textContent = `$${totalSpent.toFixed(2)}`;
        document.getElementById('total-remaining').textContent = `$${totalRemaining.toFixed(2)}`;
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');
    }

    showCategoryModal(categoryId = null) {
        this.editingCategoryId = categoryId;
        const modal = document.getElementById('category-modal');
        const title = document.getElementById('category-modal-title');
        const form = document.getElementById('category-form');

        if (categoryId) {
            const category = this.decryptedCategories.find(c => c.id === categoryId);
            title.textContent = 'Edit Category';
            document.getElementById('category-name').value = category.name;
            document.getElementById('category-limit').value = category.limit;
        } else {
            title.textContent = 'Add Category';
            form.reset();
        }

        modal.classList.remove('hidden');
    }

    showTransactionModal(transactionId = null) {
        this.editingTransactionId = transactionId;
        const modal = document.getElementById('transaction-modal');
        const form = document.getElementById('transaction-form');
        const categorySelect = document.getElementById('transaction-category');

        // Populate category dropdown
        categorySelect.innerHTML = '<option value="">Select category...</option>';
        this.decryptedCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });

        if (transactionId) {
            // Edit mode not implemented in this version
            form.reset();
        } else {
            form.reset();
            document.getElementById('transaction-date').valueAsDate = new Date();
        }

        modal.classList.remove('hidden');
    }

    hideModal(modalId) {
        document.getElementById(modalId)?.classList.add('hidden');
        this.editingCategoryId = null;
        this.editingTransactionId = null;
    }

    async handleCategorySubmit(e) {
        e.preventDefault();

        const name = document.getElementById('category-name').value;
        const limit = document.getElementById('category-limit').value;

        try {
            const encryptedName = await this.security.encrypt(name);
            const encryptedLimit = await this.security.encrypt(limit);

            if (this.editingCategoryId) {
                await this.database.updateCategory(this.editingCategoryId, {
                    encrypted_name: JSON.stringify(encryptedName),
                    encrypted_limit: JSON.stringify(encryptedLimit)
                });
            } else {
                await this.database.addCategory({
                    encrypted_name: JSON.stringify(encryptedName),
                    encrypted_limit: JSON.stringify(encryptedLimit)
                });
            }

            this.hideModal('category-modal');
            await this.loadCategories();
            this.renderCategories();
            this.updateSummary();
        } catch (error) {
            console.error('Failed to save category:', error);
            alert('Failed to save category');
        }
    }

    async handleTransactionSubmit(e) {
        e.preventDefault();

        const date = document.getElementById('transaction-date').value;
        const amount = document.getElementById('transaction-amount').value;
        const categoryId = parseInt(document.getElementById('transaction-category').value);
        const note = document.getElementById('transaction-note').value;

        if (!categoryId) {
            alert('Please select a category');
            return;
        }

        try {
            const encryptedDate = await this.security.encrypt(date);
            const encryptedAmount = await this.security.encrypt(amount);
            const encryptedNote = note ? await this.security.encrypt(note) : null;

            await this.database.addTransaction({
                encrypted_date: JSON.stringify(encryptedDate),
                encrypted_amount: JSON.stringify(encryptedAmount),
                categoryId: categoryId,
                encrypted_note: encryptedNote ? JSON.stringify(encryptedNote) : null
            });

            this.hideModal('transaction-modal');
            await this.loadTransactions();
            this.renderTransactions();
            this.updateSummary();
            this.renderCategories(); // Update category spending
        } catch (error) {
            console.error('Failed to save transaction:', error);
            alert('Failed to save transaction');
        }
    }

    async deleteCategory(id) {
        if (!confirm('Delete this category and all its transactions?')) return;

        try {
            await this.database.deleteCategory(id);
            await this.loadCategories();
            await this.loadTransactions();
            this.renderCategories();
            this.renderTransactions();
            this.updateSummary();
        } catch (error) {
            console.error('Failed to delete category:', error);
        }
    }

    async editCategory(id) {
        this.showCategoryModal(id);
    }

    async deleteTransaction(id) {
        if (!confirm('Delete this transaction?')) return;

        try {
            await this.database.deleteTransaction(id);
            await this.loadTransactions();
            this.renderTransactions();
            this.updateSummary();
            this.renderCategories();
        } catch (error) {
            console.error('Failed to delete transaction:', error);
        }
    }

    async exportData() {
        try {
            const data = this.decryptedTransactions.map(tx => {
                const category = this.decryptedCategories.find(c => c.id === tx.categoryId);
                return {
                    Date: tx.date,
                    Amount: tx.amount,
                    Category: category ? category.name : 'Unknown',
                    Note: tx.note
                };
            });

            const csv = Papa.unparse(data);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vault-budget-export-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export data');
        }
    }

    async handleReset() {
        if (!confirm('This will delete ALL data permanently. Are you sure?')) return;
        if (!confirm('Really sure? This cannot be undone!')) return;

        try {
            await this.database.resetDatabase();
            this.security.clear();
            this.decryptedCategories = [];
            this.decryptedTransactions = [];
            this.showScreen('setup');
        } catch (error) {
            console.error('Reset failed:', error);
            alert('Failed to reset database');
        }
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app
const app = new App();
