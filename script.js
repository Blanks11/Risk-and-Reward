document.addEventListener('DOMContentLoaded', () => {
  let currentMode = 'basic';
  let tradeDirection = 'buy';

  const accountInput = document.getElementById('accountSize');
  const riskInput = document.getElementById('riskPercent');
  const riskGroup = document.getElementById('riskGroup');
  const pairSelect = document.getElementById('assetPair');
  const entryInput = document.getElementById('entryPrice');
  const plannedProfitInput = document.getElementById('plannedProfit');
  const basicLotSelect = document.getElementById('basicLotSelect');
  const slInput = document.getElementById('slPrice');
  const tpInput = document.getElementById('tpPrice');
  
  const btnBasic = document.getElementById('btnBasic');
  const btnAdvanced = document.getElementById('btnAdvanced');
  const btnBuy = document.getElementById('btnBuy');
  const btnSell = document.getElementById('btnSell');
  
  const mCashRisk = document.getElementById('mCashRisk');
  const mSlInfo = document.getElementById('mSlInfo');
  const mTpInfo = document.getElementById('mTpInfo');
  const mLotSize = document.getElementById('mLotSize');
  const mTripProfit = document.getElementById('mTripProfit');
  const mBreakEven = document.getElementById('mBreakEven');
  const mRrRatio = document.getElementById('mRrRatio');

  const navInputs = [accountInput, riskInput, entryInput, plannedProfitInput, slInput, tpInput];

  navInputs.forEach(input => {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        let nextTarget = null;
        
        if (this === accountInput) nextTarget = currentMode === 'basic' ? entryInput : riskInput;
        else if (this === riskInput) nextTarget = entryInput;
        else if (this === entryInput) nextTarget = currentMode === 'basic' ? plannedProfitInput : slInput;
        else if (this === slInput) nextTarget = tpInput;
        
        if (nextTarget) nextTarget.focus();
        else this.blur();
      }
    });
  });

  function updateEntryPlaceholder() {
    const selected = pairSelect.options[pairSelect.selectedIndex];
    const entryHint = selected.getAttribute('data-entry-hint') || 'e.g., 1.10500';
    
    entryInput.classList.add('hint-fade');
    setTimeout(() => {
      entryInput.placeholder = entryHint;
      entryInput.classList.remove('hint-fade');
    }, 1500);
  }

  pairSelect.addEventListener('change', () => {
    updateEntryPlaceholder();
    calculate();
  });

  let profitIndex = 0;
  let profitTimer = null;

  function getDynamicProfitHints() {
    const accountSize = parseFloat(accountInput.value) || 10000;
    return [0.01, 0.02, 0.03, 0.05].map(p => {
      let val = accountSize * p;
      if (val >= 100) val = Math.round(val / 10) * 10;
      else if (val >= 10) val = Math.round(val);
      else val = Number(val.toFixed(2));
      return `e.g., ${val}`;
    });
  }

  function cycleProfitHint() {
    const hints = getDynamicProfitHints();
    plannedProfitInput.classList.add('hint-fade');
    
    setTimeout(() => {
      profitIndex = (profitIndex + 1) % hints.length;
      plannedProfitInput.placeholder = hints[profitIndex];
      plannedProfitInput.classList.remove('hint-fade');
    }, 1500);
  }

  function startProfitTimer() {
    if (!profitTimer && plannedProfitInput.value === '') {
      plannedProfitInput.placeholder = getDynamicProfitHints()[0];
      profitTimer = setInterval(cycleProfitHint, 5000);
    }
  }

  function stopProfitTimer() {
    clearInterval(profitTimer);
    profitTimer = null;
    plannedProfitInput.classList.remove('hint-fade');
  }

  accountInput.addEventListener('input', () => {
    if (plannedProfitInput.value === '') {
      stopProfitTimer();
      startProfitTimer();
    }
  });

  plannedProfitInput.addEventListener('focus', stopProfitTimer);
  plannedProfitInput.addEventListener('blur', startProfitTimer);

  function setMode(mode) {
    currentMode = mode;
    
    if (mode === 'basic') {
      btnBasic.classList.add('active');
      btnAdvanced.classList.remove('active');
      riskGroup.classList.add('disabled');
      riskInput.disabled = true;
      riskInput.setAttribute('tabindex', '-1');
      
      document.querySelectorAll('.basic-only').forEach(el => el.classList.remove('hidden'));
      document.querySelectorAll('.advanced-only').forEach(el => el.classList.add('hidden'));
    } else {
      btnAdvanced.classList.add('active');
      btnBasic.classList.remove('active');
      riskGroup.classList.remove('disabled');
      riskInput.disabled = false;
      riskInput.removeAttribute('tabindex');
      
      document.querySelectorAll('.basic-only').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.advanced-only').forEach(el => el.classList.remove('hidden'));
    }
    calculate();
  }

  btnBasic.addEventListener('click', () => setMode('basic'));
  btnAdvanced.addEventListener('click', () => setMode('advanced'));

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

  function parsePairCurrencies(pairText) {
    const parts = pairText.split('(')[0].trim().split('/');
    return {
      base: (parts[0] || '').trim(),
      quote: (parts[1] || '').trim()
    };
  }

  const APPROX_USDJPY_RATE = 150;

  function getPipValuePerLot(contractSize, pipSize, entry, pairText) {
    const { base, quote } = parsePairCurrencies(pairText);
    
    if (quote === 'USD') return contractSize * pipSize;
    if (base === 'USD') return entry > 0 ? (contractSize * pipSize) / entry : 0;
    if (quote === 'JPY') return (contractSize * pipSize) / APPROX_USDJPY_RATE;
    
    return contractSize * pipSize;
  }

  function calculate() {
    const account = parseFloat(accountInput.value) || 0;
    const entry = parseFloat(entryInput.value) || 0;
    const contractSize = parseFloat(pairSelect.value) || 100000;
    const selectedOption = pairSelect.options[pairSelect.selectedIndex];
    const pipSize = parseFloat(selectedOption.getAttribute('data-pip-size')) || 0.0001;
    const pairName = selectedOption.text.toUpperCase();
    
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

  [accountInput, riskInput, entryInput, plannedProfitInput, basicLotSelect, slInput, tpInput].forEach(el => {
    if (el) el.addEventListener('input', calculate);
  });

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

  updateEntryPlaceholder();
  startProfitTimer();
  setMode('basic');
});
