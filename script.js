/**
 * CGPA Calulator and Target Planner — script.js
 *
 * Features:
 *  - Dynamic SGPA inputs (1–8 semesters)
 *  - CGPA calculation with animated counter
 *  - Chart.js line chart (semester trend)
 *  - Mini stat bar (highest, lowest, spread)
 *  - Target CGPA planner
 *  - Form validation (inline + toast)
 *  - Toast notifications (no alert())
 *  - localStorage auto-save & restore
 *  - Dark mode toggle (persisted)
 *  - Reset all
 */

'use strict';

/* ── Constants ─────────────────────────────────────────────────── */
const TOTAL_SEM  = 8;
const SCALE_MIN  = 0;
const SCALE_MAX  = 10;
const LS_KEY     = 'cgpa_data';
const THEME_KEY  = 'cgpa_theme';

/* ── State ─────────────────────────────────────────────────────── */
let chartInstance = null;
let lastCGPA      = null;
let lastValues    = [];

/* ── DOM refs ──────────────────────────────────────────────────── */
const semCountEl   = document.getElementById('semCount');
const sgpaGrid     = document.getElementById('sgpaGrid');
const resultPanel  = document.getElementById('resultPanel');
const resultValue  = document.getElementById('resultValue');
const perfBadge    = document.getElementById('perfBadge');
const resultMeta   = document.getElementById('resultMeta');
const chartAvgEl   = document.getElementById('chartAvg');
const statRow      = document.getElementById('statRow');
const targetInpEl  = document.getElementById('targetInput');
const targetResult = document.getElementById('targetResult');
const targetValueEl= document.getElementById('targetValue');
const targetRemain = document.getElementById('targetRemain');
const targetStatus = document.getElementById('targetStatus');
const themeBtn     = document.getElementById('themeBtn');
const themeIcon    = document.getElementById('themeIcon');
const toastCont    = document.getElementById('toastContainer');

/* ── Boot ──────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  restoreFromStorage();
  buildGrid();

  semCountEl.addEventListener('change', () => {
    buildGrid();
    hidePanel(resultPanel);
    hidePanel(targetResult);
    saveToStorage();
  });

  themeBtn.addEventListener('click', toggleTheme);
});

/* ══════════════════════════════════════════════════════════════
   INPUT GRID
══════════════════════════════════════════════════════════════ */
function buildGrid() {
  const count  = getCount();
  const saved  = {};
  sgpaGrid.querySelectorAll('input').forEach(i => { saved[i.dataset.sem] = i.value; });
  sgpaGrid.innerHTML = '';

  for (let i = 1; i <= count; i++) {
    const cell = document.createElement('div');
    cell.className = 'sgpa-cell';

    const lbl = document.createElement('label');
    lbl.className = 'field-label';
    lbl.setAttribute('for', `sgpa_${i}`);
    lbl.textContent = `Semester ${i}`;

    const inp = document.createElement('input');
    inp.type        = 'number';
    inp.className   = 'field-input';
    inp.id          = `sgpa_${i}`;
    inp.dataset.sem = i;
    inp.placeholder = '0.00';
    inp.step        = '0.01';
    inp.min         = String(SCALE_MIN);
    inp.max         = String(SCALE_MAX);
    inp.inputMode   = 'decimal';
    inp.autocomplete= 'off';

    if (saved[i]) inp.value = saved[i];

    inp.addEventListener('input', () => {
      inp.classList.remove('invalid');
      saveToStorage();
    });

    cell.appendChild(lbl);
    cell.appendChild(inp);
    sgpaGrid.appendChild(cell);
  }
}

/* ══════════════════════════════════════════════════════════════
   CALCULATE CGPA
══════════════════════════════════════════════════════════════ */
function calculateCGPA() {
  const values = readSGPAs();
  if (!values) return;

  const cgpa = values.reduce((a, b) => a + b, 0) / values.length;
  lastCGPA   = cgpa;
  lastValues = [...values];

  const { label, cls } = performanceInfo(cgpa);

  // Animate counter
  resultPanel.hidden = false;
  animateCounter(resultValue, 0, cgpa, 800);

  perfBadge.textContent = label;
  perfBadge.className   = `perf-badge ${cls}`;
  resultMeta.textContent = `${values.length} semester${values.length > 1 ? 's' : ''} · scale 0–10`;

  buildChart(values);
  buildStats(values, cgpa);

  // Recalculate target if already open
  if (!targetResult.hidden) calcTarget();

  saveToStorage();
  showToast('CGPA calculated.', 'success');
}

/* ══════════════════════════════════════════════════════════════
   CHART (compact line, no legend)
══════════════════════════════════════════════════════════════ */
function buildChart(values) {
  const isDark   = document.documentElement.dataset.theme === 'dark';
  const lineClr  = isDark ? '#60A5FA' : '#1E88E5';
  const fillClr  = isDark ? 'rgba(96,165,250,0.10)' : 'rgba(30,136,229,0.08)';
  const gridClr  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const tickClr  = isDark ? '#64748B' : '#9CA3AF';
  const avg      = values.reduce((a, b) => a + b, 0) / values.length;

  chartAvgEl.textContent = `avg ${avg.toFixed(2)}`;

  const labels = values.map((_, i) => `Sem ${i + 1}`);

  if (chartInstance) chartInstance.destroy();

  const ctx = document.getElementById('trendChart').getContext('2d');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: lineClr,
        backgroundColor: fillClr,
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: lineClr,
        pointBorderColor: isDark ? '#0F172A' : '#FFFFFF',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1E293B' : '#1F2937',
          titleColor: isDark ? '#94A3B8' : '#9CA3AF',
          bodyColor: '#FFFFFF',
          bodyFont: { family: "'DM Mono', monospace", size: 13 },
          padding: 10,
          cornerRadius: 7,
          displayColors: false,
          callbacks: {
            title: items => items[0].label,
            label: item  => `SGPA: ${item.raw.toFixed(2)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridClr, drawTicks: false },
          border: { display: false },
          ticks: {
            color: tickClr,
            font: { family: "'DM Sans', sans-serif", size: 11 },
            padding: 6
          }
        },
        y: {
          min: Math.max(0, Math.floor(Math.min(...values)) - 1),
          max: Math.min(10, Math.ceil(Math.max(...values)) + 0.5),
          grid: { color: gridClr, drawTicks: false },
          border: { display: false },
          ticks: {
            color: tickClr,
            font: { family: "'DM Mono', monospace", size: 10 },
            padding: 8,
            maxTicksLimit: 5,
            callback: v => v.toFixed(1)
          }
        }
      },
      animation: { duration: 600, easing: 'easeInOutQuart' }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   MINI STAT BAR
══════════════════════════════════════════════════════════════ */
function buildStats(values, cgpa) {
  const highest = Math.max(...values);
  const lowest  = Math.min(...values);
  const spread  = (highest - lowest).toFixed(2);

  statRow.innerHTML = `
    <div class="stat-item">
      <span class="stat-key">Highest</span>
      <span class="stat-val">${highest.toFixed(2)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-key">Lowest</span>
      <span class="stat-val">${lowest.toFixed(2)}</span>
    </div>
    <div class="stat-item">
      <span class="stat-key">Spread</span>
      <span class="stat-val">${spread}</span>
    </div>
  `;
}

/* ══════════════════════════════════════════════════════════════
   TARGET PLANNER
══════════════════════════════════════════════════════════════ */
function calcTarget() {
  // Require SGPA values to be present
  const values = readSGPAs(/* silent */ true);
  if (!values) {
    showToast('Calculate your CGPA first.', 'error');
    return;
  }

  targetInpEl.classList.remove('invalid');
  const raw    = targetInpEl.value.trim();
  const target = parseFloat(raw);

  if (raw === '' || isNaN(target) || target < SCALE_MIN || target > SCALE_MAX) {
    targetInpEl.classList.add('invalid');
    targetInpEl.focus();
    showToast('Enter a valid target CGPA (0–10).', 'error');
    return;
  }

  const completed = getCount();
  const remaining = TOTAL_SEM - completed;
  const doneSum   = values.reduce((a, b) => a + b, 0);

  targetResult.hidden = false;

  if (remaining <= 0) {
    targetValueEl.textContent = '—';
    targetRemain.textContent  = '0';
    targetStatus.textContent  = 'Completed';
    targetStatus.className    = 'target-status status-done';
    return;
  }

  const needed = (target * TOTAL_SEM - doneSum) / remaining;

  targetRemain.textContent = remaining;

  if (needed < SCALE_MIN) {
    targetValueEl.textContent = '—';
    targetStatus.textContent  = 'Already exceeded';
    targetStatus.className    = 'target-status status-exceeded';
  } else if (needed > SCALE_MAX) {
    targetValueEl.textContent = '—';
    targetStatus.textContent  = 'Not achievable';
    targetStatus.className    = 'target-status status-na';
  } else if (needed >= 9.0) {
    targetValueEl.textContent = needed.toFixed(2);
    targetStatus.textContent  = 'Challenging';
    targetStatus.className    = 'target-status status-warn';
  } else {
    targetValueEl.textContent = needed.toFixed(2);
    targetStatus.textContent  = 'Achievable';
    targetStatus.className    = 'target-status status-ok';
  }

  saveToStorage();
}

/* ══════════════════════════════════════════════════════════════
   RESET
══════════════════════════════════════════════════════════════ */
function resetAll() {
  sgpaGrid.querySelectorAll('input').forEach(i => {
    i.value = '';
    i.classList.remove('invalid');
  });
  targetInpEl.value = '';
  targetInpEl.classList.remove('invalid');
  hidePanel(resultPanel);
  hidePanel(targetResult);
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  lastCGPA = null; lastValues = [];
  localStorage.removeItem(LS_KEY);
  showToast('Cleared.', 'info');
}

/* ══════════════════════════════════════════════════════════════
   VALIDATION HELPERS
══════════════════════════════════════════════════════════════ */

/**
 * Reads all SGPA inputs. Marks invalid fields.
 * @param  {boolean} silent - if true, no toasts/focus side-effects
 * @returns {number[]|null}
 */
function readSGPAs(silent = false) {
  const count  = getCount();
  const values = [];
  let   ok     = true;
  let   first  = null;

  for (let i = 1; i <= count; i++) {
    const inp = document.getElementById(`sgpa_${i}`);
    if (!inp) continue;
    const raw = inp.value.trim();
    const val = parseFloat(raw);

    if (raw === '' || isNaN(val) || val < SCALE_MIN || val > SCALE_MAX) {
      inp.classList.add('invalid');
      ok = false;
      if (!first) first = inp;
    } else {
      inp.classList.remove('invalid');
      values.push(val);
    }
  }

  if (!ok) {
    if (!silent) {
      if (first) first.focus();
      showToast('Please fill all SGPA fields with values between 0 and 10.', 'error');
    }
    return null;
  }

  return values;
}

/* ══════════════════════════════════════════════════════════════
   PERFORMANCE LABEL
══════════════════════════════════════════════════════════════ */
function performanceInfo(cgpa) {
  if (cgpa >= 9.0) return { label: 'Excellent',  cls: 'badge-excellent' };
  if (cgpa >= 8.0) return { label: 'Very Good',  cls: 'badge-verygood'  };
  if (cgpa >= 7.0) return { label: 'Good',       cls: 'badge-good'      };
  return                   { label: 'Average',    cls: 'badge-average'   };
}

/* ══════════════════════════════════════════════════════════════
   ANIMATED COUNTER
══════════════════════════════════════════════════════════════ */
function animateCounter(el, from, to, duration) {
  const start   = performance.now();
  const range   = to - from;

  function step(ts) {
    const elapsed  = ts - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = (from + range * eased).toFixed(2);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

/* ══════════════════════════════════════════════════════════════
   TOAST SYSTEM
══════════════════════════════════════════════════════════════ */
function showToast(msg, type = 'info', duration = 2800) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  toastCont.appendChild(el);

  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
}

/* ══════════════════════════════════════════════════════════════
   LOCAL STORAGE
══════════════════════════════════════════════════════════════ */
function saveToStorage() {
  const count  = getCount();
  const values = {};
  for (let i = 1; i <= count; i++) {
    const inp = document.getElementById(`sgpa_${i}`);
    if (inp) values[i] = inp.value;
  }

  const data = {
    count,
    values,
    target: targetInpEl.value
  };

  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {}
}

function restoreFromStorage() {
  try {
    const raw  = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);

    if (data.count && data.count >= 1 && data.count <= TOTAL_SEM) {
      semCountEl.value = data.count;
    }

    // Inputs are built after this; store for post-build injection
    window._restoreValues = data.values || {};
    window._restoreTarget = data.target || '';
  } catch (_) {}
}

/* Inject restored values after buildGrid() */
const _origBuildGrid = buildGrid;
buildGrid = function() {
  _origBuildGrid();
  const saved = window._restoreValues;
  if (saved) {
    Object.entries(saved).forEach(([sem, val]) => {
      const inp = document.getElementById(`sgpa_${sem}`);
      if (inp && val !== '') inp.value = val;
    });
    window._restoreValues = null;
  }
  const tgt = window._restoreTarget;
  if (tgt) {
    targetInpEl.value = tgt;
    window._restoreTarget = null;
  }
};

/* ══════════════════════════════════════════════════════════════
   DARK MODE
══════════════════════════════════════════════════════════════ */
function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);

  // Rebuild chart with new colours if it exists
  if (chartInstance && lastValues.length) {
    buildChart(lastValues);
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeIcon.textContent = theme === 'dark' ? '☀' : '☾';
}

/* ══════════════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════════════ */
function getCount() { return parseInt(semCountEl.value, 10); }

function hidePanel(el) {
  if (el) el.hidden = true;
}