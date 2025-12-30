// SummaryUI - Handles summary analytics, charts, and data visualization
export class SummaryUI {
    constructor(security, db) {
        this.security = security;
        this.db = db;
        
        // Filter state
        const now = new Date();
        this.selectedYear = now.getFullYear();
        this.selectedPeriod = 'current-month'; // 'ytd', 'current-month', or 'YYYY-MM'
    }

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

    polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }

    getCategoryColors(type) {
        const colors = {
            Income: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'],
            Expense: ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'],
            Saving: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']
        };
        return colors[type] || colors.Expense;
    }
    
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
