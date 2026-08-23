document.addEventListener('DOMContentLoaded', () => {
    let currentMode = 'basic'; 
    let tradeDirection = 'buy';

    // Inputs
    const accountInput = document.getElementById('accountSize');
    const riskInput = document.getElementById('riskPercent');
    const riskGroup = document.getElementById('riskGroup');
    const pairSelect = document.getElementById('assetPair');
    const entryInput = document.getElementById('entryPrice');
    const plannedProfitInput = document.getElementById('plannedProfit');
    const basicLotSelect = document.getElementById('basicLotSelect');
    const slInput = document.getElementById('slPrice');
    const tpInput = document.getElementById('tpPrice');

    // Controls
    const btnBasic = document.getElementById('btnBasic');
    const btnAdvanced = document.getElementById('btnAdvanced');
    const btnBuy = document.getElementById('btnBuy');
    const btnSell = document.getElementById('btnSell');

    // Metrics
    const mCashRisk = document.getElementById('mCashRisk');
    const mSlInfo = document.getElementById('mSlInfo');
    const mTpInfo = document.getElementById('mTpInfo');
    const mLotSize = document.getElementById('mLotSize');
    const mTripProfit = document.getElementById('mTripProfit');
    const mBreakEven = document.getElementById('mBreakEven');
    const mRrRatio = document.getElementById('mRrRatio');

    // 1. Mobile Keyboard "Next" (Enter Key) Navigation
    const navInputs = [accountInput, riskInput, entryInput, plannedProfitInput, slInput, tpInput];
    
    navInputs.forEach(input => {
        input.addEventListener('keydown', function(e) {
            // Trigger on Enter key
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault(); 
                let nextTarget = null;
                
                // Determine the next logical input based on mode
                if (this === accountInput) {
                    nextTarget = currentMode === 'basic' ? entryInput : riskInput;
                } else if (this === riskInput) {
                    nextTarget = entryInput;
                } else if (this === entryInput) {
                    nextTarget = currentMode === 'basic' ? plannedProfitInput : slInput;
                } else if (this === slInput) {
                    nextTarget = tpInput;
                }
                
                // Move focus to the next target, or hide keyboard if done
                if (nextTarget) {
                    nextTarget.focus();
                } else {
                    this.blur(); 
                }
            }
        });
    });

    // 2. Entry Price Hint Logic
    function updateEntryPlaceholder() {
        const selected = pairSelect.options[pairSelect.selectedIndex];
        const entryHint = selected.getAttribute('data-entry-hint') || 'e.g., 1.10500';

        entryInput.classList.add('hint-fade');
        setTimeout(() => {
            entryInput.placeholder = entryHint;
            entryInput.classList.remove('hint-fade');
        }, 1500); // Matches the new 1.5s CSS transition
    }

    pairSelect.addEventListener('change', () => {
        updateEntryPlaceholder();
        calculate();
    });

    // 3. Dynamic Planned Profit Independent Animation
    let profitIndex = 0;
    let profitTimer = null;

    function getDynamicProfitHints() {
        const accountSize = parseFloat(accountInput.value) || 10000;
        // Generate realistic targets: 1%, 2%, 3%, 5% of account balance
        const percentages = [0.01, 0.02, 0.03, 0.05];
        
        return percentages.map(p => {
            let val = accountSize * p;
            // Rounding logic for clean numbers
            if (val >= 100) val = Math.round(val / 10) * 10;
            else if (val >= 10) val = Math.round(val);
            else val = Number(val.toFixed(2));
            return `e.g., ${val}`;
        });
    }

    function cycleProfitHint() {
        const hints = getDynamicProfitHints();
        
        plannedProfitInput.classList.add('hint-fade');
        
        // Wait for the fade-out to complete (1.5s), change text, then fade back in
        setTimeout(() => {
            profitIndex = (profitIndex + 1) % hints.length;
            plannedProfitInput.placeholder = hints[profitIndex];
            plannedProfitInput.classList.remove('hint-fade');
        }, 1500); 
    }

    function startProfitTimer() {
        if (!profitTimer && plannedProfitInput.value === '') {
            // Set first hint immediately upon starting, then cycle every 5 seconds
            plannedProfitInput.placeholder = getDynamicProfitHints()[0];
            profitTimer = setInterval(cycleProfitHint, 5000); 
        }
    }

    function stopProfitTimer() {
        clearInterval(profitTimer);
        profitTimer = null;
        plannedProfitInput.classList.remove('hint-fade'); 
    }

    // Restart timer dynamically if account size changes so hints update instantly
    accountInput.addEventListener('input', () => {
        if (plannedProfitInput.value === '') {
            stopProfitTimer();
            startProfitTimer();
        }
    });

    plannedProfitInput.addEventListener('focus', stopProfitTimer);
    plannedProfitInput.addEventListener('blur', startProfitTimer);

    // 4. Mode Switching Logic (With True Isolation)
    function setMode(mode) {
        currentMode = mode;
        if (mode === 'basic') {
            btnBasic.classList.add('active');
            btnAdvanced.classList.remove('active');
            riskGroup.classList.add('disabled');
            
            // Strictly isolate risk input from mobile keyboards
            riskInput.disabled = true;
            riskInput.setAttribute('tabindex', '-1');

            document.querySelectorAll('.basic-only').forEach(el => el.classList.remove('hidden'));
            document.querySelectorAll('.advanced-only').forEach(el => el.classList.add('hidden'));
        } else {
            btnAdvanced.classList.add('active');
            btnBasic.classList.remove('active');
            riskGroup.classList.remove('disabled');
            
            // Re-enable risk input for advanced mode
            riskInput.disabled = false;
            riskInput.removeAttribute('tabindex');

            document.querySelectorAll('.basic-only').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.advanced-only').forEach(el => el.classList.remove('hidden'));
        }
        calculate();
    }

    btnBasic.addEventListener('click', () => setMode('basic'));
    btnAdvanced.addEventListener('click', () => setMode('advanced'));

    // 5. Buy/Sell Direction Toggle
    btnBuy.addEventListener('click', () => {
        tradeDirection = 'buy';
        btnBuy.classList.add('active');
        btnSell.classList.remove('active');
        calculate();
    });

    btnSell.addEventListener('click', () => {
        tradeDirection = 'sell';
        btnSell.classList.add('active');
        btnBuy.classList.remove('active');
        calculate();
    });

    // 6. Core Calculations Engine

    // Parses "EUR/USD" or "XAU/USD (Gold)" -> { base: 'EUR', quote: 'USD' }
    function parsePairCurrencies(pairText) {
        const cleanText = pairText.split('(')[0].trim();
        const parts = cleanText.split('/');
        return { base: (parts[0] || '').trim(), quote: (parts[1] || '').trim() };
    }

    // Reference rate used ONLY for cross pairs where neither side is USD
    // (EUR/JPY, GBP/JPY, CHF/JPY) - these need a JPY->USD conversion that
    // isn't derivable from the pair's own entry price. This is an
    // APPROXIMATION, not a live rate.
    const APPROX_USDJPY_RATE = 150;

    function getPipValuePerLot(contractSize, pipSize, entry, pairText) {
        const { base, quote } = parsePairCurrencies(pairText);

        if (quote === 'USD') {
            // Quote currency is already USD - EUR/USD, XAU/USD, XAG/USD, BTC/USD
            return contractSize * pipSize;
        }

        if (base === 'USD') {
            // USD is base - pip value is in quote currency, convert via entry rate
            // USD/CAD, USD/CHF, USD/JPY
            return entry > 0 ? (contractSize * pipSize) / entry : 0;
        }

        if (quote === 'JPY') {
            // Cross pair, neither side USD - EUR/JPY, GBP/JPY, CHF/JPY
            // Approximated using a fixed reference rate (see note above)
            return (contractSize * pipSize) / APPROX_USDJPY_RATE;
        }

        // Fallback for anything unrecognized - assume already USD-denominated
        return contractSize * pipSize;
    }

    function calculate() {
        const account = parseFloat(accountInput.value) || 0;
        const entry = parseFloat(entryInput.value) || 0;
        const contractSize = parseFloat(pairSelect.value) || 100000;
        const selectedOption = pairSelect.options[pairSelect.selectedIndex];
        const pipSize = parseFloat(selectedOption.getAttribute('data-pip-size')) || 0.0001;
        const pairName = selectedOption.text.toUpperCase();

        // Fixed Asset Classification Checks
        const isJpy = pipSize === 0.01 && pairName.includes('JPY');
        const isGold = pairName.includes('XAU');
        const priceDecimals = (isJpy || isGold) ? 2 : 5;

        if (currentMode === 'basic') {
            const plannedProfit = parseFloat(plannedProfitInput.value) || 0;
            const targetLot = parseFloat(basicLotSelect.value) || 0.10;
            mLotSize.textContent = targetLot.toFixed(2);

            if (entry > 0 && plannedProfit > 0) {
                const pipValuePerLot = getPipValuePerLot(contractSize, pipSize, entry, pairName);

                const totalPipValue = targetLot * pipValuePerLot;
                const tpPips = plannedProfit / totalPipValue;
                const slPips = tpPips / 2;
                const cashRisk = targetLot * slPips * pipValuePerLot;

                const tpPrice = tradeDirection === 'buy' ? entry + (tpPips * pipSize) : entry - (tpPips * pipSize);
                const slPrice = tradeDirection === 'buy' ? entry - (slPips * pipSize) : entry + (slPips * pipSize);
                const tripProfitPrice = tradeDirection === 'buy' ? entry + (tpPips * 0.5 * pipSize) : entry - (tpPips * 0.5 * pipSize);
                const breakEvenPrice = tradeDirection === 'buy' ? entry + (2 * pipSize) : entry - (2 * pipSize);

                mCashRisk.textContent = `$${cashRisk.toFixed(2)}`;
                mSlInfo.textContent = `${slPrice.toFixed(priceDecimals)} (${slPips.toFixed(1)} Pips)`;
                mTpInfo.textContent = `${tpPrice.toFixed(priceDecimals)} (+${tpPips.toFixed(1)} Pips)`;
                mTripProfit.textContent = `${tripProfitPrice.toFixed(priceDecimals)}`;
                mBreakEven.textContent = `${breakEvenPrice.toFixed(priceDecimals)}`;
                mRrRatio.textContent = `1 : 2.00`;
            } else {
                resetMetrics();
            }
        } else {
            const riskPct = parseFloat(riskInput.value) || 0;
            const slPrice = parseFloat(slInput.value) || 0;
            const tpPrice = parseFloat(tpInput.value) || 0;

            const cashAtRisk = account * (riskPct / 100);
            mCashRisk.textContent = `$${cashAtRisk.toFixed(2)}`;

            if (entry > 0 && slPrice > 0 && tpPrice > 0) {
                const slDistance = Math.abs(entry - slPrice);
                const tpDistance = Math.abs(entry - tpPrice);
                const slPips = slDistance / pipSize;
                const tpPips = tpDistance / pipSize;

                const pipValuePerLot = getPipValuePerLot(contractSize, pipSize, entry, pairName);

                const calculatedLot = cashAtRisk / (slPips * pipValuePerLot);
                mLotSize.textContent = isNaN(calculatedLot) || calculatedLot === Infinity ? "0.00" : calculatedLot.toFixed(2);

                const tripProfitPrice = tradeDirection === 'buy' ? entry + (tpDistance * 0.5) : entry - (tpDistance * 0.5);
                const breakEvenPrice = tradeDirection === 'buy' ? entry + (2 * pipSize) : entry - (2 * pipSize);

                mSlInfo.textContent = `${slPrice.toFixed(priceDecimals)} (${slPips.toFixed(1)} Pips)`;
                mTpInfo.textContent = `${tpPrice.toFixed(priceDecimals)} (+${tpPips.toFixed(1)} Pips)`;
                mTripProfit.textContent = `${tripProfitPrice.toFixed(priceDecimals)}`;
                mBreakEven.textContent = `${breakEvenPrice.toFixed(priceDecimals)}`;
                mRrRatio.textContent = slDistance > 0 ? `1 : ${(tpDistance / slDistance).toFixed(2)}` : "0.00";
            } else {
                resetMetrics();
            }
        }
    }

    function resetMetrics() {
        mCashRisk.textContent = "$0.00";
        mSlInfo.textContent = "--";
        mTpInfo.textContent = "--";
        mTripProfit.textContent = "--";
        mBreakEven.textContent = "--";
        mRrRatio.textContent = "0.00";
    }

    // Input event listeners
    [accountInput, riskInput, entryInput, plannedProfitInput, basicLotSelect, slInput, tpInput].forEach(el => {
        if (el) el.addEventListener('input', calculate);
    });

    // 7. Top Toast Notification Logic
    const copyBtn = document.getElementById('copyBtn');
    const toast = document.getElementById('toast');

    if (copyBtn && toast) {
        copyBtn.addEventListener('click', () => {
            const pair = pairSelect.options[pairSelect.selectedIndex].text;
            const dir = tradeDirection.toUpperCase();
            const textToCopy = `Mode: ${currentMode.toUpperCase()}\nPair: ${pair} (${dir})\nEntry: ${entryInput.value || 'N/A'}\nLot Size: ${mLotSize.textContent}\nCash Risk: ${mCashRisk.textContent}\nSL: ${mSlInfo.textContent}\nTP: ${mTpInfo.textContent}\nTrip Profit: ${mTripProfit.textContent}\nBreak Even: ${mBreakEven.textContent}`;

            navigator.clipboard.writeText(textToCopy).then(() => {
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 2200);
            });
        });
    }

    // Initialize state
    updateEntryPlaceholder();
    startProfitTimer();
    setMode('basic');
});
