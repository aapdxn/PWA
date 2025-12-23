// UIManager - Main UI Coordinator
// Imports UI modules for specific features
import { AuthUI } from './ui/auth-ui.js';
import { TransactionUI } from './ui/transaction-ui.js';
import { BudgetUI } from './ui/budget-ui.js';
import { SummaryUI } from './ui/summary-ui.js';

export class UIManager {
    constructor(security, db, csvEngine) {
        this.security = security;
        this.db = db;
        this.csvEngine = csvEngine;
        this.currentTab = 'transactions';
        this.activeMonth = new Date();
        this.activeMonth.setDate(1);
        
        // Initialize UI modules
        this.authUI = new AuthUI(security, db);
        this.transactionUI = new TransactionUI(security, db);
        this.budgetUI = new BudgetUI(security, db);
        this.summaryUI = new SummaryUI(security, db);
        
        // Set parent reference for TransactionUI to access showTab()
        this.transactionUI.uiManager = this;
        
        // Callback for app state changes
        this.onSetupSuccess = null;
        this.onUnlockSuccess = null;
    }

    // ========== Core Event Management ==========

    attachEventListeners() {
        console.log('🔗 Attaching event listeners...');
        
        document.addEventListener('click', async (e) => {
            // Setup submit
            if (e.target.id === 'setup-submit' || e.target.closest('#setup-submit')) {
                e.preventDefault();
                const result = await this.authUI.handleSetupSubmit();
                if (result && result.success && this.onSetupSuccess) {
                    this.onSetupSuccess();
                }
            }
            
            // Unlock submit
            if (e.target.id === 'unlock-submit' || e.target.closest('#unlock-submit')) {
                e.preventDefault();
                const result = await this.authUI.handleUnlockSubmit();
                if (result && result.success && this.onUnlockSuccess) {
                    this.onUnlockSuccess();
                }
            }
            
            // Bottom navigation
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                const tab = navItem.dataset.tab;
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                navItem.classList.add('active');
                this.currentTab = tab;
                this.showTab(tab);
            }
            
            // Add Transaction button
            if (e.target.closest('#fab-add-transaction')) {
                const menu = document.getElementById('fab-transaction-menu');
                if (menu) {
                    menu.classList.toggle('hidden');
                }
            }
            
            // FAB Menu - Manual Entry
            if (e.target.closest('#fab-manual-entry')) {
                const menu = document.getElementById('fab-transaction-menu');
                if (menu) menu.classList.add('hidden');
                await this.transactionUI.openTransactionModal();
            }
            
            // FAB Menu - Import CSV
            if (e.target.closest('#fab-import-csv')) {
                const menu = document.getElementById('fab-transaction-menu');
                if (menu) menu.classList.add('hidden');
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            // Process CSV and show review modal
                            const processedData = await this.csvEngine.processTransactionCSV(file);
                            
                            if (processedData.length === 0) {
                                alert('No valid transactions found in CSV');
                                return;
                            }
                            
                            // Open review modal
                            await this.transactionUI.openCSVReviewModal(processedData, this.csvEngine);
                        } catch (error) {
                            console.error('CSV import failed:', error);
                            alert('Failed to import CSV: ' + error.message);
                        }
                    }
                };
                input.click();
            }
            
            // Mappings - Import CSV button
            if (e.target.closest('#import-mappings-btn')) {
                const input = document.getElementById('import-mappings-input');
                if (input) input.click();
            }
            
            // Mappings - Add Mapping button (shows modal with options)
            if (e.target.closest('#add-mapping-btn')) {
                this.showAddMappingModal();
            }
            
            // FAB Menu - Undo
            if (e.target.closest('#fab-undo')) {
                const menu = document.getElementById('fab-transaction-menu');
                if (menu) menu.classList.add('hidden');
                const success = await this.transactionUI.undoLastAdd();
                if (success) {
                    await this.transactionUI.renderTransactionsTab();
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                }
            }
            
            // FAB Menu - Redo
            if (e.target.closest('#fab-redo')) {
                const menu = document.getElementById('fab-transaction-menu');
                if (menu) menu.classList.add('hidden');
                const success = await this.transactionUI.redoLastAdd();
                if (success) {
                    await this.transactionUI.renderTransactionsTab();
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                }
            }
            
            // Edit transaction (click on card)
            const transactionItem = e.target.closest('.transaction-item[data-id]');
            if (transactionItem) {
                const transactionId = parseInt(transactionItem.dataset.id);
                await this.transactionUI.openTransactionModal(transactionId);
            }
            
            // Transaction form submit
            if (e.target.closest('#transaction-form-submit')) {
                e.preventDefault();
                await this.transactionUI.saveTransaction(async () => {
                    await this.transactionUI.renderTransactionsTab();
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                });
            }
            
            // Delete transaction
            if (e.target.closest('#delete-transaction-btn')) {
                const transactionId = parseInt(document.getElementById('transaction-form').dataset.editId);
                await this.transactionUI.deleteTransaction(transactionId, async () => {
                    await this.transactionUI.renderTransactionsTab();
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                });
            }
            
            // Add Category button (FAB)
            if (e.target.closest('#fab-add-category') || e.target.closest('#fab-add-category-inline')) {
                this.budgetUI.openCategoryModal();
            }
            
            // Close FAB menu when clicking outside
            const fabMenu = document.getElementById('fab-transaction-menu');
            if (fabMenu && !fabMenu.classList.contains('hidden')) {
                if (!e.target.closest('#fab-add-transaction') && !e.target.closest('#fab-transaction-menu')) {
                    fabMenu.classList.add('hidden');
                }
            }
            
            // Advanced search toggle
            if (e.target.closest('#advanced-search-toggle')) {
                const panel = document.getElementById('advanced-search-panel');
                if (panel) {
                    panel.classList.toggle('hidden');
                    if (!panel.classList.contains('hidden')) {
                        await this.transactionUI.populateFilterOptions();
                        if (typeof lucide !== 'undefined') {
                            lucide.createIcons();
                        }
                    }
                }
            }
            
            // Section toggle (collapse/expand)
            const sectionToggle = e.target.closest('.section-toggle');
            if (sectionToggle) {
                sectionToggle.classList.toggle('collapsed');
                const content = sectionToggle.nextElementSibling;
                if (content && content.classList.contains('advanced-section-content')) {
                    content.classList.toggle('collapsed');
                }
            }
            
            // Apply filters
            if (e.target.closest('#apply-filters')) {
                const panel = document.getElementById('advanced-search-panel');
                if (panel) panel.classList.add('hidden');
            }
            
            // Clear filters
            if (e.target.closest('#clear-filters')) {
                this.clearTransactionFilters();
                this.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            }
            
            // Edit category (click on card)
            const categoryCard = e.target.closest('.category-card[data-id]');
            if (categoryCard && !e.target.closest('.fab')) {
                const categoryId = parseInt(categoryCard.dataset.id);
                await this.budgetUI.openCategoryModal(categoryId);
            }
            
            // Category form submit
            if (e.target.closest('#category-form-submit')) {
                e.preventDefault();
                await this.budgetUI.saveCategory(async () => {
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                });
            }
            
            // Delete category
            if (e.target.closest('#delete-category-btn')) {
                const categoryId = parseInt(document.getElementById('category-form').dataset.editId);
                await this.budgetUI.deleteCategory(categoryId, async () => {
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                });
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
        
        // Search input event (debounced)
        let searchTimeout;
        const searchInput = document.getElementById('transaction-search');
        if (searchInput) {
            searchInput.addEventListener('input', async (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(async () => {
                    this.transactionUI.searchQuery = e.target.value;
                    this.updateFilterIndicator();
                    await this.transactionUI.renderTransactionsTab();
                }, 300);
            });
        }
        
        // Search field checkboxes
        ['search-description', 'search-account', 'search-category', 'search-note'].forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', async () => {
                    const field = id.replace('search-', '');
                    if (checkbox.checked) {
                        if (!this.transactionUI.searchFields.includes(field)) {
                            this.transactionUI.searchFields.push(field);
                        }
                    } else {
                        this.transactionUI.searchFields = this.transactionUI.searchFields.filter(f => f !== field);
                    }
                    if (this.transactionUI.searchQuery) {
                        await this.transactionUI.renderTransactionsTab();
                    }
                });
            }
        });
        
        // Sort dropdowns
        const sortField = document.getElementById('sort-field');
        const sortOrder = document.getElementById('sort-order');
        if (sortField) {
            sortField.addEventListener('change', async () => {
                this.transactionUI.sortField = sortField.value;
                this.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            });
        }
        if (sortOrder) {
            sortOrder.addEventListener('change', async () => {
                this.transactionUI.sortOrder = sortOrder.value;
                this.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            });
        }
        
        // Filter search inputs (real-time filtering)
        const filterCategorySearch = document.getElementById('filter-category-search');
        const filterAccountSearch = document.getElementById('filter-account-search');
        const filterDescriptionSearch = document.getElementById('filter-description-search');
        
        if (filterCategorySearch) {
            filterCategorySearch.addEventListener('input', () => {
                this.transactionUI.filterSelectOptions('filter-category', 'filter-category-search');
            });
        }
        if (filterAccountSearch) {
            filterAccountSearch.addEventListener('input', () => {
                this.transactionUI.filterSelectOptions('filter-account', 'filter-account-search');
            });
        }
        if (filterDescriptionSearch) {
            filterDescriptionSearch.addEventListener('input', () => {
                this.transactionUI.filterSelectOptions('filter-description', 'filter-description-search');
            });
        }
        
        // Filter select dropdowns (real-time filtering on selection)
        const filterCategory = document.getElementById('filter-category');
        const filterAccount = document.getElementById('filter-account');
        const filterDescription = document.getElementById('filter-description');
        const filterAmountMin = document.getElementById('filter-amount-min');
        const filterAmountMax = document.getElementById('filter-amount-max');
        const filterDateStart = document.getElementById('filter-date-start');
        const filterDateEnd = document.getElementById('filter-date-end');
        
        if (filterCategory) {
            filterCategory.addEventListener('change', async () => {
                this.applyTransactionFilters();
                this.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            });
        }
        if (filterAccount) {
            filterAccount.addEventListener('change', async () => {
                this.applyTransactionFilters();
                this.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            });
        }
        if (filterDescription) {
            filterDescription.addEventListener('change', async () => {
                this.applyTransactionFilters();
                this.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            });
        }
        if (filterAmountMin) {
            filterAmountMin.addEventListener('input', async () => {
                this.applyTransactionFilters();
                this.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            });
        }
        if (filterAmountMax) {
            filterAmountMax.addEventListener('input', async () => {
                this.applyTransactionFilters();
                this.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            });
        }
        if (filterDateStart) {
            filterDateStart.addEventListener('change', async () => {
                this.applyTransactionFilters();
                this.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            });
        }
        if (filterDateEnd) {
            filterDateEnd.addEventListener('change', async () => {
                this.applyTransactionFilters();
                this.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            });
        }
        
        // Enter key for password fields
        document.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const activeElement = document.activeElement;
                
                if (activeElement.id === 'setup-password-confirm') {
                    const result = await this.authUI.handleSetupSubmit();
                    if (result && result.success && this.onSetupSuccess) {
                        this.onSetupSuccess();
                    }
                } else if (activeElement.id === 'unlock-password') {
                    const result = await this.authUI.handleUnlockSubmit();
                    if (result && result.success && this.onUnlockSuccess) {
                        this.onUnlockSuccess();
                    }
                }
            }
        });
        
        console.log('✅ Event listeners attached');
    }

    // ========== Tab Navigation ==========

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
        }
        
        // Show/hide transaction FAB (only on transactions tab)
        const transactionFab = document.getElementById('fab-add-transaction');
        if (transactionFab) {
            if (tabName === 'transactions') {
                transactionFab.classList.remove('hidden');
            } else {
                transactionFab.classList.add('hidden');
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
        
        // Show/hide add bar (on transactions and mappings tabs)
        const addBar = document.querySelector('.add-bar');
        if (addBar) {
            if (tabName === 'transactions' || tabName === 'mappings') {
                addBar.style.display = 'flex';
            } else {
                addBar.style.display = 'none';
            }
        }
        
        // Render tab-specific content
        if (tabName === 'transactions') {
            this.transactionUI.renderTransactionsTab();
        } else if (tabName === 'budget') {
            this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
        } else if (tabName === 'summary') {
            this.summaryUI.renderSummaryTab();
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

    // ========== Delegated Auth Methods (for external calls) ==========

    async handleSetupSubmit() {
        return await this.authUI.handleSetupSubmit();
    }

    async handleUnlockSubmit() {
        return await this.authUI.handleUnlockSubmit();
    }

    // ========== Delegated Rendering Methods (for external calls) ==========

    async renderTransactionsTab() {
        await this.transactionUI.renderTransactionsTab();
    }

    async renderBudgetTab() {
        await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
    }

    async updateSummaryCards() {
        await this.budgetUI.updateSummaryCards();
    }

    // ========== Placeholder Tabs ==========

    async renderMappingsTab() {
        console.log('🔗 Rendering mappings tab');
        const container = document.getElementById('mappings-list');
        if (!container) {
            console.error('Mappings container not found!');
            return;
        }
        
        // Load existing mappings from database
        const allMappings = await this.db.getAllMappingsDescriptions();
        console.log('Loaded mappings from DB:', allMappings.length);
        
        // Decrypt and prepare mappings data
        const mappingsData = await Promise.all(allMappings.map(async (mapping) => {
            const categoryName = mapping.encrypted_category ? await this.security.decrypt(mapping.encrypted_category) : 'Uncategorized';
            const payeeName = mapping.encrypted_payee ? await this.security.decrypt(mapping.encrypted_payee) : '';
            console.log('Mapping:', mapping.description, '→', categoryName);
            return {
                description: mapping.description,
                categoryName: categoryName,
                payeeName: payeeName,
                raw: mapping
            };
        }));
        
        console.log('Processed mappings data:', mappingsData.length);
        
        // Store for filtering
        this.allMappingsData = mappingsData;
        
        if (mappingsData.length === 0) {
            // Show empty state
            container.innerHTML = `
                <div style="padding: 40px 20px; text-align: center;">
                    <i data-lucide="link" style="width: 64px; height: 64px; color: var(--text-secondary); margin: 0 auto;"></i>
                    <h3 style="margin-top: 20px;">No Mappings Yet</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 24px;">Create mappings to automatically categorize transactions</p>
                </div>
            `;
        } else {
            // Get unique categories for filter
            const categories = [...new Set(mappingsData.map(m => m.categoryName))].sort();
            
            const categoryFilterOptions = categories.map(cat => 
                `<label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem;">
                    <input type="checkbox" class="mappings-category-filter" value="${cat}">
                    <span>${cat}</span>
                </label>`
            ).join('');
            
            // Build header with search and filter
            const headerHTML = `
                <div style="position: sticky; top: 0; background: var(--bg-secondary); z-index: 10; padding: 16px; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <div style="flex: 1; position: relative;">
                            <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--text-secondary);"></i>
                            <input type="text" id="mappings-search" placeholder="Search mappings..." style="width: 100%; padding: 10px 10px 10px 40px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary);">
                        </div>
                        <button id="mappings-filter-toggle" class="btn-secondary" style="padding: 10px 16px;">
                            <i data-lucide="sliders"></i>
                        </button>
                    </div>
                    <div id="mappings-filter-panel" class="hidden" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-top: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <strong>Filter by Category</strong>
                            <button id="mappings-clear-filters" class="btn-text" style="font-size: 0.875rem;">Clear</button>
                        </div>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${categoryFilterOptions}
                        </div>
                    </div>
                    <div id="mappings-count" style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 8px;">
                        Showing ${mappingsData.length} mapping(s)
                    </div>
                </div>
            `;
            
            let mappingsHTML = '';
            for (const mapping of mappingsData) {
                mappingsHTML += `
                    <div class="mapping-item" data-description="${mapping.description.toLowerCase()}" data-category="${mapping.categoryName.toLowerCase()}" data-payee="${mapping.payeeName.toLowerCase()}" style="padding: 12px; margin-bottom: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                        <div style="font-weight: 600; color: var(--text-primary);">${mapping.description}</div>
                        ${mapping.payeeName ? `<div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 4px;">Payee: ${mapping.payeeName}</div>` : ''}
                        <div style="font-size: 0.875rem; color: var(--accent); margin-top: 4px;">→ ${mapping.categoryName}</div>
                    </div>
                `;
            }
            
            container.innerHTML = `
                ${headerHTML}
                <div style="padding: 16px; padding-bottom: 80px;">
                    <div id="mappings-scroll-container" style="max-height: calc(100vh - 250px); overflow-y: auto;">
                        ${mappingsHTML}
                    </div>
                </div>
            `;
            
            // Attach search handler
            const searchInput = document.getElementById('mappings-search');
            if (searchInput) {
                searchInput.addEventListener('input', () => this.filterMappings());
            }
            
            // Attach filter toggle
            const filterToggle = document.getElementById('mappings-filter-toggle');
            const filterPanel = document.getElementById('mappings-filter-panel');
            if (filterToggle && filterPanel) {
                filterToggle.addEventListener('click', () => {
                    filterPanel.classList.toggle('hidden');
                });
            }
            
            // Attach category filter checkboxes
            const categoryCheckboxes = document.querySelectorAll('.mappings-category-filter');
            categoryCheckboxes.forEach(cb => {
                cb.addEventListener('change', () => this.filterMappings());
            });
            
            // Clear filters button
            const clearFiltersBtn = document.getElementById('mappings-clear-filters');
            if (clearFiltersBtn) {
                clearFiltersBtn.addEventListener('click', () => {
                    searchInput.value = '';
                    categoryCheckboxes.forEach(cb => cb.checked = false);
                    this.filterMappings();
                });
            }
        }
        
        // Add plus button for mappings (like transactions)
        const addBar = document.querySelector('.add-bar');
        console.log('Add bar element:', addBar);
        if (addBar) {
            addBar.innerHTML = `
                <button class="btn-add" id="add-mapping-btn">
                    <i data-lucide="plus"></i>
                    Add Mapping
                </button>
            `;
            addBar.style.display = 'flex';
            console.log('Add bar updated with button');
        } else {
            console.error('Add bar element not found!');
        }
        
        // Hidden file input for CSV import
        if (!document.getElementById('import-mappings-input')) {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'import-mappings-input';
            fileInput.accept = '.csv';
            fileInput.multiple = true;
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
        }
        
        // Attach file input change listener after element is created
        const fileInput = document.getElementById('import-mappings-input');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    try {
                        const processedMappings = await this.csvEngine.processMappingsCSV(e.target.files);
                        
                        if (processedMappings.length === 0) {
                            alert('No valid mappings found in CSV');
                            return;
                        }
                        
                        // Check for unmapped categories FIRST (before showing page)
                        const unmappedCategories = [...new Set(
                            processedMappings
                                .filter(m => !m.categoryId && m.categoryName)
                                .map(m => m.categoryName)
                        )];
                        
                        if (unmappedCategories.length > 0) {
                            // Resolve unmapped categories before showing page
                            const categoryResolutions = await this.showCategoryResolutionModal(unmappedCategories);
                            
                            if (!categoryResolutions) {
                                // User cancelled
                                e.target.value = '';
                                return;
                            }
                            
                            // Apply resolutions to processedMappings
                            for (const mapping of processedMappings) {
                                if (!mapping.categoryId && mapping.categoryName) {
                                    const resolution = categoryResolutions[mapping.categoryName];
                                    if (resolution) {
                                        mapping.categoryId = resolution.categoryId;
                                    }
                                }
                            }
                        }
                        
                        // NOW open mappings review page with all categories resolved
                        await this.openMappingsReviewPage(processedMappings);
                    } catch (error) {
                        console.error('Mappings CSV import failed:', error);
                        alert('Failed to import mappings CSV: ' + error.message);
                    }
                    // Reset input value so same file can be selected again
                    e.target.value = '';
                }
            });
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
                    <h3>Settings</h3>
                    <p style="color: var(--text-secondary);">Settings panel coming soon</p>
                </div>
            `;
        }
    }

    showAddMappingModal() {
        const modalHTML = `
            <div class="modal-overlay" id="add-mapping-choice-modal">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h2>Add Mapping</h2>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 1rem; color: var(--text-secondary);">Choose how to add mappings:</p>
                        <button class="btn-primary" id="add-mapping-manual" style="width: 100%; margin-bottom: 12px;">
                            <i data-lucide="edit-3"></i>
                            Manual Entry
                        </button>
                        <button class="btn-secondary" id="add-mapping-import" style="width: 100%;">
                            <i data-lucide="upload"></i>
                            Import CSV
                        </button>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="cancel-add-mapping">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('add-mapping-choice-modal');
        
        // Manual entry
        modal.querySelector('#add-mapping-manual').addEventListener('click', () => {
            modal.remove();
            this.showManualMappingModal();
        });
        
        // Import CSV
        modal.querySelector('#add-mapping-import').addEventListener('click', () => {
            modal.remove();
            const input = document.getElementById('import-mappings-input');
            if (input) input.click();
        });
        
        // Cancel
        modal.querySelector('#cancel-add-mapping').addEventListener('click', () => {
            modal.remove();
        });
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async showManualMappingModal(mapping = null) {
        const categories = await this.db.getAllCategories();
        const isEdit = !!mapping;
        
        const categoryOptions = await Promise.all(categories.map(async (cat) => {
            const name = await this.security.decrypt(cat.encrypted_name);
            return `<option value="${cat.id}">${name} (${cat.type})</option>`;
        }));
        
        const modalHTML = `
            <div class="modal-overlay" id="manual-mapping-modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>${isEdit ? 'Edit' : 'Add'} Mapping</h2>
                    </div>
                    <div class="modal-body">
                        <form id="mapping-form">
                            <div class="form-group">
                                <label>Description (Transaction text to match)</label>
                                <input type="text" id="mapping-description" placeholder="E.g., STARBUCKS" value="${mapping ? mapping.description : ''}" required>
                            </div>
                            <div class="form-group">
                                <label>Payee (Optional)</label>
                                <input type="text" id="mapping-payee" placeholder="E.g., Starbucks Coffee">
                            </div>
                            <div class="form-group">
                                <label>Category</label>
                                <select id="mapping-category" required>
                                    <option value="">Select category...</option>
                                    ${categoryOptions.join('')}
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="cancel-mapping">Cancel</button>
                        <button class="btn btn-primary" id="save-mapping">Save</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('manual-mapping-modal');
        
        // If editing, populate payee
        if (mapping && mapping.encrypted_payee) {
            const payee = await this.security.decrypt(mapping.encrypted_payee);
            document.getElementById('mapping-payee').value = payee;
        }
        
        // Save
        modal.querySelector('#save-mapping').addEventListener('click', async () => {
            const description = document.getElementById('mapping-description').value.trim();
            const payee = document.getElementById('mapping-payee').value.trim();
            const categoryId = parseInt(document.getElementById('mapping-category').value);
            
            if (!description) {
                alert('Please enter a description');
                return;
            }
            
            if (!categoryId) {
                alert('Please select a category');
                return;
            }
            
            // Get category name
            const category = categories.find(c => c.id === categoryId);
            const categoryName = await this.security.decrypt(category.encrypted_name);
            
            // Save mapping
            await this.db.setMappingDescription(
                description,
                await this.security.encrypt(categoryName),
                payee ? await this.security.encrypt(payee) : ''
            );
            
            modal.remove();
            await this.renderMappingsTab();
        });
        
        // Cancel
        modal.querySelector('#cancel-mapping').addEventListener('click', () => {
            modal.remove();
        });
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    filterMappings() {
        const searchTerm = document.getElementById('mappings-search')?.value.toLowerCase() || '';
        const selectedCategories = Array.from(document.querySelectorAll('.mappings-category-filter:checked'))
            .map(cb => cb.value.toLowerCase());
        
        const mappingItems = document.querySelectorAll('.mapping-item');
        let visibleCount = 0;
        
        mappingItems.forEach(item => {
            const description = item.dataset.description || '';
            const category = item.dataset.category || '';
            const payee = item.dataset.payee || '';
            
            // Check search term (searches description, category, and payee)
            const matchesSearch = searchTerm === '' || 
                description.includes(searchTerm) || 
                category.includes(searchTerm) || 
                payee.includes(searchTerm);
            
            // Check category filter
            const matchesCategory = selectedCategories.length === 0 || 
                selectedCategories.includes(category);
            
            // Show/hide item
            if (matchesSearch && matchesCategory) {
                item.style.display = '';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });
        
        // Update count
        const countEl = document.getElementById('mappings-count');
        if (countEl) {
            countEl.textContent = `Showing ${visibleCount} mapping(s)`;
        }
    }

    applyTransactionFilters() {
        const categorySelect = document.getElementById('filter-category');
        const accountSelect = document.getElementById('filter-account');
        const descriptionSelect = document.getElementById('filter-description');
        const amountMin = document.getElementById('filter-amount-min');
        const amountMax = document.getElementById('filter-amount-max');
        const dateStart = document.getElementById('filter-date-start');
        const dateEnd = document.getElementById('filter-date-end');
        
        this.transactionUI.filters.categories = Array.from(categorySelect.selectedOptions).map(o => o.value);
        this.transactionUI.filters.accounts = Array.from(accountSelect.selectedOptions).map(o => o.value);
        this.transactionUI.filters.descriptions = Array.from(descriptionSelect.selectedOptions).map(o => o.value);
        this.transactionUI.filters.amountMin = amountMin.value ? parseFloat(amountMin.value) : null;
        this.transactionUI.filters.amountMax = amountMax.value ? parseFloat(amountMax.value) : null;
        this.transactionUI.filters.dateStart = dateStart.value || null;
        this.transactionUI.filters.dateEnd = dateEnd.value || null;
    }

    clearTransactionFilters() {
        // Reset UI
        document.getElementById('transaction-search').value = '';
        document.getElementById('filter-category').selectedIndex = -1;
        document.getElementById('filter-account').selectedIndex = -1;
        document.getElementById('filter-description').selectedIndex = -1;
        document.getElementById('filter-amount-min').value = '';
        document.getElementById('filter-amount-max').value = '';
        document.getElementById('filter-date-start').value = '';
        document.getElementById('filter-date-end').value = '';
        document.getElementById('sort-field').value = 'date';
        document.getElementById('sort-order').value = 'desc';
        
        // Reset checkboxes
        document.getElementById('search-description').checked = true;
        document.getElementById('search-account').checked = false;
        document.getElementById('search-category').checked = false;
        document.getElementById('search-note').checked = false;
        
        // Reset state
        this.transactionUI.searchQuery = '';
        this.transactionUI.searchFields = ['description'];
        this.transactionUI.sortField = 'date';
        this.transactionUI.sortOrder = 'desc';
        this.transactionUI.filters = {
            categories: [],
            accounts: [],
            descriptions: [],
            amountMin: null,
            amountMax: null,
            dateStart: null,
            dateEnd: null
        };
    }

    updateFilterIndicator() {
        const searchBar = document.querySelector('.search-bar');
        if (!searchBar) return;
        
        const hasActiveFilters = 
            this.transactionUI.searchQuery ||
            this.transactionUI.filters.categories.length > 0 ||
            this.transactionUI.filters.accounts.length > 0 ||
            this.transactionUI.filters.descriptions.length > 0 ||
            this.transactionUI.filters.amountMin !== null ||
            this.transactionUI.filters.amountMax !== null ||
            this.transactionUI.filters.dateStart ||
            this.transactionUI.filters.dateEnd ||
            this.transactionUI.sortField !== 'date' ||
            this.transactionUI.sortOrder !== 'desc';
        
        if (hasActiveFilters) {
            searchBar.classList.add('has-active-filters');
        } else {
            searchBar.classList.remove('has-active-filters');
        }
    }

    /**
     * Open mappings CSV import review page
     */
    async openMappingsReviewPage(processedMappings) {
        const allCategories = await this.db.getAllCategories();
        
        // Initialize filter state
        this.mappingsSearchQuery = '';
        this.mappingsFilterDuplicates = false;
        this.mappingsFilterUnmapped = false;
        this.mappingsFilterCategories = [];
        
        const pageHTML = `
            <div style="padding: 1rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
                <p style="margin: 0; font-weight: 600;"><strong id="mappings-total-count">${processedMappings.length}</strong> mappings (<span id="mappings-visible-count">${processedMappings.length}</span> visible)</p>
            </div>
            
            <!-- Search and Filter (Hamburger Menu) -->
            <div class="mappings-search-filter" style="padding: 1rem; background: var(--bg-primary); border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
                <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem;">
                    <div class="search-bar" style="flex: 1; margin: 0;">
                        <div class="search-input-wrapper">
                            <i data-lucide="search"></i>
                            <input type="text" id="mappings-search-input" placeholder="Search descriptions..." />
                        </div>
                    </div>
                    <button class="btn-icon" id="mappings-filter-toggle" title="Advanced Filters" style="flex-shrink: 0;">
                        <i data-lucide="sliders-horizontal"></i>
                    </button>
                </div>
                
                <!-- Advanced Filter Panel (Hidden by default) -->
                <div id="mappings-filter-panel" class="hidden" style="margin-top: 0.75rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                    <h4 style="margin: 0 0 0.75rem 0; font-size: 0.875rem; font-weight: 600;">Quick Filters</h4>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                        <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.875rem;">
                            <input type="checkbox" id="mappings-filter-duplicates">
                            Hide Duplicates
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.875rem;">
                            <input type="checkbox" id="mappings-filter-unmapped">
                            Show Only Unmapped
                        </label>
                    </div>
                    
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.875rem; font-weight: 600;">Filter by Category</h4>
                    <div id="mappings-category-filters" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                        <!-- Category checkboxes will be populated here -->
                    </div>
                    
                    <button class="btn-secondary" id="mappings-skip-all" style="width: 100%;">
                        <i data-lucide="x-circle"></i>
                        Skip All Visible
                    </button>
                </div>
            </div>
            
            <div id="mappings-review-list" style="flex: 1; overflow-y: auto; padding: 1rem; padding-bottom: calc(80px + env(safe-area-inset-bottom));">
                ${this.buildMappingsReviewList(processedMappings, allCategories)}
            </div>
            
            <div style="position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 1rem; padding: 1rem; padding-bottom: calc(1rem + env(safe-area-inset-bottom)); background: var(--bg-secondary); border-top: 1px solid var(--border-color); z-index: 100;">
                <button class="btn btn-secondary" id="mappings-review-cancel" style="flex: 1;">Cancel</button>
                <button class="btn btn-primary" id="mappings-review-import" style="flex: 1;">Import Selected</button>
            </div>
        `;
        
        const mappingsPage = document.getElementById('csv-import-page');
        const mappingsContent = document.getElementById('csv-import-content');
        if (!mappingsPage || !mappingsContent) {
            console.error('CSV import page not found');
            return;
        }
        
        mappingsContent.innerHTML = pageHTML;
        
        // Save current tab
        this.previousTab = this.currentTab || 'mappings';
        
        // Show mappings import page (use active class like normal tabs)
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        mappingsPage.classList.remove('hidden');
        mappingsPage.classList.add('active');
        
        // Hide bottom navigation and FAB
        const bottomNav = document.querySelector('.bottom-nav');
        const fab = document.querySelector('.fab');
        if (bottomNav) bottomNav.style.display = 'none';
        if (fab) fab.classList.add('hidden');
        
        const modal = mappingsPage;
        
        // Back button
        document.getElementById('csv-import-back').addEventListener('click', () => {
            this.closeMappingsImportPage();
        });
        
        // Cancel button
        document.getElementById('mappings-review-cancel').addEventListener('click', () => {
            this.closeMappingsImportPage();
        });
        
        // Import button
        document.getElementById('mappings-review-import').addEventListener('click', async () => {
            await this.handleMappingsImport(processedMappings);
            this.closeMappingsImportPage();
        });
        
        // Search
        document.getElementById('mappings-search-input').addEventListener('input', (e) => {
            this.mappingsSearchQuery = e.target.value;
            this.applyMappingsFilters(modal, processedMappings);
        });
        
        // Filter toggle
        document.getElementById('mappings-filter-toggle').addEventListener('click', () => {
            const panel = document.getElementById('mappings-filter-panel');
            if (panel) {
                panel.classList.toggle('hidden');
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        });
        
        // Populate category filters
        const categoryFiltersContainer = document.getElementById('mappings-category-filters');
        if (categoryFiltersContainer) {
            const categorySet = new Set();
            processedMappings.forEach(m => {
                if (m.categoryName) categorySet.add(m.categoryName);
            });
            
            Array.from(categorySet).sort().forEach(catName => {
                const label = document.createElement('label');
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.gap = '0.3rem';
                label.style.fontSize = '0.875rem';
                label.innerHTML = `
                    <input type="checkbox" class="mappings-category-filter" value="${catName}">
                    ${catName}
                `;
                categoryFiltersContainer.appendChild(label);
            });
            
            // Category filter checkboxes
            categoryFiltersContainer.querySelectorAll('.mappings-category-filter').forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    this.mappingsFilterCategories = Array.from(
                        categoryFiltersContainer.querySelectorAll('.mappings-category-filter:checked')
                    ).map(cb => cb.value);
                    this.applyMappingsFilters(modal, processedMappings);
                });
            });
        }
        
        // Filters
        document.getElementById('mappings-filter-duplicates').addEventListener('change', (e) => {
            this.mappingsFilterDuplicates = e.target.checked;
            this.applyMappingsFilters(modal, processedMappings);
        });
        
        document.getElementById('mappings-filter-unmapped').addEventListener('change', (e) => {
            this.mappingsFilterUnmapped = e.target.checked;
            this.applyMappingsFilters(modal, processedMappings);
        });
        
        // Skip All
        document.getElementById('mappings-skip-all').addEventListener('click', () => {
            modal.querySelectorAll('.csv-review-item').forEach((item) => {
                if (item.style.display !== 'none') {
                    const checkbox = item.querySelector('.csv-skip-checkbox');
                    if (checkbox && !checkbox.checked) {
                        checkbox.checked = true;
                        const index = parseInt(checkbox.dataset.index);
                        if (processedMappings[index]) {
                            processedMappings[index].skip = true;
                        }
                    }
                }
            });
        });
        
        // Skip checkboxes
        modal.querySelectorAll('.csv-skip-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (processedMappings[index]) {
                    processedMappings[index].skip = e.target.checked;
                }
            });
        });
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    buildMappingsReviewList(processedMappings, allCategories) {
        let html = '<div class="csv-review-items">';
        
        // Decrypt category names
        const categoryNames = {};
        allCategories.forEach(cat => {
            // Sync decrypt for now - we'll improve this if needed
        });
        
        for (let i = 0; i < processedMappings.length; i++) {
            const item = processedMappings[i];
            const isDuplicate = item.isDuplicate;
            const hasCategory = item.categoryId !== null;
            
            html += `
                <div class="csv-review-item ${isDuplicate ? 'duplicate' : ''}" data-item-index="${i}">
                    <div class="csv-review-checkbox">
                        <input type="checkbox" class="csv-skip-checkbox" data-index="${i}" 
                               ${isDuplicate ? 'checked' : ''}>
                        <label style="font-size: 0.75rem; color: var(--text-secondary);">
                            ${isDuplicate ? 'Duplicate' : 'Skip'}
                        </label>
                    </div>
                    
                    <div class="csv-review-details">
                        <div class="csv-review-row">
                            <strong>${item.description}</strong>
                            <span style="color: var(--text-secondary); font-size: 0.875rem;">${item.payee || ''}</span>
                        </div>
                        
                        <div class="csv-review-row" style="font-size: 0.875rem; color: var(${hasCategory ? '--success-color' : '--text-secondary'});">
                            <span>${hasCategory ? item.categoryName : 'Category not found'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }

    applyMappingsFilters(modal, processedMappings) {
        const searchQuery = this.mappingsSearchQuery.toLowerCase();
        
        let visibleCount = 0;
        
        modal.querySelectorAll('.csv-review-item').forEach((item) => {
            const dataIndex = parseInt(item.getAttribute('data-item-index'));
            const data = processedMappings[dataIndex];
            if (!data) return;
            
            let shouldShow = true;
            
            // Search filter
            if (searchQuery) {
                const description = (data.description || '').toLowerCase();
                const payee = (data.payee || '').toLowerCase();
                shouldShow = description.includes(searchQuery) || payee.includes(searchQuery);
            }
            
            // Category filter
            if (shouldShow && this.mappingsFilterCategories && this.mappingsFilterCategories.length > 0) {
                shouldShow = this.mappingsFilterCategories.includes(data.categoryName);
            }
            
            // Quick filters
            if (shouldShow && this.mappingsFilterDuplicates) {
                shouldShow = !data.isDuplicate;
            }
            
            if (shouldShow && this.mappingsFilterUnmapped) {
                shouldShow = data.categoryId === null;
            }
            
            if (shouldShow) {
                item.style.display = '';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });
        
        const visibleCountEl = document.getElementById('mappings-visible-count');
        if (visibleCountEl) {
            visibleCountEl.textContent = visibleCount;
        }
    }

    async handleMappingsImport(processedMappings) {
        const toImport = processedMappings.filter(item => !item.skip && !item.isDuplicate);
        
        if (toImport.length === 0) {
            alert('No mappings selected for import');
            return;
        }
        
        try {
            const imported = await this.csvEngine.importReviewedMappings(toImport);
            alert(`Successfully imported ${imported.length} mapping(s)`);
            
            // Close import page and refresh mappings view
            this.closeMappingsImportPage();
            await this.renderMappingsTab(); // Refresh to show new mappings
        } catch (error) {
            console.error('Mappings import failed:', error);
            alert('Import failed: ' + error.message);
        }
    }

    closeMappingsImportPage() {
        const mappingsPage = document.getElementById('csv-import-page');
        const bottomNav = document.querySelector('.bottom-nav');
        
        if (mappingsPage) {
            mappingsPage.classList.remove('active');
            mappingsPage.classList.add('hidden');
        }
        
        if (bottomNav) bottomNav.style.display = '';
        
        // Return to previous tab
        const returnTab = this.previousTab || 'mappings';
        this.showTab(returnTab);
    }
    
    /**
     * Show category resolution modal for unmapped categories
     * Returns: { [categoryName]: { categoryId, isNew } } or null if cancelled
     */
    async showCategoryResolutionModal(unmappedCategories) {
        const allCategories = await this.db.getAllCategories();
        
        return new Promise(async (resolve) => {
            const modalHTML = `
                <div class="modal-overlay" id="category-resolution-modal">
                    <div class="modal-content" style="max-width: 600px; max-height: 80vh;">
                        <div class="modal-header">
                            <h2>Categories Not Found</h2>
                        </div>
                        <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                            <p style="margin-bottom: 1rem; color: var(--text-secondary);">The following categories were not found in your budget. Choose how to handle each one:</p>
                            <div id="unmapped-categories-list"></div>
                        </div>
                        <div class="modal-actions">
                            <button class="btn btn-secondary" id="resolution-cancel">Cancel</button>
                            <button class="btn btn-primary" id="resolution-confirm">Confirm All</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const modal = document.getElementById('category-resolution-modal');
            const listContainer = document.getElementById('unmapped-categories-list');
            
            // Build list of unmapped categories
            unmappedCategories.forEach((categoryName, index) => {
                const itemHTML = `
                    <div class="unmapped-category-item" style="padding: 1rem; margin-bottom: 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px;" data-category="${categoryName}">
                        <div style="font-weight: 600; margin-bottom: 0.75rem; color: var(--text-primary);">${categoryName}</div>
                        
                        <div style="margin-bottom: 0.75rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="radio" name="resolution-${index}" value="existing" checked class="resolution-radio" style="cursor: pointer;">
                                <span style="color: var(--text-primary);">Map to existing category</span>
                            </label>
                            <select class="existing-category-select" data-index="${index}" style="width: 100%; padding: 0.5rem; margin: 0.5rem 0 0 1.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                                <option value="" style="background: var(--bg-secondary); color: var(--text-primary);">Select a category...</option>
                            </select>
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="radio" name="resolution-${index}" value="new" class="resolution-radio" style="cursor: pointer;">
                                <span style="color: var(--text-primary);">Create new category "${categoryName}"</span>
                            </label>
                            <select class="new-category-type" data-index="${index}" disabled style="width: 100%; padding: 0.5rem; margin: 0.5rem 0 0 1.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font-size: 14px;">
                                <option value="" style="background: var(--bg-secondary); color: var(--text-primary);">Select type...</option>
                                <option value="Expense" style="background: var(--bg-secondary); color: var(--text-primary);">Expense</option>
                                <option value="Income" style="background: var(--bg-secondary); color: var(--text-primary);">Income</option>
                                <option value="Saving" style="background: var(--bg-secondary); color: var(--text-primary);">Saving</option>
                            </select>
                        </div>
                    </div>
                `;
                listContainer.insertAdjacentHTML('beforeend', itemHTML);
            });
            
            // Populate existing categories in all dropdowns
            const allSelects = modal.querySelectorAll('.existing-category-select');
            
            if (allCategories.length === 0) {
                console.warn('No categories found in budget - user must create new categories');
                // Update all dropdowns to show helpful message
                allSelects.forEach(select => {
                    select.innerHTML = '<option value="">No categories yet - create new below</option>';
                    select.disabled = true;
                });
                
                // Auto-select "Create new" option for all items
                modal.querySelectorAll('.unmapped-category-item').forEach(item => {
                    const newRadio = item.querySelector('input[value="new"]');
                    const existingRadio = item.querySelector('input[value="existing"]');
                    if (newRadio && existingRadio) {
                        newRadio.checked = true;
                        existingRadio.disabled = true;
                        item.querySelector('.existing-category-select').disabled = true;
                        item.querySelector('.new-category-type').disabled = false;
                    }
                });
            } else {
                // Populate dropdowns with existing categories
                for (const cat of allCategories) {
                    const name = await this.security.decrypt(cat.encrypted_name);
                    allSelects.forEach(select => {
                        const option = document.createElement('option');
                        option.value = cat.id;
                        option.textContent = `${name} (${cat.type})`;
                        option.style.background = 'var(--bg-secondary)';
                        option.style.color = 'var(--text-primary)';
                        option.style.fontSize = '14px';
                        select.appendChild(option);
                    });
                }
            }
            
            // Radio button toggle handlers
            modal.querySelectorAll('.resolution-radio').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const item = e.target.closest('.unmapped-category-item');
                    const existingSelect = item.querySelector('.existing-category-select');
                    const newTypeSelect = item.querySelector('.new-category-type');
                    
                    if (e.target.value === 'existing') {
                        existingSelect.disabled = false;
                        newTypeSelect.disabled = true;
                        newTypeSelect.value = '';
                    } else {
                        existingSelect.disabled = true;
                        existingSelect.value = '';
                        newTypeSelect.disabled = false;
                    }
                });
            });
            
            // Cancel button
            modal.querySelector('#resolution-cancel').addEventListener('click', () => {
                modal.remove();
                resolve(null);
            });
            
            // Confirm button
            modal.querySelector('#resolution-confirm').addEventListener('click', async () => {
                const resolutions = {};
                
                for (let i = 0; i < unmappedCategories.length; i++) {
                    const categoryName = unmappedCategories[i];
                    const item = modal.querySelector(`[data-category="${categoryName}"]`);
                    const selectedOption = item.querySelector('input[type="radio"]:checked').value;
                    
                    if (selectedOption === 'existing') {
                        const existingSelect = item.querySelector('.existing-category-select');
                        const categoryId = existingSelect.value;
                        if (!categoryId) {
                            alert(`Please select a category for "${categoryName}"`);
                            return;
                        }
                        resolutions[categoryName] = { categoryId: parseInt(categoryId), isNew: false };
                    } else {
                        const newTypeSelect = item.querySelector('.new-category-type');
                        const type = newTypeSelect.value;
                        if (!type) {
                            alert(`Please select a type for "${categoryName}"`);
                            return;
                        }
                        
                        // Create new category
                        const newCategoryId = await this.db.saveCategory({
                            encrypted_name: await this.security.encrypt(categoryName),
                            encrypted_limit: await this.security.encrypt('0'),
                            type: type
                        });
                        
                        resolutions[categoryName] = { categoryId: newCategoryId, isNew: true, type };
                    }
                }
                
                modal.remove();
                resolve(resolutions);
            });
        });
    }
}
