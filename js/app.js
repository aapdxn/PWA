class App {
    constructor() {
        this.security = new SecurityManager();
        this.db = new DatabaseManager();
        this.ui = new UIManager(this.security, this.db);
        this.currentTab = 'transactions';
        this.appState = 'loading';
        this.serviceWorkerRegistration = null;
        
        this.init();
    }

    async init() {
        await this.checkAppState();
        this.attachEventListeners();
        this.registerServiceWorker();
        this.render();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('[App] Service Worker registered:', registration);
                    this.serviceWorkerRegistration = registration;
                    
                    // Check for updates every 60 seconds
                    setInterval(() => {
                        registration.update();
                    }, 60000);
                    
                    // Handle updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New service worker available
                                this.showUpdatePrompt();
                            }
                        });
                    });
                })
                .catch((error) => {
                    console.error('[App] Service Worker registration failed:', error);
                });
            
            // Handle controller change (new SW activated)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        }
    }

    showUpdatePrompt() {
        const updateBanner = document.createElement('div');
        updateBanner.className = 'update-banner';
        updateBanner.innerHTML = `
            <div class="update-content">
                <span>New version available!</span>
                <button class="btn-update" id="updateApp">Update Now</button>
            </div>
        `;
        document.body.appendChild(updateBanner);
        
        document.getElementById('updateApp').addEventListener('click', () => {
            if (this.serviceWorkerRegistration && this.serviceWorkerRegistration.waiting) {
                this.serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        });
    }

    attachEventListeners() {
        // Month navigation
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="prev-month"]')) {
                this.ui.activeMonth.setMonth(this.ui.activeMonth.getMonth() - 1);
                this.render();
            }
            if (e.target.closest('[data-action="next-month"]')) {
                this.ui.activeMonth.setMonth(this.ui.activeMonth.getMonth() + 1);
                this.render();
            }
            if (e.target.closest('[data-action="today"]')) {
                this.ui.initializeMonthPicker();
                this.render();
            }
        });

        // CSV Import
        document.addEventListener('click', async (e) => {
            if (e.target.closest('[data-action="import-csv"]')) {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.multiple = true;
                input.onchange = async (evt) => {
                    const files = Array.from(evt.target.files);
                    const results = await this.ui.csvImporter.processCSVFiles(files);
                    const reviewHTML = await this.ui.renderCSVReviewScreen(results);
                    document.getElementById('app').innerHTML = reviewHTML;
                    lucide.createIcons();
                };
                input.click();
            }

            if (e.target.closest('[data-action="confirm-import"]')) {
                const reviewItems = document.querySelectorAll('.review-item');
                const reviewedData = [];
                
                reviewItems.forEach((item, index) => {
                    const include = item.querySelector('[data-field="include"]').checked;
                    if (!include) {
                        reviewedData.push({ skip: true });
                        return;
                    }
                    
                    const categoryId = item.querySelector('[data-field="category"]').value;
                    const saveMapping = item.querySelector('[data-field="saveMapping"]').checked;
                    
                    reviewedData.push({
                        row: this.ui.csvImporter.mappingSuggestions[index].row,
                        categoryId: categoryId ? parseInt(categoryId) : null,
                        saveAsMapping: saveMapping,
                        skip: false
                    });
                });
                
                await this.ui.csvImporter.saveTransactions(reviewedData, true);
                this.render();
            }

            if (e.target.closest('[data-action="cancel-import"]')) {
                this.render();
            }
        });

        // Mapping management
        document.addEventListener('click', async (e) => {
            if (e.target.closest('[data-action="delete-account-mapping"]')) {
                const key = e.target.closest('[data-action="delete-account-mapping"]').dataset.key;
                await this.db.deleteAccountMapping(key);
                this.render();
            }

            if (e.target.closest('[data-action="delete-description-mapping"]')) {
                const key = e.target.closest('[data-action="delete-description-mapping"]').dataset.key;
                await this.db.deleteDescriptionMapping(key);
                this.render();
            }
        });

        // Bottom navigation
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                navItem.classList.add('active');
                this.currentTab = navItem.dataset.tab;
                this.render();
            }
        });
    }

    async render() {
        let content = '';
        
        switch(this.currentTab) {
            case 'budget':
                content = await this.ui.renderBudgetView();
                break;
            case 'mappings':
                content = await this.ui.renderMappingsView();
                break;
            // ...existing cases...
        }
        
        document.getElementById('app').innerHTML = `
            ${this.ui.renderAddBar()}
            ${content}
            ${this.ui.renderBottomNavigation()}
        `;
        
        lucide.createIcons();
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App());
} else {
    new App();
}