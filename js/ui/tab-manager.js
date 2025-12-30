/**
 * Tab Manager - Navigation and tab switching logic
 * Extracts tab-related functionality from UIManager
 * Manages active tab state, FAB visibility, and content rendering
 * 
 * @module TabManager
 */

export class TabManager {
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
     * Show a specific tab and update navigation state
     * @param {string} tabName - The tab to show (home, transactions, budget, etc.)
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
     * Update navigation highlighting
     * @private
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
     * Update tab visibility
     * @private
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
     * Update FAB visibility based on active tab
     * @private
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
     * Update summary cards visibility
     * @private
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
     * Render the content for the active tab
     * @private
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
