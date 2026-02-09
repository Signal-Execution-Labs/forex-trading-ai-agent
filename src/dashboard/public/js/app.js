/**
 * K.I.T. Dashboard Application
 * Main application logic and WebSocket handling
 */

class KITDashboard {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.prices = {};
        this.charts = null;
        
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupTimeframeSelector();
        this.connectWebSocket();
        this.loadInitialData();
        this.charts = new DashboardCharts();
    }

    // Navigation
    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-links li');
        
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const page = link.dataset.page;
                this.navigateTo(page);
            });
        });
    }

    navigateTo(page) {
        // Update nav
        document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
        document.querySelector(`[data-page="${page}"]`).classList.add('active');
        
        // Update pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
        
        // Update title
        const titles = {
            overview: 'Overview',
            positions: 'Open Positions',
            trades: 'Trade History',
            strategies: 'Strategy Performance',
            risk: 'Risk Management'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;
        
        // Load page-specific data
        this.loadPageData(page);
    }

    loadPageData(page) {
        switch(page) {
            case 'overview':
                this.loadPortfolio();
                this.loadPositions();
                break;
            case 'positions':
                this.loadPositions();
                break;
            case 'trades':
                this.loadTrades();
                break;
            case 'strategies':
                this.loadStrategies();
                break;
            case 'risk':
                this.loadRiskMetrics();
                break;
        }
    }

    setupTimeframeSelector() {
        document.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.loadPriceData('BTC/USDT', btn.dataset.tf);
            });
        });
    }

    // WebSocket
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                this.showToast('Connected to K.I.T.', 'success');
            };
            
            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateConnectionStatus(false);
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
        } else {
            this.showToast('Connection lost. Please refresh the page.', 'error');
        }
    }

    updateConnectionStatus(connected) {
        const status = document.getElementById('connectionStatus');
        if (connected) {
            status.classList.add('connected');
            status.querySelector('span:last-child').textContent = 'Connected';
        } else {
            status.classList.remove('connected');
            status.querySelector('span:last-child').textContent = 'Disconnected';
        }
    }

    handleWebSocketMessage(message) {
        switch(message.type) {
            case 'prices':
            case 'priceUpdate':
                this.updatePrices(message.data);
                break;
            case 'tradeExecuted':
                this.handleNewTrade(message.data);
                break;
            case 'positionUpdate':
                this.loadPositions();
                break;
            case 'connected':
                console.log(message.data.message);
                break;
        }
        
        this.updateLastUpdate();
    }

    updatePrices(prices) {
        const ticker = document.getElementById('priceTicker');
        ticker.innerHTML = '';
        
        prices.forEach(p => {
            this.prices[p.symbol] = p;
            
            const item = document.createElement('div');
            item.className = 'ticker-item';
            item.innerHTML = `
                <span class="ticker-symbol">${p.symbol}</span>
                <span class="ticker-price">$${this.formatNumber(p.price)}</span>
                <span class="ticker-change ${p.changePercent >= 0 ? 'positive' : 'negative'}">
                    ${p.changePercent >= 0 ? '+' : ''}${p.changePercent.toFixed(2)}%
                </span>
            `;
            ticker.appendChild(item);
        });

        // Update chart with latest price
        if (this.charts && prices.length > 0) {
            const btcPrice = prices.find(p => p.symbol === 'BTC/USDT');
            if (btcPrice) {
                this.charts.addPricePoint(btcPrice.price);
            }
        }
    }

    handleNewTrade(trade) {
        this.showToast(`Trade executed: ${trade.side.toUpperCase()} ${trade.size.toFixed(4)} ${trade.symbol} @ $${this.formatNumber(trade.price)}`, 'info');
        
        // Refresh trades if on trades page
        if (document.getElementById('page-trades').classList.contains('active')) {
            this.loadTrades();
        }
    }

    // API calls
    async loadInitialData() {
        await Promise.all([
            this.loadPortfolio(),
            this.loadPositions(),
            this.loadStrategies(),
            this.loadPriceData('BTC/USDT', '1h')
        ]);
    }

    async loadPortfolio() {
        try {
            const response = await fetch('/api/portfolio');
            const data = await response.json();
            this.updatePortfolioUI(data);
        } catch (error) {
            console.error('Failed to load portfolio:', error);
        }
    }

    updatePortfolioUI(data) {
        document.getElementById('totalEquity').textContent = `$${this.formatNumber(data.totalEquity)}`;
        
        const unrealizedEl = document.getElementById('unrealizedPnl');
        unrealizedEl.textContent = `${data.unrealizedPnl >= 0 ? '+' : ''}$${this.formatNumber(data.unrealizedPnl)}`;
        unrealizedEl.className = `pnl ${data.unrealizedPnl >= 0 ? 'positive' : 'negative'}`;
        
        const todayPnlEl = document.getElementById('todayPnl');
        todayPnlEl.textContent = `${data.realizedPnlToday >= 0 ? '+' : ''}$${this.formatNumber(data.realizedPnlToday)}`;
        todayPnlEl.style.color = data.realizedPnlToday >= 0 ? 'var(--success)' : 'var(--danger)';
        
        document.getElementById('winRate').textContent = `${(data.winRate * 100).toFixed(1)}%`;
        document.getElementById('sharpeRatio').textContent = data.sharpeRatio.toFixed(2);
        document.getElementById('maxDrawdown').textContent = `${(data.maxDrawdown * 100).toFixed(1)}%`;
        document.getElementById('openPositions').textContent = data.totalPositions;
    }

    async loadPositions() {
        try {
            const response = await fetch('/api/positions');
            const positions = await response.json();
            this.updatePositionsUI(positions);
        } catch (error) {
            console.error('Failed to load positions:', error);
        }
    }

    updatePositionsUI(positions) {
        const tbody = document.getElementById('positionsTable');
        tbody.innerHTML = '';
        
        positions.forEach(pos => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${pos.symbol}</strong></td>
                <td class="side-${pos.side}">${pos.side.toUpperCase()}</td>
                <td>${pos.size.toFixed(4)}</td>
                <td>$${this.formatNumber(pos.entryPrice)}</td>
                <td>$${this.formatNumber(pos.currentPrice)}</td>
                <td class="${pos.pnl >= 0 ? 'pnl positive' : 'pnl negative'}">
                    ${pos.pnl >= 0 ? '+' : ''}$${this.formatNumber(pos.pnl)}
                </td>
                <td class="${pos.pnlPercent >= 0 ? 'pnl positive' : 'pnl negative'}">
                    ${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%
                </td>
                <td>${pos.strategy}</td>
                <td>${this.formatTime(pos.openedAt)}</td>
            `;
            tbody.appendChild(row);
        });

        // Update active strategies count
        const strategies = [...new Set(positions.map(p => p.strategy))];
        document.getElementById('activeStrategies').textContent = strategies.length;
    }

    async loadTrades() {
        try {
            const response = await fetch('/api/trades?limit=50');
            const trades = await response.json();
            this.updateTradesUI(trades);
        } catch (error) {
            console.error('Failed to load trades:', error);
        }
    }

    updateTradesUI(trades) {
        const tbody = document.getElementById('tradesTable');
        tbody.innerHTML = '';
        
        trades.forEach(trade => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.formatTime(trade.executedAt)}</td>
                <td><strong>${trade.symbol}</strong></td>
                <td class="side-${trade.side}">${trade.side.toUpperCase()}</td>
                <td>${trade.size.toFixed(4)}</td>
                <td>$${this.formatNumber(trade.price)}</td>
                <td class="${trade.pnl ? (trade.pnl >= 0 ? 'pnl positive' : 'pnl negative') : ''}">
                    ${trade.pnl ? (trade.pnl >= 0 ? '+' : '') + '$' + this.formatNumber(trade.pnl) : '-'}
                </td>
                <td>$${trade.fee.toFixed(2)}</td>
                <td>${trade.strategy}</td>
            `;
            tbody.appendChild(row);
        });
    }

    async loadStrategies() {
        try {
            const response = await fetch('/api/strategies');
            const strategies = await response.json();
            this.updateStrategiesUI(strategies);
            
            // Update chart
            if (this.charts) {
                this.charts.updatePnlChart(strategies);
            }
        } catch (error) {
            console.error('Failed to load strategies:', error);
        }
    }

    updateStrategiesUI(strategies) {
        const grid = document.getElementById('strategiesGrid');
        grid.innerHTML = '';
        
        strategies.forEach(strat => {
            const card = document.createElement('div');
            card.className = 'strategy-card';
            card.innerHTML = `
                <div class="strategy-header">
                    <span class="strategy-name">${strat.name}</span>
                    <span class="strategy-status ${strat.isActive ? 'active' : 'inactive'}">
                        ${strat.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div class="strategy-stats">
                    <div class="strategy-stat">
                        <span class="stat-label">Total Trades</span>
                        <span class="stat-value">${strat.totalTrades}</span>
                    </div>
                    <div class="strategy-stat">
                        <span class="stat-label">Win Rate</span>
                        <span class="stat-value">${(strat.winRate * 100).toFixed(1)}%</span>
                    </div>
                    <div class="strategy-stat">
                        <span class="stat-label">Total P&L</span>
                        <span class="stat-value ${strat.totalPnl >= 0 ? 'positive' : 'negative'}">
                            ${strat.totalPnl >= 0 ? '+' : ''}$${this.formatNumber(strat.totalPnl)}
                        </span>
                    </div>
                    <div class="strategy-stat">
                        <span class="stat-label">Sharpe Ratio</span>
                        <span class="stat-value">${strat.sharpeRatio.toFixed(2)}</span>
                    </div>
                    <div class="strategy-stat">
                        <span class="stat-label">Max Win</span>
                        <span class="stat-value positive">+$${this.formatNumber(strat.maxWin)}</span>
                    </div>
                    <div class="strategy-stat">
                        <span class="stat-label">Max Loss</span>
                        <span class="stat-value negative">$${this.formatNumber(strat.maxLoss)}</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    async loadRiskMetrics() {
        try {
            const response = await fetch('/api/risk');
            const metrics = await response.json();
            this.updateRiskUI(metrics);
            
            if (this.charts) {
                this.charts.updateRiskGauge(metrics.riskScore);
            }
        } catch (error) {
            console.error('Failed to load risk metrics:', error);
        }
    }

    updateRiskUI(metrics) {
        document.getElementById('riskScoreValue').textContent = metrics.riskScore;
        document.getElementById('portfolioVaR').textContent = `$${this.formatNumber(metrics.portfolioVaR)}`;
        document.getElementById('dailyVaR').textContent = `$${this.formatNumber(metrics.dailyVaR)}`;
        document.getElementById('currentExposure').textContent = `$${this.formatNumber(metrics.currentExposure)}`;
        document.getElementById('marginUsed').textContent = `$${this.formatNumber(metrics.marginUsed)}`;
        document.getElementById('marginAvailable').textContent = `$${this.formatNumber(metrics.marginAvailable)}`;
        document.getElementById('leverageUsed').textContent = `${metrics.leverageUsed.toFixed(1)}x`;
    }

    async loadPriceData(symbol, timeframe) {
        try {
            const response = await fetch(`/api/prices/${encodeURIComponent(symbol)}?timeframe=${timeframe}&limit=100`);
            const prices = await response.json();
            
            if (this.charts) {
                this.charts.updatePriceChart(prices);
            }
        } catch (error) {
            console.error('Failed to load price data:', error);
        }
    }

    // Utilities
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            return num.toFixed(2);
        }
    }

    formatTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    updateLastUpdate() {
        const now = new Date();
        document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = { success: '✓', error: '✕', info: 'ℹ' };
        toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new KITDashboard();
});
