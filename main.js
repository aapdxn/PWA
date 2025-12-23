// Main Application Entry Point - Modular ES6 Version
// Uses global CDN variables: Dexie, Papa, lucide
import { SecurityManager } from './js/core/security.js';
import { DatabaseManager } from './js/core/database.js';
import { CSVEngine } from './js/core/csv-engine.js';
import { UIManager } from './js/ui/ui-manager.js';

class App {
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

    async onSetupSuccess() {
        console.log('🎉 Setup successful, transitioning to unlocked state');
        this.appState = 'unlocked';
        this.render();
    }

    async onUnlockSuccess() {
        console.log('🎉 Unlock successful, transitioning to unlocked state');
        this.appState = 'unlocked';
        this.render();
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

