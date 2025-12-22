class App {
    constructor() {
        this.ui = new UI();
        this.db = new Database();
        this.currentTab = 'budget';
        this.attachEventListeners();
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