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

    // Leverage and Collateral Elements
    const collateralSelect = document.getElementById('collateral-select');
    const leverageSelect = document.getElementById('leverage-select');
    const leverageValLabel = document.getElementById('leverage-val-label');
    const collateralNetValEl = document.getElementById('collateral-net-val');
    const dailyStakingYieldEl = document.getElementById('daily-staking-yield');
    const liqBarrierRow = document.getElementById('liq-barrier-row');
    const liqBarrierValEl = document.getElementById('liq-barrier-val');

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
    collateralSelect.addEventListener('change', updateTicketUI);
    leverageSelect.addEventListener('input', () => {
        const val = leverageSelect.value;
        leverageValLabel.textContent = val === '1' ? '1x (No Leverage)' : `${val}x Leverage`;
        updateTicketUI();
    });

    function updateTicketUI() {
        const amount = parseFloat(wagerAmountInput.value) || 0;
        
        // 1. Collateral Haircut Calculations
        let factor = 1.0;
        const collateralType = collateralSelect.value;
        if (collateralType === 'SOL') factor = 0.85;
        else if (collateralType === 'BTC') factor = 0.90;
        else if (collateralType === 'DIGau') factor = 0.90;

        const netCollateralValue = amount * factor;
        collateralNetValEl.textContent = `$${netCollateralValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDC`;

        // 2. Leverage and Position Size
        const leverage = parseInt(leverageSelect.value) || 1;
        const positionSize = netCollateralValue * leverage;

        // 3. Get Odds Rate
        const yesOdds = state.yesOdds[state.selectedMarket];
        const odds = state.selectedSide === 'YES' ? yesOdds : (1 - yesOdds);
        
        // 4. Position Payout calculations
        const shares = positionSize / odds;
        const potentialPayout = shares;
        const ecnFee = positionSize * 0.0025;

        // 5. Daily Staking Yield (4.5% APR on collateral margin value)
        const dailyYield = netCollateralValue * 0.045 / 365;
        dailyStakingYieldEl.textContent = `$${dailyYield.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDC / day`;

        // 6. Leverage Liquidation Barrier Calculations
        if (leverage > 1) {
            liqBarrierRow.style.display = 'flex';
            // Price drop where margin is fully depleted (10% maintenance margin)
            const liqBarrier = odds * (1 - 0.90 / leverage);
            liqBarrierValEl.textContent = `$${liqBarrier.toFixed(2)}`;
        } else {
            liqBarrierRow.style.display = 'none';
        }

        // 7. Update Text Display
        avgExecRateEl.textContent = `$${odds.toFixed(2)} / share`;
        potentialPayoutEl.textContent = `$${potentialPayout.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDC`;
        ecnFeeEl.textContent = `$${ecnFee.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDC`;

        // 8. Update Netting Visualizer & Account Routing Status (based on total position size)
        if (positionSize >= 100000) {
            nettingVisualizerBox.style.background = 'rgba(0, 242, 254, 0.05)';
            nettingVisualizerBox.style.borderColor = 'rgba(0, 242, 254, 0.2)';
            nettingPoolPct.textContent = 'Scenario A';
            nettingPoolBar.style.width = '100%';
            nettingPoolBar.style.background = 'var(--accent-cyan)';
            nettingPoolVal.parentElement.innerHTML = `💸 Total position ($${positionSize.toLocaleString()}) matches **Scenario A (Direct Institutional)**. Sweeps directly to dedicated BitGo Child Enterprise.`;
        } else {
            nettingVisualizerBox.style.background = 'rgba(157, 78, 221, 0.05)';
            nettingVisualizerBox.style.borderColor = 'rgba(157, 78, 221, 0.2)';
            nettingPoolBar.style.background = 'linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))';
            
            const marketPool = state.nettingPools[state.selectedMarket];
            const currentNetVal = Math.abs(marketPool.YES - marketPool.NO);
            const newNetVal = currentNetVal + positionSize;
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

    // ------------------------------------------------------------------------
    // --- HTML5 Guided Audio Tour (Speech Synthesis System) ---
    // ------------------------------------------------------------------------
    const playBtn = document.getElementById('audio-play-btn');
    const stopBtn = document.getElementById('audio-stop-btn');
    const voiceSelect = document.getElementById('voice-select');
    const speedSelect = document.getElementById('speed-select');
    const equalizer = document.getElementById('equalizer-bars');
    const narrativeBlocks = document.querySelectorAll('.narrative-block');

    let synth = window.speechSynthesis;
    let voices = [];
    let currentUtterance = null;
    let currentReadingIndex = -1;
    let isPlaying = false;
    let isPaused = false;

    function populateVoices() {
        if (!synth) return;
        voices = synth.getVoices();
        voiceSelect.innerHTML = '<option value="">Default System Voice</option>';
        
        // Filter for English speaking voices or fallback
        const englishVoices = voices.filter(v => v.lang.includes('en'));
        const targetList = englishVoices.length > 0 ? englishVoices : voices;

        targetList.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            voiceSelect.appendChild(option);
        });
    }

    // Chrome loads voices asynchronously
    populateVoices();
    if (synth && synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = populateVoices;
    }

    function readBlock(index) {
        if (!synth || index >= narrativeBlocks.length) {
            resetAudioState();
            return;
        }

        currentReadingIndex = index;
        const block = narrativeBlocks[index];
        const text = block.querySelector('p').textContent;

        // Reset highlights
        narrativeBlocks.forEach(b => b.classList.remove('reading-active'));
        block.classList.add('reading-active');

        // Create Utterance
        currentUtterance = new SpeechSynthesisUtterance(text);
        
        // Set Speed/Rate
        currentUtterance.rate = parseFloat(speedSelect.value) || 1.0;

        // Set Voice
        const selectedVoiceName = voiceSelect.value;
        if (selectedVoiceName) {
            const voice = voices.find(v => v.name === selectedVoiceName);
            if (voice) currentUtterance.voice = voice;
        }

        currentUtterance.onstart = () => {
            isPlaying = true;
            playBtn.innerHTML = '<i data-lucide="pause" style="width: 14px; height: 14px;"></i> Pause Tour';
            if (window.lucide) window.lucide.createIcons();
            equalizer.classList.add('playing');
            stopBtn.disabled = false;
        };

        currentUtterance.onend = () => {
            block.classList.remove('reading-active');
            if (isPlaying) {
                readBlock(index + 1);
            }
        };

        currentUtterance.onerror = (e) => {
            console.error('Speech synthesis error:', e);
            resetAudioState();
        };

        synth.speak(currentUtterance);
    }

    function resetAudioState() {
        if (synth) {
            synth.cancel();
        }
        isPlaying = false;
        isPaused = false;
        currentReadingIndex = -1;
        currentUtterance = null;
        
        narrativeBlocks.forEach(b => b.classList.remove('reading-active'));
        equalizer.classList.remove('playing');
        playBtn.innerHTML = '<i data-lucide="play" style="width: 14px; height: 14px;"></i> Listen Guided Tour';
        if (window.lucide) window.lucide.createIcons();
        stopBtn.disabled = true;
    }

    playBtn.addEventListener('click', () => {
        if (!synth) {
            showToast('Text-to-Speech is not supported in this browser.', 'error');
            return;
        }

        if (isPlaying) {
            if (isPaused) {
                synth.resume();
                isPaused = false;
                equalizer.classList.add('playing');
                playBtn.innerHTML = '<i data-lucide="pause" style="width: 14px; height: 14px;"></i> Pause Tour';
                if (window.lucide) window.lucide.createIcons();
            } else {
                synth.pause();
                isPaused = true;
                equalizer.classList.remove('playing');
                playBtn.innerHTML = '<i data-lucide="play" style="width: 14px; height: 14px;"></i> Resume Tour';
                if (window.lucide) window.lucide.createIcons();
            }
        } else {
            resetAudioState();
            readBlock(0);
        }
    });

    stopBtn.addEventListener('click', () => {
        resetAudioState();
    });

    // Speed or Voice change resets speech to pick up new properties
    speedSelect.addEventListener('change', () => {
        if (isPlaying && currentReadingIndex !== -1) {
            const currentIdx = currentReadingIndex;
            resetAudioState();
            readBlock(currentIdx);
        }
    });

    voiceSelect.addEventListener('change', () => {
        if (isPlaying && currentReadingIndex !== -1) {
            const currentIdx = currentReadingIndex;
            resetAudioState();
            readBlock(currentIdx);
        }
    });

    // Handle page unload to stop any running audio
    window.addEventListener('beforeunload', () => {
        if (synth) synth.cancel();
    });

    updateTicketUI();
});
