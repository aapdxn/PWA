// Main Application Controller
class App {
    constructor() {
        console.log('🚀 App constructor called');
        
        // Wait for dependencies to load
        this.waitForDependencies().then(() => {
            console.log('✅ Dependencies loaded, initializing app...');
            this.security = new SecurityManager();
            this.db = new DatabaseManager();
            this.csvImporter = new CSVImporter(this.security, this.db);
            this.currentTab = 'transactions';
            this.appState = 'loading';
            this.activeMonth = new Date();
            this.activeMonth.setDate(1);
            
            this.init();
        }).catch(error => {
            console.error('❌ Dependency loading failed:', error);
        });
    }

    async waitForDependencies() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50;
            
            const checkDeps = setInterval(() => {
                attempts++;
                
                if (typeof Dexie !== 'undefined' && 
                    typeof Papa !== 'undefined' && 
                    typeof lucide !== 'undefined') {
                    clearInterval(checkDeps);
                    console.log('✅ All dependencies ready');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkDeps);
                    console.error('⚠️ Timeout waiting for dependencies');
                    console.log('Dexie:', typeof Dexie);
                    console.log('Papa:', typeof Papa);
                    console.log('Lucide:', typeof lucide);
                    resolve(); // Resolve anyway to continue
                }
            }, 100);
        });
    }

    async init() {
        console.log('📱 Initializing app...');
        
        try {
            await this.checkAppState();
            console.log('📊 App state:', this.appState);
            
            this.attachEventListeners();
            this.render();
            
            console.log('✅ App initialized successfully');
        } catch (error) {
            console.error('❌ App initialization failed:', error);
        }
    }

    async checkAppState() {
        try {
            const passwordHash = await this.db.getSetting('passwordHash');
            
            if (!passwordHash) {
                console.log('🔓 No password found - showing setup screen');
                this.appState = 'setup';
            } else {
                console.log('🔒 Password exists - showing locked screen');
                this.appState = 'locked';
            }
        } catch (error) {
            console.error('Error checking app state:', error);
            this.appState = 'setup'; // Default to setup on error
        }
    }

    attachEventListeners() {
        console.log('🔗 Attaching event listeners...');
        
        document.addEventListener('click', async (e) => {
            console.log('🖱️ Click detected on:', e.target);
            
            // Setup submit
            if (e.target.id === 'setup-submit' || e.target.closest('#setup-submit')) {
                console.log('Setup submit clicked');
                e.preventDefault();
                await this.handleSetupSubmit();
            }
            
            // Unlock submit
            if (e.target.id === 'unlock-submit' || e.target.closest('#unlock-submit')) {
                console.log('Unlock submit clicked');
                e.preventDefault();
                await this.handleUnlockSubmit();
            }
            
            // Bottom navigation
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                const tab = navItem.dataset.tab;
                console.log('📑 Switching to tab:', tab);
                
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                navItem.classList.add('active');
                
                this.currentTab = tab;
                this.showTab(tab);
            }
            
            // Add Transaction button
            if (e.target.closest('#add-transaction-btn')) {
                console.log('➕ Add transaction clicked');
                await this.openTransactionModal();
            }
            
            // Import CSV button
            if (e.target.closest('#import-csv-btn')) {
                console.log('📥 Import CSV clicked');
                alert('CSV Import feature coming soon!');
            }
            
            // Edit transaction (click on card)
            const transactionItem = e.target.closest('.transaction-item[data-id]');
            if (transactionItem) {
                const transactionId = parseInt(transactionItem.dataset.id);
                console.log('✏️ Edit transaction:', transactionId);
                await this.openTransactionModal(transactionId);
            }
            
            // Transaction form submit
            if (e.target.closest('#transaction-form-submit')) {
                e.preventDefault();
                await this.saveTransaction();
            }
            
            // Delete transaction
            if (e.target.closest('#delete-transaction-btn')) {
                const transactionId = parseInt(document.getElementById('transaction-form').dataset.editId);
                await this.deleteTransaction(transactionId);
            }
            
            // Add Category button (FAB)
            if (e.target.closest('#fab-add-category')) {
                console.log('➕ Add category clicked');
                this.openCategoryModal();
            }
            
            // Edit category (click on card)
            const categoryCard = e.target.closest('.category-card[data-id]');
            if (categoryCard && !e.target.closest('.fab')) {
                const categoryId = parseInt(categoryCard.dataset.id);
                console.log('✏️ Edit category:', categoryId);
                await this.openCategoryModal(categoryId);
            }
            
            // Category form submit
            if (e.target.closest('#category-form-submit')) {
                e.preventDefault();
                await this.saveCategory();
            }
            
            // Delete category
            if (e.target.closest('#delete-category-btn')) {
                const categoryId = parseInt(document.getElementById('category-form').dataset.editId);
                await this.deleteCategory(categoryId);
            }
            
            // Close modal buttons
            const closeModal = e.target.closest('.close-modal');
            if (closeModal) {
                const modalId = closeModal.dataset.modal;
                if (modalId) {
                    document.getElementById(modalId).classList.add('hidden');
                }
            }
            
            // Toggle summary details
            if (e.target.closest('.toggle-details-btn')) {
                const btn = e.target.closest('.toggle-details-btn');
                const sectionId = btn.dataset.section;
                const detailsDiv = document.getElementById(`${sectionId}-details`);
                
                if (detailsDiv) {
                    detailsDiv.classList.toggle('hidden');
                    const icon = btn.querySelector('i');
                    const text = btn.querySelector('.btn-text');
                    
                    if (detailsDiv.classList.contains('hidden')) {
                        text.textContent = 'Show Details';
                        icon.setAttribute('data-lucide', 'chevron-down');
                    } else {
                        text.textContent = 'Hide Details';
                        icon.setAttribute('data-lucide', 'chevron-up');
                    }
                    
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }
                }
            }
        });
        
        // Also attach to Enter key for password fields
        document.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const activeElement = document.activeElement;
                
                if (activeElement.id === 'setup-password-confirm') {
                    await this.handleSetupSubmit();
                } else if (activeElement.id === 'unlock-password') {
                    await this.handleUnlockSubmit();
                }
            }
        });
        
        console.log('✅ Event listeners attached');
    }

    async handleSetupSubmit() {
        console.log('📝 Processing setup...');
        
        const password = document.getElementById('setup-password')?.value;
        const confirm = document.getElementById('setup-password-confirm')?.value;
        const errorEl = document.getElementById('setup-error');
        
        if (!password || !confirm) {
            console.log('❌ Missing password fields');
            return;
        }
        
        if (password !== confirm) {
            errorEl.textContent = 'Passwords do not match';
            errorEl.classList.remove('hidden');
            return;
        }
        
        if (password.length < 8) {
            errorEl.textContent = 'Password must be at least 8 characters';
            errorEl.classList.remove('hidden');
            return;
        }
        
        try {
            console.log('🔐 Creating password hash...');
            const { hash, salt } = await this.security.createPasswordHash(password);
            
            console.log('💾 Saving to database...');
            await this.db.saveSetting('passwordHash', hash);
            await this.db.saveSetting('passwordSalt', salt);
            
            console.log('🔓 Initializing encryption...');
            await this.security.initializeEncryption(password, salt);
            
            this.appState = 'unlocked';
            this.render();
            console.log('✅ Setup complete!');
        } catch (error) {
            console.error('❌ Setup failed:', error);
            errorEl.textContent = 'Setup failed: ' + error.message;
            errorEl.classList.remove('hidden');
        }
    }

    async handleUnlockSubmit() {
        console.log('🔓 Processing unlock...');
        
        const password = document.getElementById('unlock-password')?.value;
        const errorEl = document.getElementById('unlock-error');
        
        if (!password) {
            console.log('❌ No password entered');
            return;
        }
        
        try {
            console.log('🔍 Verifying password...');
            const storedHash = (await this.db.getSetting('passwordHash')).value;
            const storedSalt = (await this.db.getSetting('passwordSalt')).value;
            
            const isValid = await this.security.verifyPassword(password, storedHash, storedSalt);
            
            if (!isValid) {
                errorEl.textContent = 'Incorrect password';
                errorEl.classList.remove('hidden');
                return;
            }
            
            console.log('✅ Password correct, unlocking...');
            await this.security.initializeEncryption(password, storedSalt);
            
            this.appState = 'unlocked';
            this.render();
            console.log('✅ Unlocked!');
        } catch (error) {
            console.error('❌ Unlock failed:', error);
            errorEl.textContent = 'Unlock failed: ' + error.message;
            errorEl.classList.remove('hidden');
        }
    }

    render() {
        console.log('🎨 Rendering app state:', this.appState);
        
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show appropriate screen
        if (this.appState === 'setup') {
            const setupScreen = document.getElementById('setup-screen');
            if (setupScreen) {
                setupScreen.classList.remove('hidden');
                console.log('✅ Showing setup screen');
            }
        } else if (this.appState === 'locked') {
            const lockedScreen = document.getElementById('locked-screen');
            if (lockedScreen) {
                lockedScreen.classList.remove('hidden');
                console.log('✅ Showing locked screen');
            }
        } else if (this.appState === 'unlocked') {
            const dashboardScreen = document.getElementById('dashboard-screen');
            if (dashboardScreen) {
                dashboardScreen.classList.remove('hidden');
                console.log('✅ Showing dashboard screen');
                
                // Initialize the first tab
                this.showTab(this.currentTab);
            }
        }
        
        // Reinitialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    showTab(tabName) {
        console.log('📱 Showing tab:', tabName);
        
        // Update active tab in navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.tab === tabName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show the selected tab
        const targetTab = document.getElementById(`tab-${tabName}`);
        if (targetTab) {
            targetTab.classList.add('active');
            console.log(`✅ Tab ${tabName} is now active`);
        } else {
            console.error(`❌ Tab element not found: tab-${tabName}`);
        }
        
        // Show/hide add bar (only on transactions tab)
        const addBar = document.querySelector('.add-bar');
        if (addBar) {
            if (tabName === 'transactions') {
                addBar.classList.remove('hidden');
            } else {
                addBar.classList.add('hidden');
            }
        }
        
        // Show/hide summary cards (only on budget tab)
        const summarySection = document.querySelector('.summary-section-fixed');
        if (summarySection) {
            if (tabName === 'budget') {
                summarySection.classList.remove('hidden');
            } else {
                summarySection.classList.add('hidden');
            }
        }
        
        // Render tab-specific content
        if (tabName === 'transactions') {
            this.renderTransactionsTab();
        } else if (tabName === 'budget') {
            this.renderBudgetTab();
        } else if (tabName === 'summary') {
            this.renderSummaryTab();
        } else if (tabName === 'mappings') {
            this.renderMappingsTab();
        } else if (tabName === 'settings') {
            this.renderSettingsTab();
        }
        
        // Refresh icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async renderTransactionsTab() {
        console.log('📋 Rendering transactions tab');
        
        const transactions = await this.db.getAllTransactions();
        const container = document.getElementById('transactions-list');
        
        if (!container) {
            console.error('❌ Transactions list container not found');
            return;
        }
        
        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="inbox" style="width: 64px; height: 64px;"></i>
                    </div>
                    <h3>No Transactions Yet</h3>
                    <p>Click "Add Transaction" above to get started</p>
                </div>
            `;
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            return;
        }
        
        // Sort by date descending (newest first)
        transactions.sort((a, b) => b.id - a.id);
        
        let html = '';
        for (const t of transactions) {
            const date = await this.security.decrypt(t.encrypted_date);
            const amount = parseFloat(await this.security.decrypt(t.encrypted_amount));
            const description = t.encrypted_description 
                ? await this.security.decrypt(t.encrypted_description) 
                : 'No description';
            
            const amountClass = amount >= 0 ? 'income' : 'expense';
            const displayAmount = Math.abs(amount);
            const dateObj = new Date(date);
            const formattedDate = dateObj.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            
            html += `
                <div class="transaction-item" data-id="${t.id}">
                    <div class="transaction-header">
                        <span class="transaction-desc">${description}</span>
                        <span class="transaction-amount ${amountClass}">
                            ${amount >= 0 ? '+' : '-'}$${displayAmount.toFixed(2)}
                        </span>
                    </div>
                    <div class="transaction-date">${formattedDate}</div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async renderBudgetTab() {
        console.log('💰 Rendering budget tab');
        
        // Update summary cards
        await this.updateSummaryCards();
        
        const categories = await this.db.getAllCategories();
        const container = document.getElementById('budget-list');
        
        if (!container) {
            console.error('❌ Budget list container not found');
            return;
        }
        
        if (categories.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="wallet" style="width: 64px; height: 64px;"></i>
                    </div>
                    <h3>No Categories Yet</h3>
                    <p>Create your first budget category to get started</p>
                    <button class="btn-primary" id="fab-add-category-inline">
                        <i data-lucide="plus"></i>
                        <span>Add Category</span>
                    </button>
                </div>
            `;
            
            const inlineBtn = document.getElementById('fab-add-category-inline');
            if (inlineBtn) {
                inlineBtn.addEventListener('click', () => this.openCategoryModal());
            }
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            return;
        }
        
        // Decrypt and group categories
        const decryptedCategories = await Promise.all(
            categories.map(async (cat) => ({
                ...cat,
                name: await this.security.decrypt(cat.encrypted_name),
                limit: parseFloat(await this.security.decrypt(cat.encrypted_limit)),
                type: cat.type || 'Expense'
            }))
        );
        
        const grouped = {
            Income: [],
            Expense: [],
            Saving: [],
            Transfer: []
        };
        
        decryptedCategories.forEach(cat => {
            grouped[cat.type].push(cat);
        });
        
        // Sort by limit
        Object.keys(grouped).forEach(type => {
            grouped[type].sort((a, b) => b.limit - a.limit);
        });
        
        let html = '';
        for (const type of ['Income', 'Expense', 'Saving', 'Transfer']) {
            if (grouped[type].length === 0) continue;
            
            html += `
                <div class="budget-group">
                    <h3 class="group-header">${type}</h3>
            `;
            
            for (const cat of grouped[type]) {
                const tracked = await this.calculateCategoryTracked(cat.id);
                const isTransfer = cat.type === 'Transfer';
                const percentage = cat.limit > 0 ? Math.min(100, (tracked / cat.limit) * 100) : 0;
                const remaining = cat.limit - tracked;
                
                html += `
                    <div class="category-card ${isTransfer ? 'transfer' : ''}" data-id="${cat.id}">
                        <div class="category-header">
                            <span class="category-name">${cat.name}</span>
                            <span class="category-amount">$${cat.limit.toFixed(2)}</span>
                        </div>
                        ${!isTransfer ? `
                            <div class="progress-bar">
                                <div class="progress-fill ${percentage > 100 ? 'over-budget' : ''}" 
                                     style="width: ${Math.min(100, percentage)}%"></div>
                            </div>
                            <div class="category-footer">
                                <span class="footer-label">Tracked</span>
                                <span class="footer-value">$${tracked.toFixed(2)}</span>
                                <span class="footer-label">Remaining</span>
                                <span class="footer-value ${remaining < 0 ? 'negative' : ''}">
                                    $${remaining.toFixed(2)}
                                </span>
                            </div>
                        ` : `
                            <div class="transfer-note">Total: $${tracked.toFixed(2)}</div>
                        `}
                    </div>
                `;
            }
            
            html += `</div>`;
        }
        
        // Add FAB
        html += `
            <button class="fab" id="fab-add-category" title="Add Category">
                <i data-lucide="plus"></i>
            </button>
        `;
        
        container.innerHTML = html;
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async updateSummaryCards() {
        console.log('📊 Updating summary cards');
        
        const transactions = await this.db.getAllTransactions();
        const categories = await this.db.getAllCategories();
        
        let totalIncome = 0;
        let totalExpenses = 0;
        let totalSavings = 0;
        
        // Calculate totals by category type
        for (const transaction of transactions) {
            const amount = parseFloat(await this.security.decrypt(transaction.encrypted_amount));
            const category = categories.find(c => c.id === transaction.categoryId);
            
            if (!category) continue;
            
            const categoryType = category.type || 'Expense';
            
            if (categoryType === 'Income') {
                totalIncome += Math.abs(amount);
            } else if (categoryType === 'Expense') {
                totalExpenses += Math.abs(amount);
            } else if (categoryType === 'Saving') {
                totalSavings += Math.abs(amount);
            }
        }
        
        // Update the DOM
        const incomeCard = document.querySelector('.summary-card.income .summary-value');
        const expensesCard = document.querySelector('.summary-card.expenses .summary-value');
        const savingsCard = document.querySelector('.summary-card.savings .summary-value');
        
        if (incomeCard) incomeCard.textContent = `$${totalIncome.toFixed(2)}`;
        if (expensesCard) expensesCard.textContent = `$${totalExpenses.toFixed(2)}`;
        if (savingsCard) savingsCard.textContent = `$${totalSavings.toFixed(2)}`;
    }

    async renderSummaryTab() {
        console.log('📊 Rendering summary tab');
        
        const container = document.getElementById('summary-container');
        
        if (!container) {
            console.error('❌ Summary container not found');
            return;
        }
        
        const transactions = await this.db.getAllTransactions();
        const categories = await this.db.getAllCategories();
        
        if (transactions.length === 0 || categories.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="bar-chart-2" style="width: 64px; height: 64px;"></i>
                    </div>
                    <h3>No Data to Summarize</h3>
                    <p>Add transactions to see summary charts and analytics</p>
                </div>
            `;
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            return;
        }
        
        // Calculate totals and category breakdowns
        const summary = await this.calculateSummaryData(transactions, categories);
        
        // Build HTML with donut charts and tables
        let html = '<div class="summary-sections">';
        
        // Render each category type section
        for (const type of ['Income', 'Expense', 'Saving']) {
            if (!summary[type] || summary[type].categories.length === 0) continue;
            
            html += this.renderCategorySection(type, summary[type]);
        }
        
        html += '</div>';
        
        container.innerHTML = html;
        
        // Render donut charts after DOM update
        setTimeout(() => {
            for (const type of ['Income', 'Expense', 'Saving']) {
                if (summary[type] && summary[type].categories.length > 0) {
                    this.renderDonutChart(`donut-${type.toLowerCase()}`, summary[type].categories);
                }
            }
        }, 100);
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async calculateSummaryData(transactions, categories) {
        const summary = {
            Income: { total: 0, categories: [] },
            Expense: { total: 0, categories: [] },
            Saving: { total: 0, categories: [] }
        };
        
        const categoryTotals = {};
        const categoryBudgets = {};
        
        for (const transaction of transactions) {
            const amount = Math.abs(parseFloat(await this.security.decrypt(transaction.encrypted_amount)));
            const category = categories.find(c => c.id === transaction.categoryId);
            
            if (!category) continue;
            
            const categoryName = await this.security.decrypt(category.encrypted_name);
            const categoryType = category.type || 'Expense';
            const categoryBudget = parseFloat(await this.security.decrypt(category.encrypted_limit));
            
            if (!categoryTotals[categoryType]) {
                categoryTotals[categoryType] = {};
                categoryBudgets[categoryType] = {};
            }
            
            if (!categoryTotals[categoryType][categoryName]) {
                categoryTotals[categoryType][categoryName] = 0;
                categoryBudgets[categoryType][categoryName] = categoryBudget;
            }
            
            categoryTotals[categoryType][categoryName] += amount;
        }
        
        // Convert to sorted arrays with budget info
        for (const type of ['Income', 'Expense', 'Saving']) {
            if (categoryTotals[type]) {
                summary[type].categories = Object.entries(categoryTotals[type])
                    .map(([name, tracked]) => ({
                        name,
                        tracked,
                        budgeted: categoryBudgets[type][name] || 0
                    }))
                    .sort((a, b) => b.tracked - a.tracked);
                
                summary[type].total = summary[type].categories.reduce((sum, cat) => sum + cat.tracked, 0);
            }
        }
        
        return summary;
    }

    renderCategorySection(type, data) {
        const colors = this.getCategoryColors(type);
        const hasData = data.categories.length > 0;
        
        return `
            <div class="summary-section">
                <div class="section-header-row">
                    <h3 class="section-header">${type} Summary</h3>
                    ${hasData ? `
                        <button class="toggle-details-btn" data-section="${type.toLowerCase()}">
                            <i data-lucide="chevron-down"></i>
                            <span class="btn-text">Show Details</span>
                        </button>
                    ` : ''}
                </div>
                
                ${hasData ? `
                    <!-- Details Table (Hidden by default) -->
                    <div id="${type.toLowerCase()}-details" class="category-details hidden">
                        <div class="details-table">
                            <div class="details-table-header">
                                <span class="col-name">Category</span>
                                <span class="col-tracked">Tracked</span>
                                <span class="col-budgeted">Budgeted</span>
                                <span class="col-percent">%</span>
                                <span class="col-remaining">${type === 'Income' ? 'Excess' : 'Remaining'}</span>
                            </div>
                            ${data.categories.map((cat, index) => {
                                const percentage = cat.budgeted > 0 ? (cat.tracked / cat.budgeted * 100).toFixed(1) : 0;
                                const remaining = cat.budgeted - cat.tracked;
                                const isOverBudget = remaining < 0;
                                const statusClass = isOverBudget ? 'negative' : 'positive';
                                
                                return `
                                    <div class="details-table-row">
                                        <span class="col-name">
                                            <span class="breakdown-color" style="background: ${colors[index % colors.length]};"></span>
                                            ${cat.name}
                                        </span>
                                        <span class="col-tracked">$${cat.tracked.toFixed(2)}</span>
                                        <span class="col-budgeted">$${cat.budgeted.toFixed(2)}</span>
                                        <span class="col-percent">${percentage}%</span>
                                        <span class="col-remaining ${statusClass}">
                                            ${type === 'Income' ? '+' : ''}$${Math.abs(remaining).toFixed(2)}
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <!-- Donut Chart Only (No Legend) -->
                    <div class="summary-content">
                        <div class="donut-container-center">
                            <svg id="donut-${type.toLowerCase()}" width="200" height="200" viewBox="0 0 200 200">
                                <text x="100" y="95" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--text-primary)">
                                    $${data.total.toFixed(0)}
                                </text>
                                <text x="100" y="115" text-anchor="middle" font-size="12" fill="var(--text-secondary)">
                                    Total ${type}
                                </text>
                            </svg>
                        </div>
                    </div>
                ` : `
                    <div class="empty-category-section">
                        <p style="color: var(--text-secondary); text-align: center; padding: 20px;">
                            No ${type.toLowerCase()} transactions yet
                        </p>
                    </div>
                `}
            </div>
        `;
    }

    renderDonutChart(svgId, categories) {
        const svg = document.getElementById(svgId);
        if (!svg || categories.length === 0) {
            console.log(`⚠️ Donut chart ${svgId}: No SVG or no categories`);
            return;
        }
        
        const total = categories.reduce((sum, cat) => sum + cat.total, 0);
        const colors = this.getCategoryColors(svgId.includes('income') ? 'Income' : 
                                             svgId.includes('saving') ? 'Saving' : 'Expense');
        
        const centerX = 100;
        const centerY = 100;
        const radius = 70;
        const thickness = 25;
        
        console.log(`📊 Rendering donut ${svgId}: ${categories.length} categories`);
        
        // Handle single category - show full circle
        if (categories.length === 1) {
            console.log(`   Single category - showing full circle`);
            
            // Draw full circle using circle element instead of path
            const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            outerCircle.setAttribute('cx', centerX);
            outerCircle.setAttribute('cy', centerY);
            outerCircle.setAttribute('r', radius);
            outerCircle.setAttribute('fill', colors[0]);
            
            const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            innerCircle.setAttribute('cx', centerX);
            innerCircle.setAttribute('cy', centerY);
            innerCircle.setAttribute('r', radius - thickness);
            innerCircle.setAttribute('fill', 'var(--bg-secondary)');
            
            svg.insertBefore(innerCircle, svg.firstChild);
            svg.insertBefore(outerCircle, svg.firstChild);
            return;
        }
        
        // Multiple categories - normal donut segments
        let currentAngle = -90; // Start at top
        
        categories.forEach((cat, index) => {
            const percentage = cat.total / total;
            const angle = percentage * 360;
            
            console.log(`   Category ${index}: ${cat.name} = ${percentage.toFixed(2)}% (${angle.toFixed(1)}°)`);
            
            const path = this.createDonutSegment(
                centerX, centerY, radius, thickness,
                currentAngle, currentAngle + angle
            );
            
            const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathElement.setAttribute('d', path);
            pathElement.setAttribute('fill', colors[index % colors.length]);
            pathElement.setAttribute('class', 'donut-segment');
            
            svg.insertBefore(pathElement, svg.firstChild);
            
            currentAngle += angle;
        });
    }

    createDonutSegment(cx, cy, radius, thickness, startAngle, endAngle) {
        const innerRadius = radius - thickness;
        
        const start = this.polarToCartesian(cx, cy, radius, endAngle);
        const end = this.polarToCartesian(cx, cy, radius, startAngle);
        const innerStart = this.polarToCartesian(cx, cy, innerRadius, endAngle);
        const innerEnd = this.polarToCartesian(cx, cy, innerRadius, startAngle);
        
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        
        return [
            'M', start.x, start.y,
            'A', radius, radius, 0, largeArc, 0, end.x, end.y,
            'L', innerEnd.x, innerEnd.y,
            'A', innerRadius, innerRadius, 0, largeArc, 1, innerStart.x, innerStart.y,
            'Z'
        ].join(' ');
    }

    polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }

    getCategoryColors(type) {
        const colors = {
            Income: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'],
            Expense: ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'],
            Saving: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']
        };
        return colors[type] || colors.Expense;
    }

    renderMappingsTab() {
        console.log('🔗 Rendering mappings tab');
        const container = document.getElementById('mappings-list');
        if (container) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <i data-lucide="link" style="width: 64px; height: 64px; color: var(--text-secondary); margin: 0 auto;"></i>
                    <h3 style="margin-top: 20px;">No Mappings Yet</h3>
                    <p style="color: var(--text-secondary);">Import CSVs to create automatic mappings</p>
                </div>
            `;
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    renderSettingsTab() {
        console.log('⚙️ Rendering settings tab');
        const container = document.getElementById('settings-content');
        if (container) {
            container.innerHTML = `
                <div style="padding: 20px;">
                    <h2>Settings</h2>
                    <div style="margin-top: 20px;">
                        <button class="btn-danger" id="lock-app-btn" style="width: 100%;">
                            <i data-lucide="lock"></i>
                            <span>Lock App</span>
                        </button>
                    </div>
                    <div style="margin-top: 20px; padding: 20px; background: var(--bg-secondary); border-radius: 12px;">
                        <p style="font-size: 12px; color: var(--text-secondary);">
                            App Version: v2.8.0<br>
                            Database: Encrypted with AES-256-GCM<br>
                            Zero-knowledge architecture
                        </p>
                    </div>
                </div>
            `;
            
            // Attach lock button listener
            const lockBtn = document.getElementById('lock-app-btn');
            if (lockBtn) {
                lockBtn.addEventListener('click', () => {
                    this.security.clearEncryptionKey();
                    this.appState = 'locked';
                    this.render();
                });
            }
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async openTransactionModal(transactionId = null) {
        console.log('💵 Opening transaction modal, ID:', transactionId);
        
        const modal = document.getElementById('transaction-modal');
        const form = document.getElementById('transaction-form');
        
        if (!modal) {
            console.error('❌ Transaction modal not found!');
            return;
        }
        
        await this.populateCategorySelect();
        
        if (transactionId) {
            const transactions = await this.db.getAllTransactions();
            const transaction = transactions.find(t => t.id === transactionId);
            
            if (!transaction) {
                alert('Transaction not found');
                return;
            }
            
            const date = await this.security.decrypt(transaction.encrypted_date);
            const amount = Math.abs(parseFloat(await this.security.decrypt(transaction.encrypted_amount)));
            const description = transaction.encrypted_description 
                ? await this.security.decrypt(transaction.encrypted_description) 
                : '';
            const account = transaction.encrypted_account 
                ? await this.security.decrypt(transaction.encrypted_account) 
                : '';
            const note = transaction.encrypted_note 
                ? await this.security.decrypt(transaction.encrypted_note) 
                : '';
            
            document.getElementById('transaction-modal-title').textContent = 'Edit Transaction';
            document.getElementById('transaction-date').value = date;
            document.getElementById('transaction-amount').value = amount;
            document.getElementById('transaction-description').value = description;
            document.getElementById('transaction-account').value = account;
            document.getElementById('transaction-category').value = transaction.categoryId || '';
            document.getElementById('transaction-note').value = note;
            
            form.dataset.editId = transactionId;
            
            let deleteBtn = document.getElementById('delete-transaction-btn');
            if (!deleteBtn) {
                deleteBtn = document.createElement('button');
                deleteBtn.id = 'delete-transaction-btn';
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-danger';
                deleteBtn.innerHTML = '<i data-lucide="trash-2"></i><span>Delete</span>';
                const modalActions = form.querySelector('.modal-actions');
                if (modalActions) {
                    modalActions.insertBefore(deleteBtn, modalActions.firstChild);
                }
            }
            deleteBtn.classList.remove('hidden');
        } else {
            document.getElementById('transaction-modal-title').textContent = 'Add Transaction';
            form.reset();
            
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('transaction-date').value = today;
            
            delete form.dataset.editId;
            
            const deleteBtn = document.getElementById('delete-transaction-btn');
            if (deleteBtn) {
                deleteBtn.classList.add('hidden');
            }
        }
        
        modal.classList.remove('hidden');
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async populateCategorySelect() {
        const select = document.getElementById('transaction-category');
        if (!select) return;
        
        const categories = await this.db.getAllCategories();
        
        let html = '<option value="">Select category...</option>';
        
        const grouped = { Income: [], Expense: [], Saving: [], Transfer: [] };
        for (const cat of categories) {
            const name = await this.security.decrypt(cat.encrypted_name);
            grouped[cat.type || 'Expense'].push({ id: cat.id, name });
        }
        
        for (const type of ['Income', 'Expense', 'Saving', 'Transfer']) {
            if (grouped[type].length === 0) continue;
            
            html += `<optgroup label="${type}">`;
            grouped[type].forEach(cat => {
                html += `<option value="${cat.id}">${cat.name}</option>`;
            });
            html += `</optgroup>`;
        }
        
        select.innerHTML = html;
    }

    async saveTransaction() {
        console.log('💾 Saving transaction...');
        
        const form = document.getElementById('transaction-form');
        const date = document.getElementById('transaction-date').value;
        const amount = document.getElementById('transaction-amount').value;
        const categoryId = parseInt(document.getElementById('transaction-category').value);
        const description = document.getElementById('transaction-description').value.trim();
        const account = document.getElementById('transaction-account').value.trim();
        const note = document.getElementById('transaction-note').value.trim();
        
        if (!date || !amount || !categoryId) {
            alert('Please fill in Date, Amount, and Category');
            return;
        }
        
        try {
            const category = await this.db.getCategory(categoryId);
            const categoryType = category.type || 'Expense';
            
            let signedAmount = parseFloat(amount);
            if (categoryType === 'Income') {
                signedAmount = Math.abs(signedAmount);
            } else if (categoryType === 'Expense' || categoryType === 'Saving') {
                signedAmount = -Math.abs(signedAmount);
            }
            
            const transaction = {
                encrypted_date: await this.security.encrypt(date),
                encrypted_amount: await this.security.encrypt(signedAmount.toString()),
                encrypted_description: description ? await this.security.encrypt(description) : '',
                encrypted_account: account ? await this.security.encrypt(account) : '',
                encrypted_note: note ? await this.security.encrypt(note) : '',
                categoryId: categoryId
            };
            
            if (form.dataset.editId) {
                transaction.id = parseInt(form.dataset.editId);
            }
            
            await this.db.saveTransaction(transaction);
            
            document.getElementById('transaction-modal').classList.add('hidden');
            await this.renderTransactionsTab();
            await this.renderBudgetTab();
            
            console.log('✅ Transaction saved successfully');
        } catch (error) {
            console.error('❌ Save transaction failed:', error);
            alert('Failed to save transaction: ' + error.message);
        }
    }

    async deleteTransaction(transactionId) {
        console.log('🗑️ Deleting transaction:', transactionId);
        
        if (!confirm('Are you sure you want to delete this transaction?')) {
            return;
        }
        
        try {
            await this.db.deleteTransaction(transactionId);
            document.getElementById('transaction-modal').classList.add('hidden');
            await this.renderTransactionsTab();
            await this.renderBudgetTab();
            console.log('✅ Transaction deleted');
        } catch (error) {
            console.error('❌ Delete transaction failed:', error);
            alert('Failed to delete transaction: ' + error.message);
        }
    }

    async openCategoryModal(categoryId = null) {
        console.log('📝 Opening category modal, ID:', categoryId);
        
        const modal = document.getElementById('category-modal');
        const form = document.getElementById('category-form');
        
        if (!modal) {
            console.error('❌ Category modal not found!');
            return;
        }
        
        if (categoryId) {
            const category = await this.db.getCategory(categoryId);
            
            if (!category) {
                alert('Category not found');
                return;
            }
            
            const name = await this.security.decrypt(category.encrypted_name);
            const limit = await this.security.decrypt(category.encrypted_limit);
            
            document.getElementById('category-modal-title').textContent = 'Edit Category';
            document.getElementById('category-name').value = name;
            document.getElementById('category-limit').value = limit;
            document.getElementById('category-type').value = category.type || 'Expense';
            
            form.dataset.editId = categoryId;
            
            let deleteBtn = document.getElementById('delete-category-btn');
            if (!deleteBtn) {
                deleteBtn = document.createElement('button');
                deleteBtn.id = 'delete-category-btn';
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-danger';
                deleteBtn.innerHTML = '<i data-lucide="trash-2"></i><span>Delete</span>';
                const modalActions = form.querySelector('.modal-actions');
                if (modalActions) {
                    modalActions.insertBefore(deleteBtn, modalActions.firstChild);
                }
            }
            deleteBtn.classList.remove('hidden');
        } else {
            document.getElementById('category-modal-title').textContent = 'Add Category';
            form.reset();
            delete form.dataset.editId;
            
            const deleteBtn = document.getElementById('delete-category-btn');
            if (deleteBtn) {
                deleteBtn.classList.add('hidden');
            }
        }
        
        modal.classList.remove('hidden');
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async saveCategory() {
        console.log('💾 Saving category...');
        
        const form = document.getElementById('category-form');
        const name = document.getElementById('category-name').value.trim();
        const limit = document.getElementById('category-limit').value;
        const type = document.getElementById('category-type').value;
        
        if (!name || !limit) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const category = {
                encrypted_name: await this.security.encrypt(name),
                encrypted_limit: await this.security.encrypt(limit),
                type: type || 'Expense'
            };
            
            if (form.dataset.editId) {
                category.id = parseInt(form.dataset.editId);
            }
            
            await this.db.saveCategory(category);
            
            document.getElementById('category-modal').classList.add('hidden');
            await this.renderBudgetTab();
            
            console.log('✅ Category saved successfully');
        } catch (error) {
            console.error('❌ Save category failed:', error);
            alert('Failed to save category: ' + error.message);
        }
    }

    async deleteCategory(categoryId) {
        console.log('🗑️ Deleting category:', categoryId);
        
        const transactions = await this.db.getTransactionsByCategory(categoryId);
        
        if (transactions.length > 0) {
            alert(`This category has ${transactions.length} transaction(s). Please reassign or delete them first.`);
            return;
        }
        
        if (!confirm('Are you sure you want to delete this category?')) {
            return;
        }
        
        try {
            await this.db.deleteCategory(categoryId);
            document.getElementById('category-modal').classList.add('hidden');
            await this.renderBudgetTab();
            console.log('✅ Category deleted');
        } catch (error) {
            console.error('❌ Delete category failed:', error);
            alert('Failed to delete category: ' + error.message);
        }
    }

    async calculateCategoryTracked(categoryId) {
        const transactions = await this.db.getTransactionsByCategory(categoryId);
        let total = 0;
        
        for (const t of transactions) {
            const amount = parseFloat(await this.security.decrypt(t.encrypted_amount));
            total += Math.abs(amount);
        }
        
        return total;
    }
}

// Initialize app
let app;
console.log('📦 Script loaded, waiting for DOM...');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM ready, creating App instance...');
        app = new App();
    });
} else {
    console.log('📄 DOM already ready, creating App instance...');
    app = new App();
}