/**
 * HomeUI - Home/Dashboard tab UI with notifications
 * 
 * RESPONSIBILITIES:
 * - Render home tab with app logo and notification bell
 * - Calculate notification counts (unmapped accounts, unlinked transfers, etc.)
 * - Display notifications modal with actionable items
 * - Check budget balance for current month
 * 
 * STATE REQUIREMENTS:
 * - Requires Unlocked state (decrypts transactions for notification counts)
 * - Auto-mapping resolution for uncategorized count
 * 
 * NOTIFICATIONS:
 * - Unmapped Accounts: Accounts without friendly names
 * - Unlinked Transfers: Transfers without linked transaction
 * - Uncategorized: Transactions without category (after auto-mapping)
 * - Budget Unbalanced: Income ≠ Expenses for current month
 * 
 * INTEGRATION:
 * - Shown in Transactions tab (Home is alias for Transactions)
 * - Notification badge on bell icon
 * 
 * @class HomeUI
 * @module UI/Transaction
 * @layer 5 - UI Components
 */
export class HomeUI {
    /**
     * Create HomeUI
     * @param {SecurityManager} security - For decrypting transaction data
     * @param {DatabaseManager} db - For fetching transactions/mappings
     */
    constructor(security, db) {
        this.security = security;
        this.db = db;
    }

    /**
     * Render home tab with notification bell
     * 
     * DISPLAY:
     * - App logo (shield-check icon)
     * - App name and tagline
     * - Notification bell (top-right)
     * - Notification badge if count > 0
     * 
     * LISTENERS: Attaches click handler for notifications modal
     */
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

    /**
     * Attach event listeners for home tab
     * 
     * LISTENERS:
     * - Notifications button: Opens notifications modal
     * 
     * TIMING: Called after renderHomeTab inserts HTML
     */
    attachHomeEventListeners() {
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', async () => {
                console.log('🔔 Notifications clicked');
                await this.showNotificationsModal();
            });
        }
    }

    /**
     * Get total notification count for badge display
     * @returns {Promise<number>} Total notification count
     */
    async getNotificationCount() {
        const notifications = await this.getNotifications();
        return notifications.unmappedAccountsCount + 
               notifications.unlinkedTransfersCount + 
               notifications.uncategorizedCount + 
               (notifications.budgetUnbalanced ? 1 : 0);
    }

    /**
     * Calculate all notification counts and details
     * 
     * @returns {Promise<Object>} Notification data
     * 
     * CALCULATIONS:
     * - Unmapped Accounts: Accounts without encrypted_name in mappings
     * - Unlinked Transfers: Transfers without linkedTransactionId
     * - Uncategorized: Transactions without categoryId (after auto-mapping resolution)
     * - Budget Unbalanced: |Income - Expenses| > $0.01 for current month
     * 
     * STATE: Requires Unlocked (decrypts all transactions)
     * PERFORMANCE: May be slow for 150+ transactions
     */
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
            
            // Get categories and mappings for auto-category resolution
            const categories = await this.db.getAllCategories();
            const mappings = await this.db.getAllMappingsDescriptions();

            // STATE GUARD: Decrypt requires unlocked state
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
                let categoryId = tx.categoryId;
                
                // Resolve auto-mapped category if applicable
                if (tx.useAutoCategory && !categoryId) {
                    const description = tx.encrypted_description 
                        ? await this.security.decrypt(tx.encrypted_description)
                        : '';
                    const mapping = mappings.find(m => m.description === description);
                    if (mapping && mapping.encrypted_category) {
                        const categoryName = await this.security.decrypt(mapping.encrypted_category);
                        if (categoryName === 'Transfer') {
                            categoryId = null; // Transfer type, but resolved via mapping
                        } else {
                            // Find category by decrypting names
                            for (const cat of categories) {
                                const name = await this.security.decrypt(cat.encrypted_name);
                                if (name === categoryName) {
                                    categoryId = cat.id;
                                    break;
                                }
                            }
                        }
                    }
                }
                
                if (!categoryId) {
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
                        // No field means uncategorized (even after resolving auto-mapping)
                        notifications.uncategorizedCount++;
                    }
                }
            }

            // Check budget balance for current month
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            let totalIncome = 0;
            let totalExpenses = 0;
            
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

    /**
     * Show notifications modal with actionable items
     * 
     * DISPLAY:
     * - List of notifications with icons
     * - Empty state if no notifications
     * - Close button and overlay click to dismiss
     * 
     * ICONS:
     * - credit-card: Unmapped accounts
     * - arrow-left-right: Unlinked transfers
     * - tag: Uncategorized transactions
     * - trending-up/down: Budget surplus/deficit
     */
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
