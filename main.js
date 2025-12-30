/**
 * Main Application Entry Point
 * 
 * APPLICATION LIFECYCLE:
 * 1. Wait for CDN dependencies (Dexie, PapaParse, Lucide)
 * 2. Initialize core modules (SecurityManager, DatabaseManager, CSVEngine)
 * 3. Initialize UI (UIManager with dependency injection)
 * 4. Determine app state (Setup / Locked / Unlocked)
 * 5. Render appropriate UI
 * 
 * STATE FLOW:
 * - Setup: First run, no password set
 * - Locked: Password exists, not authenticated
 * - Unlocked: Authenticated, encryption key in memory
 * 
 * ARCHITECTURE:
 * - Dependency Injection: All modules receive dependencies via constructor
 * - No Circular Dependencies: Strict layered architecture (see module-dependencies.md)
 * - CDN Global Variables: Dexie, Papa (PapaParse), lucide
 * 
 * @module Main
 * @layer 6 - Entry Point (Application Controller)
 */
import { SecurityManager } from './js/core/security.js';
import { DatabaseManager } from './js/core/database.js';
import { CSVEngine } from './js/core/csv-engine.js';
import { UIManager } from './js/ui/ui-manager.js';

/**
 * App - Main application controller
 * 
 * @class App
 */
class App {
    /**
     * Initialize App
     * Waits for CDN dependencies before bootstrapping
     * 
     * @constructor
     */
    constructor() {
        console.log('🚀 App constructor called');
        
        // Wait for CDN dependencies to load
        this.waitForDependencies().then(() => {
            console.log('✅ Dependencies loaded, initializing app...');
            this.security = new SecurityManager();
            this.db = new DatabaseManager();
            this.csvEngine = new CSVEngine(this.security, this.db);
            this.ui = new UIManager(this.security, this.db, this.csvEngine);
            
            this.appState = 'loading';
            
            this.init();
        }).catch(error => {
            console.error('❌ Dependency loading failed:', error);
        });
    }

    /**
     * Wait for CDN dependencies to load
     * 
     * Polls for Dexie, Papa (PapaParse), and Lucide global variables.
     * Retries for up to 5 seconds (50 attempts * 100ms).
     * 
     * @returns {Promise<void>} Resolves when dependencies are ready or timeout
     * @private
     */
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

    /**
     * Initialize application
     * 
     * WORKFLOW:
     * 1. Check app state (Setup / Locked / Unlocked)
     * 2. Set up state transition callbacks
     * 3. Attach UI event listeners
     * 4. Render initial UI
     * 
     * @returns {Promise<void>}
     * @private
     */
    async init() {
        console.log('📱 Initializing app...');
        
        try {
            await this.checkAppState();
            console.log('📊 App state:', this.appState);
            
            // Set up callbacks for state transitions
            this.ui.onSetupSuccess = () => this.onSetupSuccess();
            this.ui.onUnlockSuccess = () => this.onUnlockSuccess();
            
            this.ui.attachEventListeners();
            this.render();
            
            console.log('✅ App initialized successfully');
        } catch (error) {
            console.error('❌ App initialization failed:', error);
        }
    }

    /**
     * Determine current application state
     * 
     * STATE DETERMINATION:
     * - If no password hash exists → Setup (first run)
     * - If password hash exists → Locked (needs authentication)
     * 
     * @returns {Promise<void>} Sets this.appState to 'setup' or 'locked'
     * @private
     */
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

    /**
     * Handle successful password setup
     * 
     * STATE TRANSITION: Setup → Unlocked
     * Triggered after user creates password and encryption is initialized.
     * 
     * @returns {Promise<void>}
     * @private
     */
    async onSetupSuccess() {
        console.log('🎉 Setup successful, transitioning to unlocked state');
        this.appState = 'unlocked';
        
        // Preload transactions in background for faster tab switching
        this.ui.preloadTransactions().catch(err => {
            console.warn('⚠️ Transaction preload failed:', err);
        });
        
        this.render();
    }

    /**
     * Handle successful password unlock
     * 
     * STATE TRANSITION: Locked → Unlocked
     * Triggered after user enters correct password and encryption is initialized.
     * 
     * @returns {Promise<void>}
     * @private
     */
    async onUnlockSuccess() {
        console.log('🎉 Unlock successful, transitioning to unlocked state');
        this.appState = 'unlocked';
        
        // Preload transactions in background for faster tab switching
        this.ui.preloadTransactions().catch(err => {
            console.warn('⚠️ Transaction preload failed:', err);
        });
        
        this.render();
    }

    /**
     * Render current application state
     * 
     * SCREEN VISIBILITY:
     * - Setup state → Show setup-screen
     * - Locked state → Show locked-screen
     * - Unlocked state → Show dashboard-screen
     * 
     * Uses .hidden class to control visibility.
     * 
     * @returns {void}
     * @private
     */
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
                this.ui.showTab(this.ui.currentTab);
            }
        }
        
        // Reinitialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
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

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        if (confirm('New version available. Reload now?')) {
                            window.location.reload();
                        }
                    }
                });
            });
        })
        .catch(err => console.error('Service Worker registration failed:', err));
}

// Optimized Lucide icon loading - only process specific container
window.loadIcons = function(container) {
    if (typeof lucide !== 'undefined') {
        if (container) {
            // Only process icons in specific container
            lucide.createIcons({ icons: lucide.icons, nameAttr: 'data-lucide', attrs: {}, container: container });
        } else {
            // Fallback to full document scan
            lucide.createIcons();
        }
    }
};

