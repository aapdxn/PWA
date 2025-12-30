/**
 * UI Manager - Central coordinator for all UI modules
 * Refactored to use specialized managers for better separation of concerns
 * 
 * @module UIManager
 */

import { AuthUI } from './auth-ui.js';
import { HomeUI } from './home-ui.js';
import { TransactionUI } from './transaction-ui.js';
import { BudgetUI } from './budget-ui.js';
import { SummaryUI } from './summary-ui.js';
import { MappingsUI } from './mappings-ui.js';
import { SettingsUI } from './settings-ui.js';
import { ModalManager } from './modal-manager.js';
import { CSVReviewUI } from './csv-review-ui.js';
import { AccountMappingsUI } from './account-mappings-ui.js';
import { TransactionPreloader } from '../core/transaction-preloader.js';
import { TabManager } from './tab-manager.js';
import { FilterManager } from './filter-manager.js';
import { EventCoordinator } from './event-coordinator.js';

export class UIManager {
    constructor(security, db, csvEngine) {
        this.security = security;
        this.db = db;
        this.csvEngine = csvEngine;
        
        // Initialize UI modules
        this.authUI = new AuthUI(security, db);
        this.homeUI = new HomeUI(security, db);
        this.modalManager = new ModalManager(security, db);
        this.accountMappingsUI = new AccountMappingsUI(security, db, this.modalManager);
        this.transactionUI = new TransactionUI(security, db, this.accountMappingsUI);
        this.budgetUI = new BudgetUI(security, db);
        this.summaryUI = new SummaryUI(security, db);
        this.csvReviewUI = new CSVReviewUI(security, db, this.accountMappingsUI);
        this.mappingsUI = new MappingsUI(security, db, csvEngine, this.modalManager);
        this.settingsUI = new SettingsUI(security, db);
        
        // Initialize specialized managers
        this.preloader = new TransactionPreloader(db, security);
        this.tabManager = new TabManager({
            homeUI: this.homeUI,
            transactionUI: this.transactionUI,
            budgetUI: this.budgetUI,
            summaryUI: this.summaryUI,
            mappingsUI: this.mappingsUI,
            settingsUI: this.settingsUI
        });
        this.filterManager = new FilterManager(this.transactionUI);
        
        // Expose budgetUI globally for onclick handlers
        window.budgetUI = this.budgetUI;
        
        // Set parent references
        this.transactionUI.uiManager = this;
        this.csvReviewUI.onImportSuccess = async () => {
            await this.transactionUI.renderTransactionsTab();
        };
        this.mappingsUI.showTabCallback = (tab) => this.showTab(tab);
        
        // Callbacks for app state changes
        this.onSetupSuccess = null;
        this.onUnlockSuccess = null;
    }
    
    /**
     * Current tab getter (delegates to TabManager)
     */
    get currentTab() {
        return this.tabManager.currentTab;
    }
    
    /**
     * Current tab setter (delegates to TabManager)
     */
    set currentTab(value) {
        this.tabManager.currentTab = value;
    }
    
    /**
     * Preload transactions (delegates to TransactionPreloader with caching)
     */
    async preloadTransactions() {
        console.log('⚡ Preloading transactions...');
        const decryptedTransactions = await this.preloader.preloadTransactions();
        
        // Cache in TransactionUI for performance
        this.transactionUI.cachedDecryptedTransactions = decryptedTransactions;
        this.transactionUI.cacheTimestamp = Date.now();
        
        console.log(`✅ Preloaded ${decryptedTransactions.length} transactions`);
        return decryptedTransactions;
    }
    
    /**
     * Attach all event listeners (delegates to EventCoordinator)
     */
    attachEventListeners() {
        const uiModules = {
            authUI: this.authUI,
            transactionUI: this.transactionUI,
            budgetUI: this.budgetUI,
            csvReviewUI: this.csvReviewUI,
            csvEngine: this.csvEngine,
            modalManager: this.modalManager,
            mappingsUI: this.mappingsUI,
            accountMappingsUI: this.accountMappingsUI
        };
        
        const callbacks = {
            onSetupSuccess: this.onSetupSuccess,
            onUnlockSuccess: this.onUnlockSuccess
        };
        
        this.eventCoordinator = new EventCoordinator(uiModules, this.tabManager, this.filterManager, callbacks);
        this.eventCoordinator.attachEventListeners();
    }

    /**
     * Show tab (delegates to TabManager)
     */
    showTab(tabName) {
        this.tabManager.showTab(tabName);
    }

    /**
     * Apply transaction filters (delegates to FilterManager)
     */
    applyTransactionFilters() {
        this.filterManager.applyTransactionFilters();
    }

    /**
     * Clear transaction filters (delegates to FilterManager)
     */
    clearTransactionFilters() {
        this.filterManager.clearTransactionFilters();
    }

    /**
     * Update filter indicator (delegates to FilterManager)
     */
    updateFilterIndicator() {
        this.filterManager.updateFilterIndicator();
    }
    
    /**
     * Update filter indicator pending (delegates to FilterManager)
     */
    updateFilterIndicatorPending() {
        this.filterManager.updateFilterIndicatorPending();
    }
}
