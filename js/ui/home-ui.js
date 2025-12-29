// HomeUI - Handles home tab rendering
export class HomeUI {
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

    async renderHomeTab() {
        console.log('🏠 Rendering home tab');
        const container = document.getElementById('home-content');
        if (container) {
            // Calculate notification count
            const notificationCount = await this.getNotificationCount();
            const badgeHTML = notificationCount > 0 
                ? `<span class="notification-badge">${notificationCount}</span>` 
                : '';

            container.innerHTML = `
                <div class="home-container">
                    <div class="home-header">
                        <button class="btn-icon" id="notifications-btn">
                            <i data-lucide="alert-circle"></i>
                            ${badgeHTML}
                        </button>
                    </div>
                    
                    <div class="home-content-center">
                        <div class="home-logo">
                            <i data-lucide="shield-check" class="home-logo-icon"></i>
                            <h1 class="home-app-name">Vault Budget</h1>
                            <p class="home-tagline">Secure. Private. Yours.</p>
                        </div>
                    </div>
                </div>
            `;

            // Initialize Lucide icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            // Attach event listeners
            this.attachHomeEventListeners();
        }
    }

    attachHomeEventListeners() {
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', async () => {
                console.log('🔔 Notifications clicked');
                await this.showNotificationsModal();
            });
        }
    }

    async getNotificationCount() {
        const notifications = await this.getNotifications();
        return notifications.unmappedAccountsCount + 
               notifications.unlinkedTransfersCount + 
               notifications.uncategorizedCount + 
               (notifications.budgetUnbalanced ? 1 : 0);
    }

    async getNotifications() {
        const notifications = {
            unmappedAccountsCount: 0,
            unmappedAccounts: [],
            unlinkedTransfersCount: 0,
            uncategorizedCount: 0,
            budgetUnbalanced: false,
            budgetDetails: null
        };

        try {
            // Get all transactions
            const transactions = await this.db.getAllTransactions();

            // Collect unmapped account numbers
            const accountNumbers = new Set();
            for (const tx of transactions) {
                if (tx.encrypted_account) {
                    const account = await this.security.decrypt(tx.encrypted_account);
                    if (account && account.trim()) {
                        accountNumbers.add(account);
                    }
                }
            }
            
            // Get account mappings and check which ones have actual names (not empty)
            const accountMappings = await this.db.getAllMappingsAccounts();
            const mappedAccountsWithNames = new Set();
            
            for (const mapping of accountMappings) {
                if (mapping.encrypted_name) {
                    const name = await this.security.decrypt(mapping.encrypted_name);
                    if (name && name.trim()) {
                        mappedAccountsWithNames.add(mapping.account_number);
                    }
                }
            }
            
            notifications.unmappedAccounts = [...accountNumbers].filter(
                acc => !mappedAccountsWithNames.has(acc)
            );
            notifications.unmappedAccountsCount = notifications.unmappedAccounts.length;

            // Count unlinked transfers and uncategorized transactions
            notifications.unlinkedTransfersCount = 0;
            notifications.uncategorizedCount = 0;
            
            for (const tx of transactions) {
                if (!tx.categoryId) {
                    // Check if this has the encrypted_linkedTransactionId field
                    if (tx.encrypted_linkedTransactionId !== undefined) {
                        // This is a Transfer - check if it's linked
                        const linkedId = tx.encrypted_linkedTransactionId 
                            ? await this.security.decrypt(tx.encrypted_linkedTransactionId)
                            : null;
                        if (!linkedId) {
                            notifications.unlinkedTransfersCount++;
                        }
                    } else {
                        // No field means uncategorized
                        notifications.uncategorizedCount++;
                    }
                }
            }

            // Check budget balance for current month
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            let totalIncome = 0;
            let totalExpenses = 0;
            
            const categories = await this.db.getAllCategories();
            
            for (const tx of transactions) {
                if (!tx.categoryId) continue;
                
                const dateStr = await this.security.decrypt(tx.encrypted_date);
                if (!dateStr || !dateStr.startsWith(currentMonth)) continue;
                
                const amountStr = await this.security.decrypt(tx.encrypted_amount);
                const amount = parseFloat(amountStr);
                
                const category = categories.find(c => c.id === tx.categoryId);
                if (!category) continue;
                
                if (category.type === 'Income') {
                    totalIncome += Math.abs(amount);
                } else if (category.type === 'Expense') {
                    totalExpenses += Math.abs(amount);
                }
            }
            
            const difference = Math.abs(totalIncome - totalExpenses);
            notifications.budgetUnbalanced = difference > 0.01; // Tolerance for floating point
            notifications.budgetDetails = {
                income: totalIncome,
                expenses: totalExpenses,
                difference: difference
            };

        } catch (error) {
            console.error('Error calculating notifications:', error);
        }

        return notifications;
    }

    async showNotificationsModal() {
        const notifications = await this.getNotifications();
        
        const items = [];
        
        if (notifications.unmappedAccountsCount > 0) {
            items.push(`
                <div class="notification-item">
                    <i data-lucide="credit-card" class="notification-icon"></i>
                    <div class="notification-content">
                        <div class="notification-title">Unmapped Accounts</div>
                        <div class="notification-description">${notifications.unmappedAccountsCount} account${notifications.unmappedAccountsCount !== 1 ? 's' : ''} need${notifications.unmappedAccountsCount === 1 ? 's' : ''} a friendly name</div>
                    </div>
                </div>
            `);
        }
        
        if (notifications.unlinkedTransfersCount > 0) {
            items.push(`
                <div class="notification-item">
                    <i data-lucide="arrow-left-right" class="notification-icon"></i>
                    <div class="notification-content">
                        <div class="notification-title">Unlinked Transfers</div>
                        <div class="notification-description">${notifications.unlinkedTransfersCount} transfer${notifications.unlinkedTransfersCount !== 1 ? 's' : ''} need${notifications.unlinkedTransfersCount === 1 ? 's' : ''} to be linked</div>
                    </div>
                </div>
            `);
        }
        
        if (notifications.uncategorizedCount > 0) {
            items.push(`
                <div class="notification-item">
                    <i data-lucide="tag" class="notification-icon"></i>
                    <div class="notification-content">
                        <div class="notification-title">Uncategorized Transactions</div>
                        <div class="notification-description">${notifications.uncategorizedCount} transaction${notifications.uncategorizedCount !== 1 ? 's' : ''} need${notifications.uncategorizedCount === 1 ? 's' : ''} a category</div>
                    </div>
                </div>
            `);
        }
        
        if (notifications.uncategorizedCount > 0) {
            items.push(`
                <div class="notification-item">
                    <i data-lucide="tag" class="notification-icon"></i>
                    <div class="notification-content">
                        <div class="notification-title">Uncategorized Transactions</div>
                        <div class="notification-description">${notifications.uncategorizedCount} transaction${notifications.uncategorizedCount !== 1 ? 's' : ''} need${notifications.uncategorizedCount === 1 ? 's' : ''} a category</div>
                    </div>
                </div>
            `);
        }
        
        if (notifications.uncategorizedCount > 0) {
            items.push(`
                <div class="notification-item">
                    <i data-lucide="tag" class="notification-icon"></i>
                    <div class="notification-content">
                        <div class="notification-title">Uncategorized Transactions</div>
                        <div class="notification-description">${notifications.uncategorizedCount} transaction${notifications.uncategorizedCount !== 1 ? 's' : ''} need${notifications.uncategorizedCount === 1 ? 's' : ''} a category</div>
                    </div>
                </div>
            `);
        }
        
        if (notifications.budgetUnbalanced) {
            const { income, expenses, difference } = notifications.budgetDetails;
            const type = income > expenses ? 'surplus' : 'deficit';
            items.push(`
                <div class="notification-item">
                    <i data-lucide="trending-${income > expenses ? 'up' : 'down'}" class="notification-icon"></i>
                    <div class="notification-content">
                        <div class="notification-title">Budget Not Balanced</div>
                        <div class="notification-description">Current month has a $${difference.toFixed(2)} ${type} (Income: $${income.toFixed(2)}, Expenses: $${expenses.toFixed(2)})</div>
                    </div>
                </div>
            `);
        }
        
        const modalHTML = `
            <div class="modal-overlay" id="notifications-modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>Notifications</h2>
                    </div>
                    <div class="modal-body">
                        ${items.length > 0 
                            ? `<div class="notifications-list">${items.join('')}</div>`
                            : '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">All caught up! No notifications at this time.</p>'
                        }
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-primary" id="notifications-close">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('notifications-modal');
        
        // Initialize Lucide icons in modal
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Close button
        document.getElementById('notifications-close').addEventListener('click', () => {
            modal.remove();
        });
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}
