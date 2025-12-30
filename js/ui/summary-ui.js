/**
 * SummaryUI - Financial analytics and data visualization manager
 * 
 * RESPONSIBILITIES:
 * - Render summary/analytics tab with donut charts and category breakdowns
 * - Calculate period-based financial summaries (YTD, monthly, custom ranges)
 * - Generate SVG donut charts for income/expense/saving categories
 * - Filter transactions by year and period selections
 * - Resolve auto-mapped categories for accurate reporting
 * - Handle positive expense categories (move Venmo to Income, exclude others from charts)
 * - Display detailed breakdown tables with budgeted vs tracked amounts
 * 
 * STATE REQUIREMENTS:
 * - Unlocked state (requires decryption access)
 * - Transactions and categories must exist in database
 * - Supports auto-category mapping resolution via description mappings
 * 
 * CHART LOGIC:
 * - Single-category: Full circle donut
 * - Multi-category: Segmented donut with SVG path elements
 * - Legend shows category names with color coding
 * - Center displays total amount for category type
 * 
 * FILTER OPTIONS:
 * - Year selection (current + 5 years back)
 * - Period: YTD, Current Month, or specific month (YYYY-MM)
 * - Dynamic period options based on selected year
 * 
 * @class SummaryUI
 * @module UI/Summary
 * @layer 5 - UI Components
 */
export class SummaryUI {
    /**
     * Initialize summary UI component
     * 
     * @param {SecurityManager} security - Encryption/decryption manager
     * @param {DatabaseManager} db - IndexedDB interface via Dexie
     */
    constructor(security, db) {
        this.security = security;
        this.db = db;
        
        // Filter state
        const now = new Date();
        this.selectedYear = now.getFullYear();
        this.selectedPeriod = 'current-month'; // 'ytd', 'current-month', or 'YYYY-MM'
    }

    /**
     * Render complete summary tab with filters, charts, and breakdown tables
     * 
     * WORKFLOW:
     * 1. Fetch all transactions and categories from database
     * 2. Display empty state if no data exists
     * 3. Generate year and period filter dropdowns
     * 4. Calculate summary data (totals, category breakdowns)
     * 5. Render HTML sections for Income/Expense/Saving
     * 6. Attach filter change event listeners
     * 7. Render SVG donut charts for each category type
     * 
     * FILTER STATE:
     * - Persists selectedYear and selectedPeriod in class properties
     * - Re-renders on filter change
     * - Resets period to 'current-month' when year changes
     * 
     * @async
     * @returns {Promise<void>}
     */
    async renderSummaryTab() {
        console.log('📊 Rendering summary tab');
        
        const container = document.getElementById('summary-container');
        
        if (!container) {
            console.error('❌ Summary container not found');
            return;
        }
        
        const transactions = await this.db.getAllTransactions();
        const categories = await this.db.getAllCategories();
        
        if (transactions.length === 0 || categories.length === 0) {
            container.innerHTML = `
                <div class="summary-scroll-container">
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i data-lucide="bar-chart-2" style="width: 64px; height: 64px;"></i>
                        </div>
                        <h3>No Data to Summarize</h3>
                        <p>Add transactions to see summary charts and analytics</p>
                    </div>
                </div>
            `;
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            return;
        }
        
        // Generate year and period options
        const years = this.getAvailableYears(transactions);
        const periods = this.getPeriodOptions(this.selectedYear);
        
        // Build filter controls
        const filterHTML = `
            <div style="position: sticky; top: 0; z-index: 10; background: var(--bg-secondary); padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; gap: 8px; align-items: center;">
                    <select id="summary-year" style="flex: 1; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 0.875rem;">
                        ${years.map(y => `<option value="${y}" ${y === this.selectedYear ? 'selected' : ''}>${y}</option>`).join('')}
                    </select>
                    <select id="summary-period" style="flex: 2; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); font-size: 0.875rem;">
                        ${periods.map(p => `<option value="${p.value}" ${p.value === this.selectedPeriod ? 'selected' : ''}>${p.label}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;
        
        // Calculate totals and category breakdowns
        const summary = await this.calculateSummaryData(transactions, categories);
        
        // Build HTML with donut charts and tables
        let html = filterHTML + '<div class="summary-scroll-container"><div class="summary-sections">';
        
        // Render each category type section
        for (const type of ['Income', 'Expense', 'Saving']) {
            if (!summary[type] || summary[type].categories.length === 0) continue;
            
            html += this.renderCategorySection(type, summary[type]);
        }
        
        html += '</div></div>'; // Close summary-sections and summary-scroll-container
        
        container.innerHTML = html;
        
        // Attach filter event listeners
        const yearSelect = document.getElementById('summary-year');
        const periodSelect = document.getElementById('summary-period');
        
        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => {
                this.selectedYear = parseInt(e.target.value);
                // Reset period options when year changes
                this.selectedPeriod = 'current-month';
                this.renderSummaryTab();
            });
        }
        
        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                this.selectedPeriod = e.target.value;
                this.renderSummaryTab();
            });
        }
        
        // Render donut charts after DOM update
        setTimeout(() => {
            for (const type of ['Income', 'Expense', 'Saving']) {
                if (summary[type] && summary[type].categories.length > 0) {
                    this.renderDonutChart(`donut-${type.toLowerCase()}`, summary[type].categories);
                }
            }
        }, 100);
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Calculate summary data with category breakdowns and budget comparisons
     * 
     * CALCULATION LOGIC:
     * - Filter transactions by selected period (calls filterTransactionsByPeriod)
     * - Decrypt transaction amounts and descriptions
     * - Resolve categories (including auto-mapped via description mappings)
     * - Skip 'Transfer' category in summaries
     * - Aggregate amounts by category type and name
     * - Decrypt and include budgeted amounts from categories
     * - Sort categories by absolute tracked amount (descending)
     * 
     * SPECIAL HANDLING:
     * - Positive Expense/Saving categories:
     *   - Venmo: Move to Income if net positive
     *   - Others: Keep in table but exclude from chart (showInChart=false)
     * - Auto-category mapping: Resolve via description mappings if useAutoCategory=true
     * - Missing budgets: Default to 0 if decryption fails or value missing
     * 
     * @async
     * @param {Array<Object>} transactions - All encrypted transactions from database
     * @param {Array<Object>} categories - All encrypted categories from database
     * @returns {Promise<Object>} Summary object with structure:
     *   { Income: {total, categories[]}, Expense: {total, categories[]}, Saving: {total, categories[]} }
     *   Each category: {name, tracked, total, budgeted, showInChart}
     */
    async calculateSummaryData(transactions, categories) {
        const summary = {
            Income: { total: 0, categories: [] },
            Expense: { total: 0, categories: [] },
            Saving: { total: 0, categories: [] }
        };
        
        const categoryTotals = {};
        const categoryBudgets = {};
        
        // Filter transactions by selected period
        const filteredTransactions = await this.filterTransactionsByPeriod(transactions);
        
        // Get mappings for auto-category resolution
        const mappings = await this.db.getAllMappingsDescriptions();
        
        for (const transaction of filteredTransactions) {
            // STATE GUARD: Decrypt requires unlocked state
            const amount = parseFloat(await this.security.decrypt(transaction.encrypted_amount));
            const description = transaction.encrypted_description ? await this.security.decrypt(transaction.encrypted_description) : '';
            
            // Resolve category (support auto-mapping)
            let categoryId = transaction.categoryId;
            let category = categories.find(c => c.id === categoryId);
            
            // Handle auto-mapped category
            if (transaction.useAutoCategory) {
                const mapping = mappings.find(m => m.description === description);
                if (mapping && mapping.encrypted_category) {
                    const categoryName = await this.security.decrypt(mapping.encrypted_category);
                    if (categoryName === 'Transfer') {
                        // Skip transfers in summary
                        continue;
                    } else {
                        // Find category by name
                        for (const cat of categories) {
                            const name = await this.security.decrypt(cat.encrypted_name);
                            if (name === categoryName) {
                                category = cat;
                                categoryId = cat.id;
                                break;
                            }
                        }
                    }
                }
            }
            
            if (!category) continue;
            
            const categoryName = await this.security.decrypt(category.encrypted_name);
            const categoryType = category.type || 'Expense';
            
            // Handle missing or empty budget values
            let categoryBudget = 0;
            if (category.encrypted_limit && category.encrypted_limit.length > 16) {
                try {
                    categoryBudget = parseFloat(await this.security.decrypt(category.encrypted_limit));
                } catch (e) {
                    console.warn(`Failed to decrypt budget for category ${categoryName}:`, e);
                    categoryBudget = 0;
                }
            }
            
            if (!categoryTotals[categoryType]) {
                categoryTotals[categoryType] = {};
                categoryBudgets[categoryType] = {};
            }
            
            if (!categoryTotals[categoryType][categoryName]) {
                categoryTotals[categoryType][categoryName] = 0;
                categoryBudgets[categoryType][categoryName] = categoryBudget;
            }
            
            categoryTotals[categoryType][categoryName] += amount;
        }
        
        // Convert to sorted arrays with budget info
        for (const type of ['Income', 'Expense', 'Saving']) {
            if (categoryTotals[type]) {
                summary[type].categories = Object.entries(categoryTotals[type])
                    .map(([name, tracked]) => ({
                        name,
                        tracked,
                        total: tracked,
                        budgeted: categoryBudgets[type][name] || 0,
                        showInChart: true
                    }))
                    .sort((a, b) => Math.abs(b.tracked) - Math.abs(a.tracked));
                
                summary[type].total = summary[type].categories.reduce((sum, cat) => sum + cat.tracked, 0);
            }
        }
        
        // Handle positive Expense/Saving categories
        // Move "Venmo" to Income if net positive, exclude other positive categories from chart only
        for (const type of ['Expense', 'Saving']) {
            if (!summary[type].categories) continue;
            
            const categoriesToMove = [];
            
            for (let i = summary[type].categories.length - 1; i >= 0; i--) {
                const cat = summary[type].categories[i];
                
                if (cat.tracked > 0) {
                    if (cat.name === 'Venmo') {
                        // Remove from current type and move to Income
                        summary[type].categories.splice(i, 1);
                        summary[type].total -= cat.tracked;
                        
                        categoriesToMove.push({
                            name: 'Venmo',
                            tracked: cat.tracked,
                            total: cat.tracked,
                            budgeted: 0,
                            showInChart: true
                        });
                    } else {
                        // Keep in table but exclude from chart
                        cat.showInChart = false;
                    }
                }
            }
            
            // Add moved categories to Income
            if (categoriesToMove.length > 0) {
                summary.Income.categories.push(...categoriesToMove);
                summary.Income.total += categoriesToMove.reduce((sum, cat) => sum + cat.tracked, 0);
            }
        }
        
        // Re-sort Income after adding moved categories
        if (summary.Income.categories && summary.Income.categories.length > 0) {
            summary.Income.categories.sort((a, b) => Math.abs(b.tracked) - Math.abs(a.tracked));
        }
        
        return summary;
    }

    /**
     * Render HTML section for a category type (Income/Expense/Saving)
     * 
     * SECTION STRUCTURE:
     * - Header with section title and toggle details button
     * - Collapsible details table (hidden by default):
     *   - Columns: Category, Tracked, Budgeted, %, Remaining/Excess
     *   - Color-coded category indicators
     *   - Total row at bottom
     * - Donut chart with SVG placeholder and center text
     * - Legend with category names and color dots
     * 
     * TABLE CALCULATIONS:
     * - Percentage: (tracked / budgeted) * 100
     * - Remaining: budgeted - tracked (positive=under budget, negative=over budget)
     * - Status class: 'positive' or 'negative' for color coding
     * 
     * @param {string} type - Category type: 'Income', 'Expense', or 'Saving'
     * @param {Object} data - Summary data object: {total, categories[]}
     * @returns {string} HTML string for the category section
     */
    renderCategorySection(type, data) {
        const colors = this.getCategoryColors(type);
        const hasData = data.categories.length > 0;
        
        return `
            <div class="summary-section">
                <div class="section-header-row">
                    <h3 class="section-header">${type} Summary</h3>
                    ${hasData ? `
                        <button class="toggle-details-btn" data-section="${type.toLowerCase()}">
                            <i data-lucide="chevron-down"></i>
                            <span class="btn-text">Show Details</span>
                        </button>
                    ` : ''}
                </div>
                
                ${hasData ? `
                    <!-- Details Table (Hidden by default) -->
                    <div id="${type.toLowerCase()}-details" class="category-details hidden">
                        <div class="details-table">
                            <div class="details-table-header">
                                <span class="col-name">Category</span>
                                <span class="col-tracked">Tracked</span>
                                <span class="col-budgeted">Budgeted</span>
                                <span class="col-percent">%</span>
                                <span class="col-remaining">${type === 'Income' ? 'Excess' : 'Remaining'}</span>
                            </div>
                            ${data.categories.map((cat, index) => {
                                const percentage = cat.budgeted > 0 ? (Math.abs(cat.tracked) / cat.budgeted * 100).toFixed(1) : 0;
                                const diff = cat.budgeted - cat.tracked;
                                const statusClass = diff < 0 ? 'negative' : 'positive';
                                
                                return `
                                    <div class="details-table-row">
                                        <span class="col-name">
                                            <span class="breakdown-color" style="background: ${colors[index % colors.length]};"></span>
                                            ${cat.name}
                                        </span>
                                        <span class="col-tracked">${cat.tracked >= 0 ? '+' : ''}$${cat.tracked.toFixed(2)}</span>
                                        <span class="col-budgeted">$${cat.budgeted.toFixed(2)}</span>
                                        <span class="col-percent">${percentage}%</span>
                                        <span class="col-remaining ${statusClass}">
                                            ${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                            ${data.categories.length > 1 ? `
                                <div class="details-table-row total-row">
                                    <span class="col-name"><strong>Total</strong></span>
                                    <span class="col-tracked"><strong>${data.categories.reduce((sum, cat) => sum + cat.tracked, 0) >= 0 ? '+' : ''}$${data.categories.reduce((sum, cat) => sum + cat.tracked, 0).toFixed(2)}</strong></span>
                                    <span class="col-budgeted"><strong>$${data.categories.reduce((sum, cat) => sum + cat.budgeted, 0).toFixed(2)}</strong></span>
                                    <span class="col-percent"></span>
                                    <span class="col-remaining"><strong>${(data.categories.reduce((sum, cat) => sum + cat.budgeted, 0) - data.categories.reduce((sum, cat) => sum + cat.tracked, 0)) >= 0 ? '+' : ''}$${(data.categories.reduce((sum, cat) => sum + cat.budgeted, 0) - data.categories.reduce((sum, cat) => sum + cat.tracked, 0)).toFixed(2)}</strong></span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Donut Chart with Legend -->
                    <div class="summary-content">
                        <div class="donut-container-center">
                            <svg id="donut-${type.toLowerCase()}" width="200" height="200" viewBox="0 0 200 200">
                                <text x="100" y="95" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--text-primary)">
                                    $${data.total.toFixed(0)}
                                </text>
                                <text x="100" y="115" text-anchor="middle" font-size="12" fill="var(--text-secondary)">
                                    Total ${type}
                                </text>
                            </svg>
                        </div>
                        <div class="chart-legend">
                            ${data.categories.filter(cat => cat.showInChart).map((cat, index) => `
                                <div class="legend-item">
                                    <span class="legend-color" style="background: ${colors[index % colors.length]};"></span>
                                    <span class="legend-label">${cat.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="empty-category-section">
                        <p style="color: var(--text-secondary); text-align: center; padding: 20px;">
                            No ${type.toLowerCase()} transactions yet
                        </p>
                    </div>
                `}
            </div>
        `;
    }

    /**
     * Render SVG donut chart for category breakdown
     * 
     * CHART RENDERING:
     * - Single category: Renders full circle (outer + inner circle)
     * - Multiple categories: Renders segmented donut using SVG path elements
     * - Uses absolute values for chart percentages (handles negative amounts)
     * - Filters out categories with showInChart=false
     * 
     * SVG STRUCTURE:
     * - viewBox: 0 0 200 200 (200x200 coordinate system)
     * - Center: (100, 100)
     * - Outer radius: 70px
     * - Thickness: 25px (inner radius: 45px)
     * - Start angle: -90° (top of circle)
     * 
     * COLORS:
     * - Assigned sequentially from getCategoryColors(type)
     * - Cycles through color array if categories exceed color count
     * 
     * @param {string} svgId - DOM ID of the SVG element to populate
     * @param {Array<Object>} categories - Category objects with {name, total, showInChart}
     * @returns {void}
     */
    renderDonutChart(svgId, categories) {
        const svg = document.getElementById(svgId);
        if (!svg || categories.length === 0) {
            console.log(`⚠️ Donut chart ${svgId}: No SVG or no categories`);
            return;
        }
        
        // Only show categories marked for chart display and use absolute values for chart
        const chartCategories = categories.filter(cat => cat.showInChart);
        if (chartCategories.length === 0) {
            console.log(`⚠️ Donut chart ${svgId}: No categories to display in chart`);
            return;
        }
        
        const total = chartCategories.reduce((sum, cat) => sum + Math.abs(cat.total), 0);
        const colors = this.getCategoryColors(svgId.includes('income') ? 'Income' : 
                                             svgId.includes('saving') ? 'Saving' : 'Expense');
        
        const centerX = 100;
        const centerY = 100;
        const radius = 70;
        const thickness = 25;
        
        console.log(`📊 Rendering donut ${svgId}: ${chartCategories.length} categories`);
        
        if (chartCategories.length === 1) {
            console.log(`   Single category - showing full circle`);
            
            const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            outerCircle.setAttribute('cx', centerX);
            outerCircle.setAttribute('cy', centerY);
            outerCircle.setAttribute('r', radius);
            outerCircle.setAttribute('fill', colors[0]);
            
            const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            innerCircle.setAttribute('cx', centerX);
            innerCircle.setAttribute('cy', centerY);
            innerCircle.setAttribute('r', radius - thickness);
            innerCircle.setAttribute('fill', 'var(--bg-secondary)');
            
            svg.insertBefore(innerCircle, svg.firstChild);
            svg.insertBefore(outerCircle, svg.firstChild);
            return;
        }
        
        let currentAngle = -90;
        
        chartCategories.forEach((cat, index) => {
            const percentage = Math.abs(cat.total) / total;
            const angle = percentage * 360;
            
            const path = this.createDonutSegment(
                centerX, centerY, radius, thickness,
                currentAngle, currentAngle + angle
            );
            
            const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathElement.setAttribute('d', path);
            pathElement.setAttribute('fill', colors[index % colors.length]);
            pathElement.setAttribute('class', 'donut-segment');
            
            svg.insertBefore(pathElement, svg.firstChild);
            
            currentAngle += angle;
        });
    }

    /**
     * Create SVG path data for a donut chart segment (arc)
     * 
     * PATH CONSTRUCTION:
     * - Outer arc from start to end (clockwise)
     * - Line to inner arc end point
     * - Inner arc from end to start (counter-clockwise)
     * - Close path (Z)
     * 
     * ARC FLAGS:
     * - largeArc: 1 if arc > 180°, else 0
     * - Outer arc: sweep-flag=0 (clockwise)
     * - Inner arc: sweep-flag=1 (counter-clockwise)
     * 
     * @param {number} cx - Center X coordinate
     * @param {number} cy - Center Y coordinate
     * @param {number} radius - Outer radius
     * @param {number} thickness - Donut thickness (radius - innerRadius)
     * @param {number} startAngle - Start angle in degrees (0° = 3 o'clock)
     * @param {number} endAngle - End angle in degrees
     * @returns {string} SVG path data string (e.g., 'M x y A ... Z')
     */
    createDonutSegment(cx, cy, radius, thickness, startAngle, endAngle) {
        const innerRadius = radius - thickness;
        
        const start = this.polarToCartesian(cx, cy, radius, endAngle);
        const end = this.polarToCartesian(cx, cy, radius, startAngle);
        const innerStart = this.polarToCartesian(cx, cy, innerRadius, endAngle);
        const innerEnd = this.polarToCartesian(cx, cy, innerRadius, startAngle);
        
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        
        return [
            'M', start.x, start.y,
            'A', radius, radius, 0, largeArc, 0, end.x, end.y,
            'L', innerEnd.x, innerEnd.y,
            'A', innerRadius, innerRadius, 0, largeArc, 1, innerStart.x, innerStart.y,
            'Z'
        ].join(' ');
    }

    /**
     * Convert polar coordinates to Cartesian coordinates
     * 
     * COORDINATE SYSTEM:
     * - Adjusts angle by -90° to start from top of circle (12 o'clock)
     * - Standard SVG: 0° = 3 o'clock, 90° = 6 o'clock
     * - Adjusted: 0° = 12 o'clock, 90° = 3 o'clock
     * 
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     * @param {number} radius - Distance from center
     * @param {number} angleInDegrees - Angle in degrees (0° = top after adjustment)
     * @returns {Object} Cartesian coordinates: {x, y}
     */
    polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }

    /**
     * Get color palette for category type
     * 
     * COLOR SCHEMES:
     * - Income: Green shades (#10b981 → #d1fae5)
     * - Expense: Red shades (#ef4444 → #fee2e2)
     * - Saving: Blue shades (#3b82f6 → #dbeafe)
     * 
     * @param {string} type - Category type: 'Income', 'Expense', or 'Saving'
     * @returns {Array<string>} Array of 5 hex color codes (darkest to lightest)
     */
    getCategoryColors(type) {
        const colors = {
            Income: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'],
            Expense: ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'],
            Saving: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']
        };
        return colors[type] || colors.Expense;
    }
    
    /**
     * Generate list of available years for filter dropdown
     * 
     * LOGIC:
     * - Always includes current year
     * - Includes 5 years back for historical data
     * - Sorted descending (newest first)
     * 
     * NOTE: Does not decrypt transactions to extract actual years
     * (optimization to avoid decrypting all transaction dates)
     * 
     * @param {Array<Object>} transactions - All transactions (unused in current implementation)
     * @returns {Array<number>} Sorted array of years (descending)
     */
    getAvailableYears(transactions) {
        const years = new Set();
        const now = new Date();
        years.add(now.getFullYear());
        
        // Add years from transactions (but don't decrypt yet, we'll filter later)
        // For now, just provide current year and a few years back
        for (let i = 0; i < 5; i++) {
            years.add(now.getFullYear() - i);
        }
        
        return Array.from(years).sort((a, b) => b - a);
    }
    
    /**
     * Generate period options for filter dropdown based on selected year
     * 
     * OPTIONS STRUCTURE:
     * - 'ytd': Total Year (Jan 1 to Dec 31 or today)
     * - 'current-month': Current month in selected year
     * - 'YYYY-MM': Specific months (January through December)
     * 
     * CURRENT YEAR LOGIC:
     * - Only shows months up to current month
     * - Example: If today is March 15, only shows Jan/Feb/Mar
     * 
     * PAST YEARS:
     * - Shows all 12 months
     * 
     * @param {number} year - Selected year for period filtering
     * @returns {Array<Object>} Array of {value, label} option objects
     */
    getPeriodOptions(year) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        const options = [
            { value: 'ytd', label: 'Total Year' },
            { value: 'current-month', label: 'Current Month' }
        ];
        
        // Add all months of the selected year
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        for (let i = 0; i < 12; i++) {
            // Only show months up to current month if it's the current year
            if (year === currentYear && i > currentMonth) continue;
            
            const monthValue = `${year}-${String(i + 1).padStart(2, '0')}`;
            options.push({ value: monthValue, label: monthNames[i] });
        }
        
        return options;
    }
    
    /**
     * Filter transactions based on selected year and period
     * 
     * FILTER MODES:
     * 1. 'ytd': Year-to-date (Jan 1 to Dec 31 or today if current year)
     * 2. 'current-month': Current month number in selected year
     * 3. 'YYYY-MM': Specific month in format '2024-03'
     * 
     * WORKFLOW:
     * - Decrypt each transaction's date
     * - Parse date to extract year and month
     * - Compare against selectedPeriod and selectedYear
     * - Return filtered array
     * 
     * ENCRYPTION:
     * - Decrypts encrypted_date for each transaction
     * - Performance consideration: O(n) decryption operations
     * 
     * @async
     * @param {Array<Object>} transactions - All encrypted transactions
     * @returns {Promise<Array<Object>>} Filtered transactions matching period
     */
    async filterTransactionsByPeriod(transactions) {
        const filtered = [];
        
        for (const transaction of transactions) {
            const dateStr = await this.security.decrypt(transaction.encrypted_date);
            const transactionDate = new Date(dateStr);
            const transactionYear = transactionDate.getFullYear();
            const transactionMonth = String(transactionDate.getMonth() + 1).padStart(2, '0');
            const transactionYearMonth = `${transactionYear}-${transactionMonth}`;
            
            let include = false;
            
            if (this.selectedPeriod === 'ytd') {
                // Total year: Jan 1 to Dec 31 (or today if current year)
                const yearStart = new Date(this.selectedYear, 0, 1);
                const yearEnd = new Date(this.selectedYear, 11, 31, 23, 59, 59);
                const now = new Date();
                const effectiveEnd = this.selectedYear === now.getFullYear() ? now : yearEnd;
                
                include = transactionDate >= yearStart && transactionDate <= effectiveEnd;
            } else if (this.selectedPeriod === 'current-month') {
                // Current month number in selected year
                const now = new Date();
                const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');
                const targetMonth = `${this.selectedYear}-${currentMonthNum}`;
                include = transactionYearMonth === targetMonth;
            } else {
                // Specific month (YYYY-MM format)
                include = transactionYearMonth === this.selectedPeriod;
            }
            
            if (include) {
                filtered.push(transaction);
            }
        }
        
        return filtered;
    }
}
