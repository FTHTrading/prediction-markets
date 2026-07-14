// DonKAI Prediction Exchange - Live Linked UI
document.addEventListener('DOMContentLoaded', () => {
    
    // Core Configuration
    const CONFIG = {
        apiBase: 'http://localhost:3388'
    };

    // State Tracker
    const state = {
        selectedMarket: 'fit21',
        selectedSide: 'YES',
        yesOdds: {
            fit21: 0.65,
            fedrate: 0.50
        },
        nettingPools: {
            fit21: { YES: 90000, NO: 15000 },
            fedrate: { YES: 15000, NO: 10000 }
        }
    };

    // DOM Elements
    const wagerAmountInput = document.getElementById('wager-amount');
    const potentialPayoutEl = document.getElementById('potential-payout');
    const avgExecRateEl = document.getElementById('avg-exec-rate');
    const ecnFeeEl = document.getElementById('ecn-fee');
    const placeWagerBtn = document.getElementById('place-wager-btn');
    const ticketMarketId = document.getElementById('ticket-market-id');
    const tabBuyYes = document.getElementById('tab-buy-yes');
    const tabBuyNo = document.getElementById('tab-buy-no');
    
    const nettingPoolPct = document.getElementById('netting-pool-pct');
    const nettingPoolBar = document.getElementById('netting-pool-bar');
    const nettingPoolVal = document.getElementById('netting-pool-val');
    const nettingVisualizerBox = document.getElementById('netting-visualizer-box');

    // Init Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // ------------------------------------------------------------------------
    // Fetch live pool status from Express Server
    // ------------------------------------------------------------------------
    async function fetchPoolStatus() {
        try {
            const res = await fetch(`${CONFIG.apiBase}/api/pool-status`);
            const data = await res.json();
            
            // Sync local state
            state.nettingPools.fit21 = data.markets.fit21;
            state.nettingPools.fedrate = data.markets.fedrate;
            
            updateTicketUI();
        } catch (e) {
            console.warn('[DonKAI API] Server offline. Using fallback simulation data.', e);
        }
    }

    // Start Polling Loop (every 5 seconds)
    fetchPoolStatus();
    setInterval(fetchPoolStatus, 5000);

    // Tab Switcher between YES and NO on Ticket
    tabBuyYes.addEventListener('click', () => {
        state.selectedSide = 'YES';
        tabBuyYes.classList.add('active');
        tabBuyNo.classList.remove('active');
        updateTicketUI();
    });

    tabBuyNo.addEventListener('click', () => {
        state.selectedSide = 'NO';
        tabBuyNo.classList.add('active');
        tabBuyYes.classList.remove('active');
        updateTicketUI();
    });

    // Market Odds Button selections
    const oddsButtons = document.querySelectorAll('.odds-btn');
    oddsButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const siblings = btn.parentElement.querySelectorAll('.odds-btn');
            siblings.forEach(s => s.classList.remove('active'));
            
            btn.classList.add('active');
            
            state.selectedMarket = btn.dataset.market;
            state.selectedSide = btn.dataset.side;
            
            ticketMarketId.textContent = state.selectedMarket.toUpperCase() + '-CONTRACT';
            
            if (state.selectedSide === 'YES') {
                tabBuyYes.classList.add('active');
                tabBuyNo.classList.remove('active');
            } else {
                tabBuyNo.classList.add('active');
                tabBuyYes.classList.remove('active');
            }

            updateTicketUI();
        });
    });

    wagerAmountInput.addEventListener('input', updateTicketUI);

    function updateTicketUI() {
        const wager = parseFloat(wagerAmountInput.value) || 0;
        
        // 1. Get Odds Rate
        const yesOdds = state.yesOdds[state.selectedMarket];
        const odds = state.selectedSide === 'YES' ? yesOdds : (1 - yesOdds);
        
        // 2. Calculations
        const shares = wager / odds;
        const potentialPayout = shares;
        const ecnFee = wager * 0.0025;

        // 3. Update Text
        avgExecRateEl.textContent = `$${odds.toFixed(2)} / share`;
        potentialPayoutEl.textContent = `$${potentialPayout.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDC`;
        ecnFeeEl.textContent = `$${ecnFee.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDC`;

        // 4. Update Netting Visualizer & Account Routing Status
        if (wager >= 100000) {
            nettingVisualizerBox.style.background = 'rgba(0, 242, 254, 0.05)';
            nettingVisualizerBox.style.borderColor = 'rgba(0, 242, 254, 0.2)';
            nettingPoolPct.textContent = 'Scenario A';
            nettingPoolBar.style.width = '100%';
            nettingPoolBar.style.background = 'var(--accent-cyan)';
            nettingPoolVal.parentElement.innerHTML = `💸 Large block trade matches **Scenario A (Direct Institutional)**. Will route directly to dedicated BitGo Child Enterprise.`;
        } else {
            nettingVisualizerBox.style.background = 'rgba(157, 78, 221, 0.05)';
            nettingVisualizerBox.style.borderColor = 'rgba(157, 78, 221, 0.2)';
            nettingPoolBar.style.background = 'linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))';
            
            const marketPool = state.nettingPools[state.selectedMarket];
            const currentNetVal = Math.abs(marketPool.YES - marketPool.NO);
            const newNetVal = currentNetVal + wager;
            const pct = Math.min(100, (newNetVal / 100000) * 100);
            
            nettingPoolPct.textContent = `${pct.toFixed(0)}% Full`;
            nettingPoolBar.style.width = `${pct}%`;
            
            if (newNetVal >= 100000) {
                nettingPoolVal.parentElement.innerHTML = `⚡ Current net pool: **$${newNetVal.toLocaleString()}**. **Threshold Crossed!** Placing this wager triggers immediate BitGo OTC Block execution.`;
            } else {
                nettingPoolVal.parentElement.innerHTML = `Current net pool: **$${currentNetVal.toLocaleString()}** (Est. New: $${newNetVal.toLocaleString()}). Wager will queue internally. Crosses the $100k threshold at next transaction.`;
            }
        }

        tabBuyYes.textContent = `BUY YES ($${yesOdds.toFixed(2)})`;
        tabBuyNo.textContent = `BUY NO ($${(1 - yesOdds).toFixed(2)})`;
    }

    // Place Wager Click Handler (Dynamic API post)
    placeWagerBtn.addEventListener('click', async () => {
        const wager = parseFloat(wagerAmountInput.value) || 0;
        if (wager <= 0) {
            showToast('Please enter a valid wager amount', 'error');
            return;
        }

        try {
            placeWagerBtn.disabled = true;
            placeWagerBtn.textContent = 'Processing Wager...';

            const payload = {
                userId: 'usr_donkai_retail_demo',
                name: 'Anonymous Trader',
                side: state.selectedSide,
                amount: wager,
                market: state.selectedMarket
            };

            const res = await fetch(`${CONFIG.apiBase}/api/wager`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (result.success) {
                if (result.blockExecuted) {
                    showToast(`🎉 OTC BLOCK TRADE DISPATCHED! $${result.blockDetails.amount.toLocaleString()} USDC cleared via Susquehanna ECN!`, 'success');
                } else {
                    showToast(`Wager of $${wager.toLocaleString()} USDC placed successfully! Queued in Netting Pool.`, 'success');
                }
                
                // Update local pool state immediately
                state.nettingPools.fit21 = result.allStats.fit21;
                state.nettingPools.fedrate = result.allStats.fedrate;
                updateTicketUI();
            } else {
                showToast(`Error: ${result.message}`, 'error');
            }
        } catch (e) {
            console.error('Wager placement failed:', e);
            showToast('API Connection Error. Trade processed on client simulation.', 'error');
            
            // Client fallback execution logic if server is starting/restarting
            if (wager < 100000) {
                state.nettingPools[state.selectedMarket][state.selectedSide] += wager;
            }
            updateTicketUI();
        } finally {
            placeWagerBtn.disabled = false;
            placeWagerBtn.textContent = 'Place Event Wager';
        }
    });

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast-notif');
        if (!toast) return;
        
        toast.textContent = message;
        if (type === 'error') {
            toast.style.borderColor = 'var(--accent-red)';
            toast.style.boxShadow = '0 10px 30px rgba(255, 56, 56, 0.15)';
        } else {
            toast.style.borderColor = 'var(--accent-cyan)';
            toast.style.boxShadow = '0 10px 30px rgba(0, 242, 254, 0.15)';
        }
        
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    updateTicketUI();
});
