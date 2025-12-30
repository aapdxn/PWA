/**
 * EventCoordinator - Central event delegation system for application-wide interactions
 * 
 * Manages all DOM event listeners across the application using event delegation
 * patterns for better performance and maintainability. Coordinates user interactions
 * with appropriate UI modules and state managers.
 * 
 * RESPONSIBILITIES:
 * - Attach and manage all click, input, and keyboard event listeners
 * - Delegate events to appropriate UI modules (Auth, Transaction, Budget, etc.)
 * - Handle navigation and tab switching events
 * - Manage filter application and search interactions
 * - Coordinate modal lifecycle events
 * - Handle bulk selection and transaction operations
 * 
 * DEPENDENCIES:
 * - All UI modules (AuthUI, TransactionUI, BudgetUI, etc.)
 * - TabManager: Tab navigation and visibility
 * - FilterManager: Filter state and application
 * - CSVEngine: CSV processing
 * - ModalManager: Modal displays
 * 
 * EVENT DELEGATION PATTERN:
 * Uses document-level event listeners with .closest() checks for better
 * performance with dynamic content. Listeners remain active even when
 * DOM elements are replaced during rendering.
 * 
 * CATEGORIZATION:
 * Events are grouped into logical categories (auth, transaction, category,
 * mapping, filter, search, modal, summary, keyboard) for maintainability.
 * 
 * @class EventCoordinator
 * @module UI/EventCoordination
 * @layer 5 - UI Components
 */

export class EventCoordinator {
    /**
     * Creates EventCoordinator instance with references to all UI modules and managers
     * 
     * @param {Object} uiModules - Collection of UI module instances
     * @param {AuthUI} uiModules.authUI - Authentication UI
     * @param {TransactionUI} uiModules.transactionUI - Transaction management UI
     * @param {BudgetUI} uiModules.budgetUI - Budget/category management UI
     * @param {CSVReviewUI} uiModules.csvReviewUI - CSV import review UI
     * @param {CSVEngine} uiModules.csvEngine - CSV processing engine
     * @param {ModalManager} uiModules.modalManager - Modal management
     * @param {MappingsUI} uiModules.mappingsUI - Description mappings UI
     * @param {AccountMappingsUI} uiModules.accountMappingsUI - Account mappings UI
     * @param {TabManager} tabManager - Tab navigation manager
     * @param {FilterManager} filterManager - Filter state manager
     * @param {Object} callbacks - State transition callbacks
     * @param {Function} callbacks.onSetupSuccess - Called after successful password setup
     * @param {Function} callbacks.onUnlockSuccess - Called after successful unlock
     */
    constructor(uiModules, tabManager, filterManager, callbacks) {
        this.authUI = uiModules.authUI;
        this.transactionUI = uiModules.transactionUI;
        this.budgetUI = uiModules.budgetUI;
        this.csvReviewUI = uiModules.csvReviewUI;
        this.csvEngine = uiModules.csvEngine;
        this.modalManager = uiModules.modalManager;
        this.mappingsUI = uiModules.mappingsUI;
        this.accountMappingsUI = uiModules.accountMappingsUI;
        
        this.tabManager = tabManager;
        this.filterManager = filterManager;
        
        this.onSetupSuccess = callbacks.onSetupSuccess;
        this.onUnlockSuccess = callbacks.onUnlockSuccess;
    }

    /**
     * Attach all application event listeners using categorized delegation
     * 
     * Calls specialized attachment methods for each event category to keep
     * listener logic organized and maintainable. Uses document-level event
     * delegation to handle dynamic content.
     * 
     * EVENT CATEGORIES:
     * - Navigation: Tab switching, back buttons, bottom nav
     * - Auth: Setup and unlock form submissions
     * - Transaction: CRUD operations, FAB menu, CSV import, bulk actions
     * - Category: Budget category CRUD operations
     * - Mapping: Account and description mapping CRUD
     * - Filter: Advanced search panel, filter application/clearing
     * - Search: Real-time transaction search with field selection
     * - Modal: Generic modal close handlers
     * - Summary: Detail panel toggles
     * - Keyboard: Enter key handling for forms
     * 
     * @public
     */
    attachEventListeners() {
        console.log('🔗 Attaching event listeners...');
        
        this.attachNavigationEvents();
        this.attachAuthEvents();
        this.attachTransactionEvents();
        this.attachCategoryEvents();
        this.attachMappingEvents();
        this.attachFilterEvents();
        this.attachSearchEvents();
        this.attachModalEvents();
        this.attachSummaryEvents();
        this.attachKeyboardEvents();
        
        console.log('✅ Event listeners attached');
    }

    /**
     * Navigation and tab switching events
     * @private
     */
    attachNavigationEvents() {
        // Listen for account mappings navigation event
        window.addEventListener('show-account-mappings', async () => {
            await this.accountMappingsUI.renderAccountMappingsPage();
        });
        
        // Listen for description mappings navigation event
        window.addEventListener('show-category-mappings', async () => {
            await this.mappingsUI.renderMappingsTab();
        });
        
        // Account mappings back button
        document.addEventListener('click', async (e) => {
            if (e.target.id === 'account-mappings-back' || e.target.closest('#account-mappings-back')) {
                e.preventDefault();
                const accountMappingsPage = document.getElementById('account-mappings-page');
                if (accountMappingsPage) {
                    accountMappingsPage.classList.add('hidden');
                    accountMappingsPage.classList.remove('active');
                }
                document.querySelector('.bottom-nav')?.classList.remove('hidden');
                await this.tabManager.showTab('settings');
                return;
            }
            
            // Description mappings back button
            if (e.target.id === 'category-mappings-back' || e.target.closest('#category-mappings-back')) {
                e.preventDefault();
                const categoryMappingsPage = document.getElementById('tab-mappings');
                if (categoryMappingsPage) {
                    categoryMappingsPage.classList.add('hidden');
                    categoryMappingsPage.classList.remove('active');
                }
                document.querySelector('.bottom-nav')?.classList.remove('hidden');
                document.querySelectorAll('.fab').forEach(fab => fab.classList.add('hidden'));
                await this.tabManager.showTab('settings');
                return;
            }
        });
        
        // Bottom nav tab switching
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                const tab = navItem.dataset.tab;
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                navItem.classList.add('active');
                
                // Close all FAB menus when switching tabs
                document.querySelectorAll('.fab-menu').forEach(menu => menu.classList.add('hidden'));
                
                this.tabManager.showTab(tab);
            }
        });
    }

    /**
     * Authentication (setup/unlock) events
     * @private
     */
    attachAuthEvents() {
        document.addEventListener('click', async (e) => {
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
        });
    }

    /**
     * Transaction events (FAB, CRUD, selection)
     * @private
     */
    attachTransactionEvents() {
        document.addEventListener('click', async (e) => {
            // Transaction FAB menu toggle
            if (e.target.closest('#fab-add-transaction')) {
                const menu = document.getElementById('fab-transaction-menu');
                if (menu) menu.classList.toggle('hidden');
            }
            
            // Manual entry
            if (e.target.closest('#fab-manual-entry')) {
                document.getElementById('fab-transaction-menu')?.classList.add('hidden');
                await this.transactionUI.openTransactionModal();
            }
            
            // CSV import
            if (e.target.closest('#fab-import-csv')) {
                document.getElementById('fab-transaction-menu')?.classList.add('hidden');
                
                // Show format selection modal first
                const formatId = await this.modalManager.showCSVFormatModal();
                if (!formatId) return; // User cancelled
                
                // Create file input after format selection
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.multiple = true;
                input.onchange = async (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length > 0) {
                        try {
                            let allProcessedData = [];
                            
                            // Process each file with selected format
                            for (const file of files) {
                                const processedData = await this.csvEngine.processTransactionCSV(file, formatId);
                                allProcessedData = allProcessedData.concat(processedData);
                            }
                            
                            if (allProcessedData.length === 0) {
                                alert('No valid transactions found in CSV file(s)');
                                return;
                            }
                            
                            // Show count if multiple files
                            if (files.length > 1) {
                                console.log(`📥 Imported ${allProcessedData.length} transactions from ${files.length} CSV files`);
                            }
                            
                            await this.csvReviewUI.openCSVReviewPage(allProcessedData, this.csvEngine, this);
                        } catch (error) {
                            console.error('CSV import failed:', error);
                            alert('Failed to import CSV: ' + error.message);
                        }
                    }
                };
                input.click();
            }
            
            // Undo
            if (e.target.closest('#fab-undo')) {
                document.getElementById('fab-transaction-menu')?.classList.add('hidden');
                const success = await this.transactionUI.undoLastAdd();
                if (success) {
                    await this.transactionUI.renderTransactionsTab();
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                }
            }
            
            // Redo
            if (e.target.closest('#fab-redo')) {
                document.getElementById('fab-transaction-menu')?.classList.add('hidden');
                const success = await this.transactionUI.redoLastAdd();
                if (success) {
                    await this.transactionUI.renderTransactionsTab();
                    await this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                }
            }
            
            // Transaction item click (edit or select)
            const transactionItem = e.target.closest('.transaction-item[data-id]');
            if (transactionItem) {
                const isMerged = transactionItem.dataset.isMerged === 'true';
                const linkedId = transactionItem.dataset.linkedId;
                
                // In selection mode, only open modal if clicking on transaction content (not checkbox area)
                if (this.transactionUI.selectionMode) {
                    const clickedContent = e.target.closest('.transaction-content');
                    if (clickedContent) {
                        if (isMerged && linkedId) {
                            const transactionId = await this.transactionUI.askWhichTransferToEdit(
                                parseInt(transactionItem.dataset.id),
                                parseInt(linkedId)
                            );
                            if (transactionId) {
                                await this.transactionUI.openTransactionModal(transactionId);
                            }
                        } else {
                            const transactionId = parseInt(transactionItem.dataset.id);
                            await this.transactionUI.openTransactionModal(transactionId);
                        }
                    } else {
                        // Clicking elsewhere in item (like checkbox area) - toggle selection for both transactions
                        const transactionId = parseInt(transactionItem.dataset.id);
                        const checkbox = transactionItem.querySelector('.transaction-checkbox');
                        
                        // Toggle both IDs if merged transfer
                        const idsToToggle = isMerged && linkedId ? [transactionId, parseInt(linkedId)] : [transactionId];
                        
                        const isCurrentlySelected = this.transactionUI.selectedTransactionIds.has(transactionId);
                        idsToToggle.forEach(id => {
                            if (isCurrentlySelected) {
                                this.transactionUI.selectedTransactionIds.delete(id);
                            } else {
                                this.transactionUI.selectedTransactionIds.add(id);
                            }
                        });
                        
                        if (checkbox) checkbox.checked = !isCurrentlySelected;
                        this.transactionUI.updateBulkSelectionUI();
                    }
                } else {
                    // Normal mode - ask which to edit for merged transfers
                    if (isMerged && linkedId) {
                        const transactionId = await this.transactionUI.askWhichTransferToEdit(
                            parseInt(transactionItem.dataset.id),
                            parseInt(linkedId)
                        );
                        if (transactionId) {
                            await this.transactionUI.openTransactionModal(transactionId);
                        }
                    } else {
                        const transactionId = parseInt(transactionItem.dataset.id);
                        await this.transactionUI.openTransactionModal(transactionId);
                    }
                }
            }
            
            // Save transaction
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
            
            // Close FAB menu when clicking outside
            const fabMenu = document.getElementById('fab-transaction-menu');
            if (fabMenu && !fabMenu.classList.contains('hidden')) {
                if (!e.target.closest('#fab-add-transaction') && !e.target.closest('#fab-transaction-menu')) {
                    fabMenu.classList.add('hidden');
                }
            }
        });
    }

    /**
     * Category/budget events (FAB, CRUD)
     * @private
     */
    attachCategoryEvents() {
        document.addEventListener('click', async (e) => {
            // Add category
            if (e.target.closest('#fab-add-category') || e.target.closest('#fab-add-category-inline') || e.target.closest('#fab-add-category-btn')) {
                this.budgetUI.openCategoryModal();
                const fabMenu = document.getElementById('fab-budget-menu');
                if (fabMenu) fabMenu.classList.add('hidden');
            }
            
            // Edit category
            const categoryCard = e.target.closest('.category-card[data-id]');
            if (categoryCard && !e.target.closest('.fab')) {
                const categoryId = parseInt(categoryCard.dataset.id);
                await this.budgetUI.openCategoryModal(categoryId);
            }
            
            // Save category
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
        });
    }

    /**
     * Mapping events (FAB, CRUD, edit)
     * @private
     */
    attachMappingEvents() {
        document.addEventListener('click', async (e) => {
            // FAB menu toggle
            if (e.target.closest('#fab-add-mapping')) {
                this.mappingsUI.toggleMappingFabMenu();
            }
            
            // Manual mapping
            if (e.target.closest('#fab-mapping-manual')) {
                document.getElementById('fab-mapping-menu')?.classList.add('hidden');
                this.mappingsUI.showManualMappingModal();
            }
            
            // Import mappings
            if (e.target.closest('#fab-mapping-import')) {
                document.getElementById('fab-mapping-menu')?.classList.add('hidden');
                const input = document.getElementById('import-mappings-input');
                if (input) input.click();
            }
            
            // Edit mapping
            const mappingItem = e.target.closest('.mapping-item[data-description-original]');
            if (mappingItem) {
                const mappingsTab = document.getElementById('tab-mappings');
                const isVisible = mappingsTab && !mappingsTab.classList.contains('hidden');
                if (isVisible) {
                    const description = mappingItem.dataset.descriptionOriginal;
                    await this.mappingsUI.openMappingForEdit(description);
                }
            }
        });
    }

    /**
     * Filter and search events
     * @private
     */
    attachFilterEvents() {
        document.addEventListener('click', async (e) => {
            // Toggle advanced search panel
            if (e.target.closest('#advanced-search-toggle')) {
                const panel = document.getElementById('advanced-search-panel');
                const transactionsScrollContainer = document.querySelector('.transactions-scroll-container');
                if (panel) {
                    panel.classList.toggle('hidden');
                    if (!panel.classList.contains('hidden')) {
                        await this.transactionUI.populateFilterOptions();
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                        // Disable scrolling on main transactions list when filter is open
                        if (transactionsScrollContainer) {
                            transactionsScrollContainer.classList.add('scroll-disabled');
                        }
                    } else {
                        // Re-enable scrolling when filter is closed
                        if (transactionsScrollContainer) {
                            transactionsScrollContainer.classList.remove('scroll-disabled');
                        }
                    }
                }
            }
            
            // Apply filters button
            if (e.target.closest('#apply-filters')) {
                const applyBtn = document.getElementById('apply-filters');
                if (applyBtn) applyBtn.classList.remove('btn-pulse');
                
                this.filterManager.applyTransactionFilters();
                this.filterManager.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
                
                const panel = document.getElementById('advanced-search-panel');
                const transactionsScrollContainer = document.querySelector('.transactions-scroll-container');
                if (panel) {
                    panel.classList.add('hidden');
                    // Re-enable scrolling
                    if (transactionsScrollContainer) {
                        transactionsScrollContainer.classList.remove('scroll-disabled');
                    }
                }
            }
            
            // Section toggle
            const sectionToggle = e.target.closest('.section-toggle');
            if (sectionToggle) {
                sectionToggle.classList.toggle('collapsed');
                const content = sectionToggle.nextElementSibling;
                if (content && content.classList.contains('advanced-section-content')) {
                    content.classList.toggle('collapsed');
                }
            }
            
            // Clear filters
            if (e.target.closest('#clear-filters')) {
                this.filterManager.clearTransactionFilters();
                this.filterManager.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            }
        });
        
        // Sort field
        const sortField = document.getElementById('sort-field');
        const sortOrder = document.getElementById('sort-order');
        if (sortField) {
            sortField.addEventListener('change', async () => {
                this.transactionUI.sortField = sortField.value;
                this.filterManager.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            });
        }
        if (sortOrder) {
            sortOrder.addEventListener('change', async () => {
                this.transactionUI.sortOrder = sortOrder.value;
                this.filterManager.updateFilterIndicator();
                await this.transactionUI.renderTransactionsTab();
            });
        }
        
        // Filter inputs (search within selects)
        ['filter-category-search', 'filter-account-search', 'filter-description-search'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                const targetId = id.replace('-search', '');
                input.addEventListener('input', () => {
                    this.transactionUI.filterSelectOptions(targetId, id);
                });
            }
        });
        
        // Filter selects - no auto-apply, just track changes
        ['filter-category', 'filter-type', 'filter-account', 'filter-description', 'filter-amount-min', 'filter-amount-max', 'filter-date-start', 'filter-date-end'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const eventType = id.includes('amount') ? 'input' : 'change';
                el.addEventListener(eventType, () => {
                    this.filterManager.updateFilterIndicatorPending();
                });
            }
        });
        
        // Unlinked transfers filter checkbox
        const unlinkedTransfersCheckbox = document.getElementById('filter-unlinked-transfers');
        if (unlinkedTransfersCheckbox) {
            unlinkedTransfersCheckbox.addEventListener('change', () => {
                this.filterManager.updateFilterIndicatorPending();
            });
        }
        
        // Uncategorized filter checkbox
        const uncategorizedCheckbox = document.getElementById('filter-uncategorized');
        if (uncategorizedCheckbox) {
            uncategorizedCheckbox.addEventListener('change', () => {
                this.filterManager.updateFilterIndicatorPending();
            });
        }
    }

    /**
     * Search events
     * @private
     */
    attachSearchEvents() {
        // Main search input
        let searchTimeout;
        const searchInput = document.getElementById('transaction-search');
        if (searchInput) {
            searchInput.addEventListener('input', async (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(async () => {
                    this.transactionUI.searchQuery = e.target.value;
                    this.filterManager.updateFilterIndicator();
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
    }

    /**
     * Modal close events
     * @private
     */
    attachModalEvents() {
        document.addEventListener('click', (e) => {
            const closeModal = e.target.closest('.close-modal');
            if (closeModal) {
                const modalId = closeModal.dataset.modal;
                if (modalId) {
                    const modal = document.getElementById(modalId);
                    if (modal) {
                        modal.classList.add('hidden');
                        document.body.classList.remove('modal-open');
                    }
                }
            }
        });
    }

    /**
     * Summary page events
     * @private
     */
    attachSummaryEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.toggle-details-btn')) {
                const btn = e.target.closest('.toggle-details-btn');
                const sectionId = btn.dataset.section;
                const detailsDiv = document.getElementById(`${sectionId}-details`);
                
                if (detailsDiv) {
                    detailsDiv.classList.toggle('hidden');
                    const icon = btn.querySelector('i');
                    const text = btn.querySelector('.btn-text');
                    
                    if (detailsDiv.classList.contains('hidden')) {
                        if (text) text.textContent = 'Show Details';
                        if (icon) icon.setAttribute('data-lucide', 'chevron-down');
                    } else {
                        if (text) text.textContent = 'Hide Details';
                        if (icon) icon.setAttribute('data-lucide', 'chevron-up');
                    }
                    
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            }
        });
    }

    /**
     * Keyboard events
     * @private
     */
    attachKeyboardEvents() {
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
    }
}
