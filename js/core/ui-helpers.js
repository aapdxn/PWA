/**
 * UIHelpers - Shared Utility Functions for UI Modules
 * 
 * Contains common functions used across multiple UI components to reduce
 * code duplication and maintain consistency. Includes transaction decryption,
 * formatting utilities, auto-mapping resolution, and UI helpers.
 * 
 * CORE FUNCTIONS:
 * - decryptTransaction: Decrypt and enrich single transaction
 * - resolveAutoCategory/resolveAutoPayee: Auto-mapping resolution
 * - formatCurrency/formatDateYYYYMMDD: Display formatting
 * - showToast/initIcons: UI utilities
 * - debounce/deepClone: General utilities
 * 
 * DEPENDENCIES:
 * - SecurityManager: For decryption operations
 * - DatabaseManager: For category/payee lookups
 * - Lucide: For icon rendering
 * 
 * @module Core/UIHelpers
 * @layer 3 - Core Services
 */

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
            // STATE GUARD: Decrypt requires unlocked state
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
            // STATE GUARD: Decrypt requires unlocked state
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
 * 
 * STATE GUARD: Decrypt requires unlocked state
 * 
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
 * 
 * @param {Date|string} date - Date to format (Date object or date string)
 * @returns {string} Formatted date string (YYYY-MM-DD)
 * 
 * @example
 * formatDateYYYYMMDD(new Date('2024-12-30'))
 * // Returns: '2024-12-30'
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
 * 
 * Formats numbers as USD currency with thousand separators and 2 decimal places.
 * Handles negative amounts with proper sign placement.
 * 
 * @param {number} amount - Amount to format
 * @param {boolean} [forcePositive=false] - Always show as positive (ignore sign)
 * @returns {string} Formatted currency string (e.g., '$1,234.56' or '-$50.00')
 * 
 * @example
 * formatCurrency(-50.00)  // Returns: '-$50.00'
 * formatCurrency(-50.00, true)  // Returns: '$50.00'
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
 * 
 * Determines CSS class for styling transaction amounts. For categorized
 * transactions, uses category type. For Transfer/Uncategorized, uses amount sign.
 * 
 * @param {number} amount - Transaction amount
 * @param {string} categoryType - 'Income', 'Expense', 'Transfer', or 'Uncategorized'
 * @returns {string} CSS class name ('income' or 'expense')
 * 
 * @example
 * getAmountClass(50.00, 'Income')  // Returns: 'income'
 * getAmountClass(-50.00, 'Expense')  // Returns: 'expense'
 * getAmountClass(-50.00, 'Transfer')  // Returns: 'expense' (uses sign)
 */
export function getAmountClass(amount, categoryType) {
    if (categoryType === 'Income') return 'income';
    if (categoryType === 'Expense') return 'expense';
    // For Transfer/Uncategorized, use amount sign
    return amount >= 0 ? 'income' : 'expense';
}

/**
 * Initialize Lucide icons in a container
 * 
 * Triggers Lucide icon replacement for all icon elements within the specified
 * container. Call after dynamically inserting HTML with icon elements.
 * 
 * @param {HTMLElement} [container=document] - Container element to initialize icons in
 * 
 * @example
 * element.innerHTML = '<i data-lucide="check"></i>';
 * initIcons(element);
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
 * 
 * Displays a temporary notification message at the bottom of the screen.
 * Auto-dismisses after specified duration.
 * 
 * @param {string} message - Message to display
 * @param {string} [type='info'] - Toast type: 'success', 'error', 'warning', or 'info'
 * @param {number} [duration=3000] - Duration in milliseconds before auto-dismiss
 * 
 * @example
 * showToast('Transaction saved!', 'success');
 * showToast('Invalid amount', 'error', 5000);
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
 * 
 * Creates a debounced version of the provided function that delays execution
 * until after the specified wait time has elapsed since the last invocation.
 * Useful for limiting rate of execution (e.g., search input handlers).
 * 
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 * 
 * @example
 * const debouncedSearch = debounce(searchFunction, 300);
 * input.addEventListener('input', debouncedSearch);
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
 * 
 * Creates a deep copy of an object using JSON serialization.
 * Note: This method does not preserve functions, symbols, or undefined values.
 * 
 * @param {any} obj - Object to clone (must be JSON-serializable)
 * @returns {any} Deep cloned copy of the object
 * 
 * @example
 * const original = { a: 1, b: { c: 2 } };
 * const copy = deepClone(original);
 * copy.b.c = 3;  // Does not affect original
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
