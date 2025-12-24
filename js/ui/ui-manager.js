// UIManager - Main UI Coordinator (Delegate-Only Pattern)
import { AuthUI } from './auth-ui.js';
import { TransactionUI } from './transaction-ui.js';
import { BudgetUI } from './budget-ui.js';
import { SummaryUI } from './summary-ui.js';
import { MappingsUI } from './mappings-ui.js';
import { SettingsUI } from './settings-ui.js';
import { ModalManager } from './modal-manager.js';
import { CSVReviewUI } from './csv-review-ui.js';

export class UIManager {
    constructor(security, db, csvEngine) {
        this.security = security;
        this.db = db;
        this.csvEngine = csvEngine;
        this.currentTab = 'transactions';
        
        // Initialize UI modules
        this.authUI = new AuthUI(security, db);
        this.transactionUI = new TransactionUI(security, db);
        this.budgetUI = new BudgetUI(security, db);
        this.summaryUI = new SummaryUI(security, db);
        this.modalManager = new ModalManager(security, db);
        this.csvReviewUI = new CSVReviewUI(security, db);
        this.mappingsUI = new MappingsUI(security, db, csvEngine, this.modalManager);
        this.settingsUI = new SettingsUI(security, db);
        
        // Expose budgetUI globally for onclick handlers
        window.budgetUI = this.budgetUI;
        
        // Set parent references
        this.transactionUI.uiManager = this;
        this.csvReviewUI.onImportSuccess = async () => {
            await this.transactionUI.renderTransactionsTab();
        };
        this.mappingsUI.showTabCallback = (tab) => this.showTab(tab);
        
        // Callback for app state changes
        this.onSetupSuccess = null;
        this.onUnlockSuccess = null;
    }

    attachEventListeners() {
        console.log('🔗 Attaching event listeners...');
        
        document.addEventListener('click', async (e) => {
            // Auth
            if (e.target.id === 'setup-submit' || e.target.closest('#setup-submit')) {
                e.preventDefault();
                const result = await this.authUI.handleSetupSubmit();
                if (result && result.success && this.onSetupSuccess) {
                    this.onSetupSuccess();
                }
            }
            
            if (e.target.id === 'unlock-submit' || e.target.closest('#unlock-submit')) {
                e.preventDefault();
                const result = await this.authUI.handleUnlockSubmit();
                if (result && result.success && this.onUnlockSuccess) {
                    this.onUnlockSuccess();
                }
            }
            
            // Navigation
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                const tab = navItem.dataset.tab;
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                navItem.classList.add('active');
                this.currentTab = tab;
                this.showTab(tab);
            }
            
            // Transaction FAB
            if (e.target.closest('#fab-add-transaction')) {
                const menu = document.getElementById('fab-transaction-menu');
                if (menu) menu.classList.toggle('hidden');
            }
            
            if (e.target.closest('#fab-manual-entry')) {
                document.getElementById('fab-transaction-menu')?.classList.add('hidden');
                await this.transactionUI.openTransactionModal();
            }
            
            if (e.target.closest('#fab-import-csv')) {
                document.getElementById('fab-transaction-menu')?.classList.add('hidden');
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            const processedData = await this.csvEngine.processTransactionCSV(file);
                            if (processedData.length === 0) {
                                alert('No valid transactions found in CSV');
                                return;
                            }
                            await this.csvReviewUI.openCSVReviewPage(processedData, this.csvEngine, this);
                        } catch (error) {
                            console.error('CSV import failed:', error);
                            alert('Failed to import CSV: ' + error.message);
                        }
                    }
                };
                input.click();
            }
            
            if (e.target.closest('#fab-undo')) {
                document.getElementById('fab-transaction-menu')?.classList.add('hidden');
                const success = await this.transactionUI.undoLastAdd();
                if (success) {
                    await this.transactionUI.renderTransactionsTab();
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                }
            }
            
            if (e.target.closest('#fab-redo')) {
                document.getElementById('fab-transaction-menu')?.classList.add('hidden');
                const success = await this.transactionUI.redoLastAdd();
                if (success) {
                    await this.transactionUI.renderTransactionsTab();
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                }
            }
            
            // Transactions
            const transactionItem = e.target.closest('.transaction-item[data-id]');
            if (transactionItem) {
                const transactionId = parseInt(transactionItem.dataset.id);
                await this.transactionUI.openTransactionModal(transactionId);
            }
            
            // Mappings
            const mappingItem = e.target.closest('.mapping-item[data-description]');
            if (mappingItem && this.currentTab === 'mappings') {
                const description = mappingItem.dataset.description;
                await this.mappingsUI.openMappingForEdit(description);
            }
            
            if (e.target.closest('#transaction-form-submit')) {
                e.preventDefault();
                await this.transactionUI.saveTransaction(async () => {
                    await this.transactionUI.renderTransactionsTab();
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                });
            }
            
            if (e.target.closest('#delete-transaction-btn')) {
                const transactionId = parseInt(document.getElementById('transaction-form').dataset.editId);
                await this.transactionUI.deleteTransaction(transactionId, async () => {
                    await this.transactionUI.renderTransactionsTab();
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                });
            }
            
            // Categories
            if (e.target.closest('#fab-add-category') || e.target.closest('#fab-add-category-inline') || e.target.closest('#fab-add-category-btn')) {
                this.budgetUI.openCategoryModal();
                // Close FAB menu if open
                const fabMenu = document.getElementById('fab-budget-menu');
                if (fabMenu) fabMenu.classList.add('hidden');
            }
            
            const categoryCard = e.target.closest('.category-card[data-id]');
            if (categoryCard && !e.target.closest('.fab')) {
                const categoryId = parseInt(categoryCard.dataset.id);
                await this.budgetUI.openCategoryModal(categoryId);
            }
            
            if (e.target.closest('#category-form-submit')) {
                e.preventDefault();
                await this.budgetUI.saveCategory(async () => {
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                });
            }
            
            if (e.target.closest('#delete-category-btn')) {
                const categoryId = parseInt(document.getElementById('category-form').dataset.editId);
                await this.budgetUI.deleteCategory(categoryId, async () => {
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                });
            }
            
            // Mappings FAB
            if (e.target.closest('#fab-add-mapping')) {
                this.mappingsUI.toggleMappingFabMenu();
            }
            
            if (e.target.closest('#fab-mapping-manual')) {
                document.getElementById('fab-mapping-menu')?.classList.add('hidden');
                this.mappingsUI.showManualMappingModal();
            }
            
            if (e.target.closest('#fab-mapping-import')) {
                document.getElementById('fab-mapping-menu')?.classList.add('hidden');
                const input = document.getElementById('import-mappings-input');
                if (input) input.click();
            }
            
            // Filters
            if (e.target.closest('#advanced-search-toggle')) {
                const panel = document.getElementById('advanced-search-panel');
                if (panel) {
                    panel.classList.toggle('hidden');
                    if (!panel.classList.contains('hidden')) {
                        await this.transactionUI.populateFilterOptions();
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    }
                }
            }
            
            const sectionToggle = e.target.closest('.section-toggle');
            if (sectionToggle) {
                sectionToggle.classList.toggle('collapsed');
                const content = sectionToggle.nextElementSibling;
                if (content && content.classList.contains('advanced-section-content')) {
                    content.classList.toggle('collapsed');
                }
            }
            
            if (e.target.closest('#clear-filters')) {
                this.clearTransactionFilters();
                this.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            }
            
            // Modals
            const closeModal = e.target.closest('.close-modal');
            if (closeModal) {
                const modalId = closeModal.dataset.modal;
                if (modalId) document.getElementById(modalId)?.classList.add('hidden');
            }
            
            // Summary
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
                    
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            }
            
            // Close FAB menu when clicking outside
            const fabMenu = document.getElementById('fab-transaction-menu');
            if (fabMenu && !fabMenu.classList.contains('hidden')) {
                if (!e.target.closest('#fab-add-transaction') && !e.target.closest('#fab-transaction-menu')) {
                    fabMenu.classList.add('hidden');
                }
            }
        });
        
        // Search
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
        
        // Search fields
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
        
        // Sort
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
        
        // Filter inputs
        ['filter-category-search', 'filter-account-search', 'filter-description-search'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                const targetId = id.replace('-search', '');
                input.addEventListener('input', () => {
                    this.transactionUI.filterSelectOptions(targetId, id);
                });
            }
        });
        
        // Filter selects
        ['filter-category', 'filter-account', 'filter-description', 'filter-amount-min', 'filter-amount-max', 'filter-date-start', 'filter-date-end'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const eventType = id.includes('amount') ? 'input' : 'change';
                el.addEventListener(eventType, async () => {
                    this.applyTransactionFilters();
                    this.updateFilterIndicator();
                    await this.transactionUI.renderTransactionsTab();
                });
            }
        });
        
        // Enter key for passwords
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

    showTab(tabName) {
        console.log('📱 Showing tab:', tabName);
        
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.tab === tabName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show selected tab
        const targetTab = document.getElementById(`tab-${tabName}`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // Show/hide FABs
        const transactionFab = document.getElementById('fab-add-transaction');
        if (transactionFab) {
            if (tabName === 'transactions') {
                transactionFab.classList.remove('hidden');
            } else {
                transactionFab.classList.add('hidden');
            }
        }
        
        const mappingFab = document.getElementById('fab-add-mapping');
        if (mappingFab) {
            if (tabName === 'mappings') {
                mappingFab.classList.remove('hidden');
            } else {
                mappingFab.classList.add('hidden');
            }
        }
        
        // Show/hide summary cards
        const summarySection = document.querySelector('.summary-section-fixed');
        if (summarySection) {
            if (tabName === 'budget') {
                summarySection.classList.remove('hidden');
            } else {
                summarySection.classList.add('hidden');
            }
        }
        
        // Render content
        if (tabName === 'transactions') {
            this.transactionUI.renderTransactionsTab();
        } else if (tabName === 'budget') {
            this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
        } else if (tabName === 'summary') {
            this.summaryUI.renderSummaryTab();
        } else if (tabName === 'mappings') {
            this.mappingsUI.renderMappingsTab();
        } else if (tabName === 'settings') {
            this.settingsUI.renderSettingsTab();
        }
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
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
        
        document.getElementById('search-description').checked = true;
        document.getElementById('search-account').checked = false;
        document.getElementById('search-category').checked = false;
        document.getElementById('search-note').checked = false;
        
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
}
