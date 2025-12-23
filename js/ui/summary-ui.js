// SummaryUI - Handles summary analytics, charts, and data visualization
export class SummaryUI {
    constructor(security, db) {
        this.security = security;
        this.db = db;
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
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="bar-chart-2" style="width: 64px; height: 64px;"></i>
                    </div>
                    <h3>No Data to Summarize</h3>
                    <p>Add transactions to see summary charts and analytics</p>
                </div>
            `;
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            return;
        }
        
        // Calculate totals and category breakdowns
        const summary = await this.calculateSummaryData(transactions, categories);
        
        // Build HTML with donut charts and tables
        let html = '<div class="summary-sections">';
        
        // Render each category type section
        for (const type of ['Income', 'Expense', 'Saving']) {
            if (!summary[type] || summary[type].categories.length === 0) continue;
            
            html += this.renderCategorySection(type, summary[type]);
        }
        
        html += '</div>';
        
        container.innerHTML = html;
        
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
        
        for (const transaction of transactions) {
            const amount = Math.abs(parseFloat(await this.security.decrypt(transaction.encrypted_amount)));
            const category = categories.find(c => c.id === transaction.categoryId);
            
            if (!category) continue;
            
            const categoryName = await this.security.decrypt(category.encrypted_name);
            const categoryType = category.type || 'Expense';
            const categoryBudget = parseFloat(await this.security.decrypt(category.encrypted_limit));
            
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
                        budgeted: categoryBudgets[type][name] || 0
                    }))
                    .sort((a, b) => b.tracked - a.tracked);
                
                summary[type].total = summary[type].categories.reduce((sum, cat) => sum + cat.tracked, 0);
            }
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
                                const percentage = cat.budgeted > 0 ? (cat.tracked / cat.budgeted * 100).toFixed(1) : 0;
                                const diff = type === 'Income' ? (cat.tracked - cat.budgeted) : (cat.budgeted - cat.tracked);
                                const statusClass = diff < 0 ? 'negative' : 'positive';
                                
                                return `
                                    <div class="details-table-row">
                                        <span class="col-name">
                                            <span class="breakdown-color" style="background: ${colors[index % colors.length]};"></span>
                                            ${cat.name}
                                        </span>
                                        <span class="col-tracked">$${cat.tracked.toFixed(2)}</span>
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
                                    <span class="col-tracked"><strong>$${data.categories.reduce((sum, cat) => sum + cat.tracked, 0).toFixed(2)}</strong></span>
                                    <span class="col-budgeted"><strong>$${data.categories.reduce((sum, cat) => sum + cat.budgeted, 0).toFixed(2)}</strong></span>
                                    <span class="col-percent"></span>
                                    <span class="col-remaining"><strong>${type === 'Income' ? '+' : ''}$${(type === 'Income' ? 
                                        (data.categories.reduce((sum, cat) => sum + cat.tracked, 0) - data.categories.reduce((sum, cat) => sum + cat.budgeted, 0)) :
                                        (data.categories.reduce((sum, cat) => sum + cat.budgeted, 0) - data.categories.reduce((sum, cat) => sum + cat.tracked, 0))
                                    ).toFixed(2)}</strong></span>
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
                            ${data.categories.map((cat, index) => `
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
        
        const total = categories.reduce((sum, cat) => sum + cat.total, 0);
        const colors = this.getCategoryColors(svgId.includes('income') ? 'Income' : 
                                             svgId.includes('saving') ? 'Saving' : 'Expense');
        
        const centerX = 100;
        const centerY = 100;
        const radius = 70;
        const thickness = 25;
        
        console.log(`📊 Rendering donut ${svgId}: ${categories.length} categories`);
        
        if (categories.length === 1) {
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
        
        categories.forEach((cat, index) => {
            const percentage = cat.total / total;
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
}
