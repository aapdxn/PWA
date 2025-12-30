// ui-helpers.js - Shared utility functions for UI modules
// This module contains common functions used across multiple UI components
// to reduce code duplication and maintain consistency

/**
 * Get category name from categoryId, handling Transfer and missing categories
 * @param {number|null} categoryId - The category ID
 * @param {Array} categories - Array of category objects
 * @param {Object} security - Security manager for decryption
 * @returns {Promise<string>} Category name or 'Transfer'/'Uncategorized'
 */
export async function getCategoryName(categoryId, categories, security) {
    if (!categoryId) return 'Transfer'; // Handle Transfer type (no category)
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 'Uncategorized';
    return await security.decrypt(category.encrypted_name);
}

/**
 * Resolve auto-mapped category for a transaction
 * @param {Object} transaction - Transaction object with useAutoCategory flag
 * @param {string} description - Decrypted description
 * @param {Array} categories - Array of category objects
 * @param {Array} mappings - Array of description mappings
 * @param {Object} security - Security manager for decryption
 * @returns {Promise<Object>} { categoryId, category }
 */
export async function resolveAutoCategory(transaction, description, categories, mappings, security) {
    let categoryId = transaction.categoryId;
    let category = categories.find(c => c.id === categoryId);
    
    if (transaction.useAutoCategory) {
        const mapping = mappings.find(m => m.description === description);
        if (mapping && mapping.encrypted_category) {
            const categoryName = await security.decrypt(mapping.encrypted_category);
            if (categoryName === 'Transfer') {
                categoryId = null; // Transfer type
                category = null;
            } else {
                // Find category by decrypting names
                for (const cat of categories) {
                    const name = await security.decrypt(cat.encrypted_name);
                    if (name === categoryName) {
                        category = cat;
                        categoryId = cat.id;
                        break;
                    }
                }
            }
        }
    }
    
    return { categoryId, category };
}

/**
 * Resolve auto-mapped payee for a transaction
 * @param {Object} transaction - Transaction object with useAutoPayee flag
 * @param {string} description - Decrypted description
 * @param {Array} payees - Array of payee objects
 * @param {Array} mappings - Array of description mappings
 * @param {Object} security - Security manager for decryption
 * @returns {Promise<Object>} { payeeId, payee }
 */
export async function resolveAutoPayee(transaction, description, payees, mappings, security) {
    let payeeId = transaction.payeeId;
    let payee = payees.find(p => p.id === payeeId);
    
    if (transaction.useAutoPayee) {
        const mapping = mappings.find(m => m.description === description);
        if (mapping && mapping.encrypted_payee) {
            const payeeName = await security.decrypt(mapping.encrypted_payee);
            if (payeeName) {
                // Find payee by decrypting names
                for (const p of payees) {
                    const name = await security.decrypt(p.encrypted_name);
                    if (name === payeeName) {
                        payee = p;
                        payeeId = p.id;
                        break;
                    }
                }
            }
        }
    }
    
    return { payeeId, payee };
}

/**
 * Decrypt and enrich a single transaction with all related data
 * @param {Object} transaction - Raw encrypted transaction
 * @param {Object} context - { security, categories, payees, mappings, accountMappingsUI }
 * @returns {Promise<Object>} Fully decrypted transaction with resolved relationships
 */
export async function decryptTransaction(transaction, context) {
    const { security, categories, payees, mappings, accountMappingsUI } = context;
    
    const description = transaction.encrypted_description 
        ? await security.decrypt(transaction.encrypted_description) 
        : 'No description';
    
    // Resolve auto-mapped category
    const { categoryId, category } = await resolveAutoCategory(
        transaction, description, categories, mappings, security
    );
    
    // Resolve auto-mapped payee
    const { payeeId, payee } = await resolveAutoPayee(
        transaction, description, payees, mappings, security
    );
    
    const linkedTransactionId = transaction.encrypted_linkedTransactionId 
        ? await security.decrypt(transaction.encrypted_linkedTransactionId) 
        : null;
    
    // Determine category type
    // Transfer: no categoryId AND has encrypted_linkedTransactionId field
    // Uncategorized: no categoryId AND no encrypted_linkedTransactionId field
    let categoryType;
    if (!categoryId) {
        categoryType = (transaction.encrypted_linkedTransactionId !== undefined) 
            ? 'Transfer' 
            : 'Uncategorized';
    } else {
        categoryType = category ? category.type : 'Expense';
    }
    
    const rawAccount = transaction.encrypted_account 
        ? await security.decrypt(transaction.encrypted_account) 
        : '';
    
    // AccountMappingsUI is optional - only used when available
    const accountDisplayName = accountMappingsUI && rawAccount
        ? await accountMappingsUI.getAccountDisplayName(rawAccount) 
        : rawAccount;
    
    return {
        id: transaction.id,
        date: await security.decrypt(transaction.encrypted_date),
        amount: parseFloat(await security.decrypt(transaction.encrypted_amount)),
        description: description,
        account: rawAccount,
        accountDisplayName: accountDisplayName,
        note: transaction.encrypted_note ? await security.decrypt(transaction.encrypted_note) : '',
        categoryId: categoryId,
        categoryName: await getCategoryName(categoryId, categories, security),
        categoryType: categoryType,
        payeeId: payeeId,
        payeeName: payee ? await security.decrypt(payee.encrypted_name) : null,
        linkedTransactionId: linkedTransactionId ? parseInt(linkedTransactionId) : null,
        useAutoCategory: transaction.useAutoCategory || false,
        useAutoPayee: transaction.useAutoPayee || false
    };
}

/**
 * Format a date as YYYY-MM-DD
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateYYYYMMDD(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format currency amount with proper sign and formatting
 * @param {number} amount - Amount to format
 * @param {boolean} forcePositive - Always show as positive
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, forcePositive = false) {
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    
    if (forcePositive || amount === 0) {
        return `$${formatted}`;
    }
    
    return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Get amount class (income/expense) based on category type and amount
 * @param {number} amount - Transaction amount
 * @param {string} categoryType - 'Income', 'Expense', 'Transfer', or 'Uncategorized'
 * @returns {string} CSS class name ('income' or 'expense')
 */
export function getAmountClass(amount, categoryType) {
    if (categoryType === 'Income') return 'income';
    if (categoryType === 'Expense') return 'expense';
    // For Transfer/Uncategorized, use amount sign
    return amount >= 0 ? 'income' : 'expense';
}

/**
 * Initialize Lucide icons in a container
 * @param {HTMLElement} container - Container element to initialize icons in
 */
export function initIcons(container = document) {
    if (typeof window.loadIcons === 'function') {
        window.loadIcons(container);
    } else if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Show a temporary toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', 'warning', or 'info'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
    // TODO: Implement proper toast component
    // For now, use alert as fallback
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Create simple toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-tertiary);
        color: var(--text-primary);
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideUp 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
