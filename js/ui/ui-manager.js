/**
 * UIManager - Central coordinator for all UI modules and application state
 * 
 * Acts as the main orchestrator for the application's user interface, managing
 * tab navigation, event coordination, data filtering, and UI module lifecycles.
 * Delegates specialized responsibilities to dedicated managers (TabManager,
 * EventCoordinator, FilterManager) for better separation of concerns.
 * 
 * RESPONSIBILITIES:
 * - Initialize and coordinate all UI modules (Auth, Transactions, Budget, etc.)
 * - Manage application state transitions (Setup → Locked → Unlocked)
 * - Delegate tab navigation to TabManager
 * - Delegate event handling to EventCoordinator
 * - Delegate filtering to FilterManager
 * - Preload and cache transaction data for performance
 * - Expose necessary UI modules globally for onclick handlers
 * 
 * DEPENDENCIES:
 * - SecurityManager: Encryption/decryption operations
 * - DatabaseManager: CRUD operations via Dexie
 * - CSVEngine: CSV import/export functionality
 * 
 * STATE FLOW:
 * 1. Setup: User creates password → onSetupSuccess callback → unlock
 * 2. Locked: User enters password → onUnlockSuccess callback → render home
 * 3. Unlocked: Full UI access with delegated responsibilities
 * 
 * @class UIManager
 * @module UI/Core
 * @layer 5 - UI Components
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
    /**
     * Creates UIManager instance and initializes all UI modules and specialized managers
     * 
     * Sets up parent references and callbacks between modules for proper communication.
     * Exposes budgetUI globally for inline onclick handlers in rendered HTML.
     * 
     * @param {SecurityManager} security - Handles encryption/decryption operations
     * @param {DatabaseManager} db - Manages IndexedDB operations via Dexie
     * @param {CSVEngine} csvEngine - Processes CSV imports/exports
     */
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
     * Preload and decrypt all transactions from database with caching
     * 
     * Delegates to TransactionPreloader for efficient batch decryption, then
     * caches results in TransactionUI to avoid redundant decryption operations
     * during rendering. Cache includes timestamp for potential invalidation.
     * 
     * PERFORMANCE: Significantly reduces render time by decrypting once
     * instead of on-demand per transaction.
     * 
     * @async
     * @returns {Promise<Array<Object>>} Array of decrypted transaction objects
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
     * Initialize EventCoordinator and attach all application event listeners
     * 
     * Creates EventCoordinator instance with references to all UI modules,
     * managers, and state callbacks. EventCoordinator handles all click,
     * input, and keyboard events across the application.
     * 
     * DELEGATION PATTERN: Centralizes event management to avoid scattered
     * listeners and simplify debugging.
     * 
     * @see EventCoordinator for detailed event handling
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
     * Show specific tab and update navigation state
     * 
     * Delegates to TabManager for tab switching, visibility management,
     * FAB control, and content rendering.
     * 
     * @param {string} tabName - Tab identifier (home, transactions, budget, summary, mappings, settings)
     * @see TabManager.showTab
     */
    showTab(tabName) {
        this.tabManager.showTab(tabName);
    }

    /**
     * Apply transaction filters and re-render transaction list
     * 
     * Delegates to FilterManager to process current filter values and
     * update TransactionUI with filtered results.
     * 
     * @see FilterManager.applyTransactionFilters
     */
    applyTransactionFilters() {
        this.filterManager.applyTransactionFilters();
    }

    /**
     * Clear all transaction filters and reset to default view
     * 
     * Delegates to FilterManager to reset filter inputs and update UI.
     * 
     * @see FilterManager.clearTransactionFilters
     */
    clearTransactionFilters() {
        this.filterManager.clearTransactionFilters();
    }

    /**
     * Update filter indicator badge to reflect active filters
     * 
     * Delegates to FilterManager to count and display active filters.
     * 
     * @see FilterManager.updateFilterIndicator
     */
    updateFilterIndicator() {
        this.filterManager.updateFilterIndicator();
    }
    
    /**
     * Update filter indicator for pending (unapplied) filter changes
     * 
     * Shows visual feedback when filter inputs change but haven't been applied.
     * 
     * @see FilterManager.updateFilterIndicatorPending
     */
    updateFilterIndicatorPending() {
        this.filterManager.updateFilterIndicatorPending();
    }
}
