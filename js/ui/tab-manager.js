/**
 * TabManager - Navigation controller for bottom nav tab system
 * 
 * Manages tab switching logic, visibility states, FAB (Floating Action Button)
 * control, and content rendering coordination. Uses the `.active` class pattern
 * for tab visibility management.
 * 
 * RESPONSIBILITIES:
 * - Track current active tab state
 * - Update bottom navigation highlighting
 * - Control tab content visibility (.active/.hidden classes)
 * - Show/hide FABs based on active tab
 * - Control summary cards visibility (budget tab only)
 * - Delegate content rendering to appropriate UI modules
 * 
 * DEPENDENCIES:
 * - HomeUI: Home tab rendering
 * - TransactionUI: Transaction list and CRUD
 * - BudgetUI: Budget categories and summary
 * - SummaryUI: Charts and analytics
 * - MappingsUI: Description mappings
 * - SettingsUI: Settings and exports
 * 
 * ACTIVE CLASS PATTERN:
 * - `.active` class indicates visible/selected state
 * - Always remove `.active` from siblings before adding to target
 * - Use with `.hidden` class for complete visibility control
 * 
 * TAB STRUCTURE:
 * - home: Dashboard with quick stats
 * - transactions: Transaction list with FAB
 * - budget: Category management with summary cards
 * - summary: Analytics and charts (planned)
 * - mappings: Description mapping rules with FAB
 * - settings: App settings and data export
 * 
 * @class TabManager
 * @module UI/Navigation
 * @layer 5 - UI Components
 */

export class TabManager {
    /**
     * Creates TabManager instance and initializes tab state
     * 
     * @param {Object} uiModules - Collection of UI module instances for content rendering
     * @param {HomeUI} uiModules.homeUI - Home tab UI
     * @param {TransactionUI} uiModules.transactionUI - Transaction UI
     * @param {BudgetUI} uiModules.budgetUI - Budget UI
     * @param {SummaryUI} uiModules.summaryUI - Summary UI
     * @param {MappingsUI} uiModules.mappingsUI - Mappings UI
     * @param {SettingsUI} uiModules.settingsUI - Settings UI
     */
    constructor(uiModules) {
        this.currentTab = 'home';
        this.homeUI = uiModules.homeUI;
        this.transactionUI = uiModules.transactionUI;
        this.budgetUI = uiModules.budgetUI;
        this.summaryUI = uiModules.summaryUI;
        this.mappingsUI = uiModules.mappingsUI;
        this.settingsUI = uiModules.settingsUI;
    }

    /**
     * Show specific tab and orchestrate all visibility updates
     * 
     * Central method that coordinates tab switching by updating navigation,
     * content visibility, FAB states, and triggering content rendering.
     * Refreshes Lucide icons after DOM changes.
     * 
     * STATE UPDATES:
     * 1. Set currentTab property for tracking
     * 2. Update bottom nav highlighting (.active class)
     * 3. Show/hide tab content (.active/.hidden classes)
     * 4. Show/hide FABs based on tab (transactions/mappings only)
     * 5. Show/hide summary cards (budget tab only)
     * 6. Delegate content rendering to appropriate UI module
     * 7. Reinitialize Lucide icons for new content
     * 
     * @public
     * @param {string} tabName - Tab identifier (home|transactions|budget|summary|mappings|settings)
     */
    showTab(tabName) {
        console.log('📱 Showing tab:', tabName);
        this.currentTab = tabName;
        
        this.updateNavigation(tabName);
        this.updateTabVisibility(tabName);
        this.updateFABVisibility(tabName);
        this.updateSummaryCardsVisibility(tabName);
        this.renderTabContent(tabName);
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /**
     * Update bottom navigation highlighting with .active class
     * 
     * Removes .active from all nav items, then adds to selected tab.
     * Follows active class pattern for consistent state management.
     * 
     * @private
     * @param {string} tabName - Tab to highlight
     */
    updateNavigation(tabName) {
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.tab === tabName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * Update tab content visibility with .active and .hidden classes
     * 
     * Hides all tab content panels, then shows only the selected tab.
     * Uses both .active (for styling) and .hidden (for display) classes.
     * 
     * DOM PATTERN:
     * - All tab content divs have .tab-content class
     * - Tab IDs follow pattern: tab-{tabName}
     * 
     * @private
     * @param {string} tabName - Tab to display
     */
    updateTabVisibility(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
            tab.classList.add('hidden');
        });
        
        // Show selected tab
        const targetTab = document.getElementById(`tab-${tabName}`);
        if (targetTab) {
            targetTab.classList.add('active');
            targetTab.classList.remove('hidden');
        }
    }

    /**
     * Control FAB (Floating Action Button) visibility per tab
     * 
     * Shows transaction FAB only on transactions tab.
     * Shows mappings FAB only on mappings tab.
     * Hides all FABs on other tabs.
     * 
     * FAB IDS:
     * - #fab-add-transaction: Transactions tab only
     * - #fab-add-mapping: Mappings tab only
     * 
     * @private
     * @param {string} tabName - Current active tab
     */
    updateFABVisibility(tabName) {
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
    }

    /**
     * Control summary cards visibility (budget tab only)
     * 
     * Shows the fixed summary cards section only on budget tab to display
     * total budgeted, spent, and remaining amounts. Hidden on all other tabs.
     * 
     * @private
     * @param {string} tabName - Current active tab
     */
    updateSummaryCardsVisibility(tabName) {
        const summarySection = document.querySelector('.summary-section-fixed');
        if (summarySection) {
            if (tabName === 'budget') {
                summarySection.classList.remove('hidden');
            } else {
                summarySection.classList.add('hidden');
            }
        }
    }

    /**
     * Delegate content rendering to appropriate UI module
     * 
     * Calls the render method of the UI module responsible for the active tab.
     * Each UI module handles its own content generation and DOM updates.
     * 
     * TAB ROUTING:
     * - home → HomeUI.renderHomeTab()
     * - transactions → TransactionUI.renderTransactionsTab()
     * - budget → BudgetUI.renderBudgetTab() + summary cards update
     * - summary → SummaryUI.renderSummaryTab()
     * - mappings → MappingsUI.renderMappingsTab()
     * - settings → SettingsUI.renderSettingsTab()
     * 
     * @private
     * @param {string} tabName - Tab requiring content rendering
     */
    renderTabContent(tabName) {
        switch (tabName) {
            case 'home':
                this.homeUI.renderHomeTab();
                break;
            case 'transactions':
                this.transactionUI.renderTransactionsTab();
                break;
            case 'budget':
                this.budgetUI.renderBudgetTab(async () => await this.budgetUI.updateSummaryCards());
                break;
            case 'summary':
                this.summaryUI.renderSummaryTab();
                break;
            case 'mappings':
                this.mappingsUI.renderMappingsTab();
                break;
            case 'settings':
                this.settingsUI.renderSettingsTab();
                break;
        }
    }
}
