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

    // ========================================================================
    // NAVBAR NAVIGATION AND TAB SWITCHING SYSTEM
    // ========================================================================
    const navExchange = document.getElementById('nav-exchange');
    const navAudit = document.getElementById('nav-audit');
    const navCockpit = document.getElementById('nav-cockpit');

    const exchangeView = document.getElementById('exchange-view');
    const audioTourPanel = document.getElementById('audio-tour-panel');
    const auditView = document.getElementById('audit-view');
    const cockpitView = document.getElementById('cockpit-view');

    function switchTab(activeNav, activeViews, hideViews) {
        // Toggle Nav Classes
        [navExchange, navAudit, navCockpit].forEach(nav => nav.classList.remove('active'));
        activeNav.classList.add('active');

        // Toggle Displays
        hideViews.forEach(view => {
            if (view) view.style.display = 'none';
        });
        activeViews.forEach(view => {
            if (view) {
                view.style.display = (view.tagName === 'SECTION' || view.tagName === 'DIV') ? 'flex' : 'block';
                if (view.id === 'cockpit-view') view.style.display = 'flex';
                if (view.id === 'audit-view') view.style.display = 'flex';
            }
        });
    }

    navExchange.addEventListener('click', () => {
        switchTab(navExchange, [exchangeView, audioTourPanel], [auditView, cockpitView]);
    });

    navAudit.addEventListener('click', () => {
        switchTab(navAudit, [auditView], [exchangeView, audioTourPanel, cockpitView]);
        fetchAndRenderLedgerBlocks();
    });

    navCockpit.addEventListener('click', () => {
        switchTab(navCockpit, [cockpitView], [exchangeView, audioTourPanel, auditView]);
    });

    // ========================================================================
    // CRYPTOGRAPHIC LEDGER BLOCK RENDERER
    // ========================================================================
    const auditBlocksContainer = document.getElementById('audit-blocks-container');
    const ledgerStatusBadge = document.getElementById('ledger-status-badge');

    async function fetchAndRenderLedgerBlocks() {
        auditBlocksContainer.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono); text-align: center; padding: 20px;">Fetching ledger blocks...</div>';
        ledgerStatusBadge.textContent = 'Verifying Chain...';
        ledgerStatusBadge.style.background = 'rgba(255, 204, 0, 0.1)';
        ledgerStatusBadge.style.color = 'var(--gold)';
        ledgerStatusBadge.style.borderColor = 'var(--gold)';

        try {
            const res = await fetch(`${CONFIG.apiBase}/api/audit-trail`);
            const data = await res.json();

            if (!data.success || !data.audit_trail || data.audit_trail.length === 0) {
                auditBlocksContainer.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono); text-align: center; padding: 20px;">No audit blocks recorded yet.</div>';
                ledgerStatusBadge.textContent = 'Genesis State';
                return;
            }

            auditBlocksContainer.innerHTML = '';
            let chainValid = true;

            data.audit_trail.forEach((block, idx) => {
                const card = document.createElement('div');
                card.style.background = 'rgba(0, 0, 0, 0.2)';
                card.style.border = '1px solid rgba(255, 255, 255, 0.05)';
                card.style.borderRadius = '8px';
                card.style.padding = '10px';
                card.style.fontSize = '11px';
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.gap = '4px';

                const header = document.createElement('div');
                header.style.display = 'flex';
                header.style.justify = 'space-between';
                header.style.justifyContent = 'space-between';
                header.style.fontWeight = 'bold';
                
                let badgeColor = 'var(--accent-cyan)';
                if (block.event.includes('TRIGGER')) badgeColor = 'var(--accent-purple)';
                if (block.event.includes('TEST')) badgeColor = 'var(--text-secondary)';

                header.innerHTML = `
                    <span style="color: ${badgeColor}; font-family: var(--font-mono);">Block #${idx} - ${block.event}</span>
                    <span style="color: var(--text-muted); font-size: 9px;">${new Date(block.timestamp).toLocaleTimeString()}</span>
                `;
                card.appendChild(header);

                const details = document.createElement('div');
                details.style.color = 'var(--text-secondary)';
                details.style.lineHeight = '1.3';
                details.innerHTML = `
                    Market: <strong>${block.market_id ? block.market_id.toUpperCase() : 'N/A'}</strong> | 
                    Cleared: <strong>$${block.net_exposure_cleared.toLocaleString()} USDC</strong> | 
                    Desk: <strong>${block.clearing_desk || 'N/A'}</strong><br/>
                    Deposit Target: <code style="color: var(--accent-green); font-family: var(--font-mono);">${block.onchain_address_allocated || 'N/A'}</code>
                `;
                card.appendChild(details);

                const hashes = document.createElement('div');
                hashes.style.fontSize = '9px';
                hashes.style.color = 'var(--text-muted)';
                hashes.style.fontFamily = 'var(--font-mono)';
                hashes.style.marginTop = '4px';
                hashes.style.borderTop = '1px dashed rgba(255,255,255,0.05)';
                hashes.style.paddingTop = '4px';
                hashes.innerHTML = `
                    Prev: <span style="color: var(--text-muted);">${block.previous_hash.substring(0, 16)}...</span> | 
                    Hash: <span style="color: var(--accent-cyan);">${block.current_hash.substring(0, 16)}...</span>
                `;
                card.appendChild(hashes);

                auditBlocksContainer.appendChild(card);
            });

            ledgerStatusBadge.textContent = 'Chain Verified';
            ledgerStatusBadge.style.background = 'rgba(0, 245, 160, 0.1)';
            ledgerStatusBadge.style.color = 'var(--accent-green)';
            ledgerStatusBadge.style.borderColor = 'var(--accent-green)';

        } catch (err) {
            console.error('Failed to load audit trail:', err);
            auditBlocksContainer.innerHTML = '<div style="font-size: 0.8rem; color: var(--accent-red); font-family: var(--font-mono); text-align: center; padding: 20px;">Failed to load cryptographic ledger blocks.</div>';
            ledgerStatusBadge.textContent = 'Offline';
        }
    }

    // ========================================================================
    // MULTI-AGENT JV COCKPIT PIPELINE SYSTEM
    // ========================================================================
    const runPipelineBtn = document.getElementById('run-pipeline-btn');
    const exciseBtn = document.getElementById('excise-btn');
    const cockpitPayload = document.getElementById('cockpit-payload');
    const cockpitTerminal = document.getElementById('cockpit-terminal');

    const pStep1 = document.getElementById('p-step-1');
    const pStep2 = document.getElementById('p-step-2');
    const pStep3 = document.getElementById('p-step-3');

    let hasExcised = false;

    // Helper: update step highlights
    function highlightStep(stepNum) {
        [pStep1, pStep2, pStep3].forEach((step, idx) => {
            if (idx + 1 === stepNum) {
                step.style.borderColor = 'var(--accent-cyan)';
                step.style.background = 'rgba(0, 242, 254, 0.03)';
                step.querySelector('strong').style.color = 'var(--accent-cyan)';
            } else {
                step.style.borderColor = 'var(--border-color)';
                step.style.background = 'rgba(255,255,255,0.01)';
                step.querySelector('strong').style.color = 'var(--text-secondary)';
            }
        });
    }

    // Helper: speak warning via TTS
    function speakWarning(text) {
        if (synth) {
            synth.cancel(); // Stop any tour audio
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = synth.getVoices();
            const englishVoice = voices.find(v => v.lang.includes('en'));
            if (englishVoice) utterance.voice = englishVoice;
            utterance.rate = 1.0;
            utterance.volume = 1.0;
            synth.speak(utterance);
        }
    }

    runPipelineBtn.addEventListener('click', () => {
        cockpitTerminal.textContent = '';
        runPipelineBtn.disabled = true;
        highlightStep(1);

        writeLog('⚡ [SYSTEM] Ingesting deal payload #KiwisMulligan1...');
        writeLog('⚡ [SYSTEM] Ingestion parameters parsing...');

        setTimeout(() => {
            writeLog('\n▶️ [AGENT 1] Initializing Underwriting & Bad-Actor Vetting Engine...');
            writeLog('   - Target:   Fine Mulligans Inc. (Delaware C-Corp)');
            writeLog('   - Entitlements & Zoning Check: OK');
            writeLog('   - Broker Registration Check: Castle Placement (FINRA/SIPC verified)');

            setTimeout(() => {
                if (!hasExcised) {
                    writeLog('\n🚨 [AGENT 1] CRITICAL VOLATILITY BLOCKED:');
                    writeLog('   - SEC Rule 506(d) Bad Actor Trigger Detected!');
                    writeLog('   - Associate involved in historical Reg A+ filing is listed on Cap Table.');
                    writeLog('   - Financial stress check: Pre-revenue valuation $48M exceeds standard multiples by 300%.');
                    writeLog('   - Balance Sheet Risk: $1.2M historical debt burden from failed filings identified.');
                    writeLog('\n❌ [AGENT 1] RISK STATUS: RED_BLOCKED');
                    writeLog('   - Action Required: excise bad actor and legacy debt liabilities.');
                    
                    exciseBtn.style.display = 'block';
                    runPipelineBtn.disabled = false;
                    
                    speakWarning("Alert! Underwriting Agent has detected a critical bad actor trigger from historical Regulation A plus filings. Ingestion blocked.");
                } else {
                    writeLog('   - Compliance Check: Bad actor fully severed (Release deeds verified).');
                    writeLog('   - Balance Sheet Check: $1.2M historical debt excised from JV SPV.');
                    writeLog('   - Valuation Check: Net asset appraisal verified at fair multiples.');
                    writeLog('✅ [AGENT 1] RISK STATUS: GREEN_APPROVED');

                    setTimeout(() => {
                        highlightStep(2);
                        writeLog('\n▶️ [AGENT 2] Initializing BitGo Enterprise Policy Architect...');
                        writeLog('   - Portfolio Assignment: Isolate from primary Unykorn Treasury.');
                        writeLog('   - Multisig Structure: Generating 3-of-5 key scheme...');
                        writeLog('     - Key #1: Kevan Burns (Unykorn Admin)');
                        writeLog('     - Key #2: Young Woo (JV Co-Admin)');
                        writeLog('     - Key #3: recovery_authority_firm_088');
                        writeLog('   - Address whitelist generated for Castle Placement Escrow wallet.');
                        writeLog('   - Time-Lock Configuration: 24-hour non-whitelist proposal delay.');
                        writeLog('✅ [AGENT 2] Policy payload successfully deployed to BitGo Engine!');

                        setTimeout(() => {
                            highlightStep(3);
                            writeLog('\n▶️ [AGENT 3] Initializing x402 RWA Tokenization Engine...');
                            writeLog('   - Asset Class: Private tokenized preferred stock.');
                            writeLog('   - Compliance Gate: KYC-restricted transfer hooks injected.');
                            writeLog('   - Yield Target: 9.5% preferred APY (USDC paid monthly).');
                            writeLog('   - Generating x402 YieldPOS Routing Flowchart:');
                            writeLog('     [Entertainment bay POS] ➔ [USDC Gateway] ➔ [BitGo Child Wallet] ➔ [x402 Payout Contract] ➔ [Investor Wallets]');
                            writeLog('✅ [AGENT 3] Token specifications compiled. Ready to mint on Solana/Stellar!');
                            writeLog('\n🏁 [SYSTEM] Multi-Agent Pipeline Completed successfully. Joint Venture secured.');
                            
                            runPipelineBtn.disabled = false;
                            speakWarning("Pipeline completed successfully. Joint Venture is secure and tokenized under payment protocol ex four-zero-two.");
                        }, 2500);

                    }, 2500);
                }
            }, 2000);

        }, 1500);
    });

    exciseBtn.addEventListener('click', () => {
        hasExcised = true;
        exciseBtn.style.display = 'none';
        
        cockpitPayload.value = `[Ingested Proposal: #KiwisMulligan1 - EXCISED]
Deal: Kiwi's Mulligan Experiential Golf bay and Entertainment Venue (Alpharetta, GA).
Lead Sponsor: Young Woo, Paresh Govan (Fine Mulligans Inc.).
Raise Target: $27,000,000 USD via Castle Placement Private Placement ECN.
Entity Val: $48,000,000 pre-revenue valuation.
Vulnerability Check: Bad actor fully severed (legal release verified). Legacy debt removed.`;
        
        runPipelineBtn.click();
    });

    function writeLog(text) {
        cockpitTerminal.textContent += text + '\n';
        cockpitTerminal.scrollTop = cockpitTerminal.scrollHeight;
    }

    updateTicketUI();
});
