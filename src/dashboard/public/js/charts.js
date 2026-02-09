/**
 * K.I.T. Dashboard Charts
 * Chart.js configurations and updates
 */

class DashboardCharts {
    constructor() {
        this.portfolioChart = null;
        this.pnlChart = null;
        this.priceChart = null;
        this.riskGauge = null;
        this.priceData = [];
        
        this.initCharts();
    }

    initCharts() {
        this.initPortfolioChart();
        this.initPnlChart();
        this.initPriceChart();
        this.initRiskGauge();
    }

    getChartDefaults() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#9ca3af',
                        font: { family: 'Inter', size: 12 }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(55, 65, 81, 0.5)' },
                    ticks: { color: '#9ca3af' }
                },
                y: {
                    grid: { color: 'rgba(55, 65, 81, 0.5)' },
                    ticks: { color: '#9ca3af' }
                }
            }
        };
    }

    initPortfolioChart() {
        const ctx = document.getElementById('portfolioChart');
        if (!ctx) return;

        // Generate sample portfolio data
        const labels = [];
        const data = [];
        let value = 100000;
        
        for (let i = 30; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            value = value * (1 + (Math.random() - 0.45) * 0.03);
            data.push(value);
        }

        this.portfolioChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Portfolio Value',
                    data,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#3b82f6'
                }]
            },
            options: {
                ...this.getChartDefaults(),
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1a2332',
                        borderColor: '#374151',
                        borderWidth: 1,
                        titleColor: '#f3f4f6',
                        bodyColor: '#9ca3af',
                        callbacks: {
                            label: (ctx) => `$${ctx.raw.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    ...this.getChartDefaults().scales,
                    y: {
                        ...this.getChartDefaults().scales.y,
                        ticks: {
                            color: '#9ca3af',
                            callback: (value) => '$' + (value / 1000).toFixed(0) + 'K'
                        }
                    }
                }
            }
        });
    }

    initPnlChart() {
        const ctx = document.getElementById('pnlChart');
        if (!ctx) return;

        this.pnlChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['TrendFollower', 'Momentum', 'MeanReversion', 'RSI', 'MACD'],
                datasets: [{
                    data: [8432, 12847, 4521, 3892, 6234],
                    backgroundColor: [
                        '#3b82f6',
                        '#10b981',
                        '#8b5cf6',
                        '#f59e0b',
                        '#22d3ee'
                    ],
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#9ca3af',
                            padding: 16,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1a2332',
                        borderColor: '#374151',
                        borderWidth: 1,
                        callbacks: {
                            label: (ctx) => `${ctx.label}: $${ctx.raw.toLocaleString()}`
                        }
                    }
                }
            }
        });
    }

    initPriceChart() {
        const ctx = document.getElementById('priceChart');
        if (!ctx) return;

        this.priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'BTC/USDT',
                    data: [],
                    borderColor: '#22d3ee',
                    backgroundColor: 'rgba(34, 211, 238, 0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2
                }]
            },
            options: {
                ...this.getChartDefaults(),
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1a2332',
                        borderColor: '#374151',
                        borderWidth: 1,
                        titleColor: '#f3f4f6',
                        bodyColor: '#9ca3af',
                        callbacks: {
                            title: (ctx) => new Date(ctx[0].parsed.x).toLocaleString(),
                            label: (ctx) => `$${ctx.raw.y.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'hour',
                            displayFormats: { hour: 'HH:mm' }
                        },
                        grid: { color: 'rgba(55, 65, 81, 0.5)' },
                        ticks: { color: '#9ca3af', maxRotation: 0 }
                    },
                    y: {
                        grid: { color: 'rgba(55, 65, 81, 0.5)' },
                        ticks: {
                            color: '#9ca3af',
                            callback: (value) => '$' + value.toLocaleString()
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    initRiskGauge() {
        const ctx = document.getElementById('riskGauge');
        if (!ctx) return;

        this.riskGauge = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [35, 65],
                    backgroundColor: [
                        this.getRiskColor(35),
                        'rgba(55, 65, 81, 0.3)'
                    ],
                    borderWidth: 0,
                    circumference: 270,
                    rotation: 225
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }

    getRiskColor(score) {
        if (score < 30) return '#10b981'; // Green - Low risk
        if (score < 60) return '#f59e0b'; // Yellow - Medium risk
        return '#ef4444'; // Red - High risk
    }

    updatePriceChart(prices) {
        if (!this.priceChart) return;

        this.priceData = prices.map(p => ({
            x: p.time,
            y: p.close
        }));

        this.priceChart.data.datasets[0].data = this.priceData;
        this.priceChart.update('none');
    }

    addPricePoint(price) {
        if (!this.priceChart || this.priceData.length === 0) return;

        // Update last point or add new one
        const now = Date.now();
        const lastPoint = this.priceData[this.priceData.length - 1];
        
        if (now - lastPoint.x < 60000) {
            // Update last point if within 1 minute
            lastPoint.y = price;
        } else {
            // Add new point
            this.priceData.push({ x: now, y: price });
            
            // Keep last 100 points
            if (this.priceData.length > 100) {
                this.priceData.shift();
            }
        }

        this.priceChart.data.datasets[0].data = this.priceData;
        this.priceChart.update('none');
    }

    updatePnlChart(strategies) {
        if (!this.pnlChart) return;

        const labels = strategies.map(s => s.name);
        const data = strategies.map(s => Math.abs(s.totalPnl));
        const colors = strategies.map((s, i) => {
            const baseColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#22d3ee', '#ec4899'];
            return baseColors[i % baseColors.length];
        });

        this.pnlChart.data.labels = labels;
        this.pnlChart.data.datasets[0].data = data;
        this.pnlChart.data.datasets[0].backgroundColor = colors;
        this.pnlChart.update();
    }

    updateRiskGauge(score) {
        if (!this.riskGauge) return;

        const color = this.getRiskColor(score);
        
        this.riskGauge.data.datasets[0].data = [score, 100 - score];
        this.riskGauge.data.datasets[0].backgroundColor = [color, 'rgba(55, 65, 81, 0.3)'];
        this.riskGauge.update();

        // Update value display
        const valueEl = document.getElementById('riskScoreValue');
        if (valueEl) {
            valueEl.textContent = score;
            valueEl.style.color = color;
        }
    }

    updatePortfolioChart(data) {
        if (!this.portfolioChart) return;

        this.portfolioChart.data.labels = data.labels;
        this.portfolioChart.data.datasets[0].data = data.values;
        this.portfolioChart.update();
    }

    destroy() {
        [this.portfolioChart, this.pnlChart, this.priceChart, this.riskGauge].forEach(chart => {
            if (chart) chart.destroy();
        });
    }
}

// Make available globally
window.DashboardCharts = DashboardCharts;
