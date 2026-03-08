import { calculateTakeoff } from '../calc/takeoff.js';
import { formatNumber } from '../engine/units.js';
import { emptyMargins } from '../engine/margins.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';

const STORAGE_KEY = 'takeoff_inputs';

const DEFAULTS = {
  surface: '',
  marginType: 'none',
  marginPctValue: '',
  marginFixedValue: '',
  marginRoundUp: false,
  distanceUnit: 'ft',
};

export function initTakeoff(panelEl) {
  const profile = getProfile();
  const saved = storage.get(STORAGE_KEY, DEFAULTS);
  const takeoff = profile?.performance?.takeoff;

  if (!takeoff) {
    panelEl.innerHTML = `
      <div class="panel">
        <div class="alert alert--warning">⚠ No takeoff performance data available in the loaded profile.</div>
      </div>`;
    return;
  }

  const surfaceOptions = takeoff.data
    .map(
      (d) =>
        `<option value="${d.surface}" ${saved.surface === d.surface ? 'selected' : ''}>${d.surfaceLabel}</option>`,
    )
    .join('');

  const refCond = takeoff.referenceConditions;
  const refNote = buildRefNote(refCond, takeoff.description);

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Takeoff Performance</h2>

        <div class="form-group">
          <label class="form-label" for="to-surface">Runway Surface</label>
          <select class="form-input" id="to-surface">${surfaceOptions}</select>
        </div>

        <div class="form-group">
          <label class="form-label" for="to-unit">Distance Unit</label>
          <select class="form-input" id="to-unit">
            <option value="ft" ${saved.distanceUnit === 'ft' ? 'selected' : ''}>ft</option>
            <option value="m" ${saved.distanceUnit === 'm' ? 'selected' : ''}>m</option>
          </select>
        </div>

        <fieldset class="margin-fieldset">
          <legend class="margin-fieldset__legend">Safety Margin</legend>

          <div class="form-group">
            <label class="form-label" for="to-margin-type">Type</label>
            <select class="form-input" id="to-margin-type">
              <option value="none" ${saved.marginType === 'none' ? 'selected' : ''}>None (POH values)</option>
              <option value="percentage" ${saved.marginType === 'percentage' ? 'selected' : ''}>Percentage</option>
              <option value="fixed" ${saved.marginType === 'fixed' ? 'selected' : ''}>Fixed Distance</option>
            </select>
          </div>

          <div class="form-group" id="to-margin-value-group" style="display:none">
            <label class="form-label" id="to-margin-value-label" for="to-margin-value">Value</label>
            <div class="form-suffix">
              <input class="form-input" id="to-margin-value" type="number" inputmode="decimal"
                     min="0" step="any" placeholder="" value="">
              <span class="form-suffix__label" id="to-margin-value-suffix"></span>
            </div>
          </div>

          <div class="form-group" id="to-round-group" style="display:none">
            <label class="form-checkbox">
              <input type="checkbox" id="to-margin-round" ${saved.marginRoundUp ? 'checked' : ''}>
              <span>Round up to nearest 100</span>
            </label>
          </div>
        </fieldset>

        <button class="btn btn-primary btn-block" id="to-calculate">Calculate</button>

        ${refNote}
      </div>

      <div class="panel">
        <h2 class="panel__title">Results</h2>
        <div id="to-results">
          <div class="placeholder-message">
            <div class="placeholder-message__icon">🛫</div>
            <div class="placeholder-message__text">Select surface and press Calculate</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const surfaceEl = panelEl.querySelector('#to-surface');
  const unitEl = panelEl.querySelector('#to-unit');
  const marginTypeEl = panelEl.querySelector('#to-margin-type');
  const marginValueGroup = panelEl.querySelector('#to-margin-value-group');
  const marginValueEl = panelEl.querySelector('#to-margin-value');
  const marginValueLabel = panelEl.querySelector('#to-margin-value-label');
  const marginValueSuffix = panelEl.querySelector('#to-margin-value-suffix');
  const roundGroup = panelEl.querySelector('#to-round-group');
  const roundEl = panelEl.querySelector('#to-margin-round');
  const calcBtn = panelEl.querySelector('#to-calculate');
  const resultsEl = panelEl.querySelector('#to-results');

  // Sticky values: keep percentage and fixed values independently
  let stickyPct = saved.marginPctValue || '';
  let stickyFixed = saved.marginFixedValue || '';

  function updateMarginUI() {
    const type = marginTypeEl.value;
    const unit = unitEl.value;

    if (type === 'none') {
      marginValueGroup.style.display = 'none';
    } else {
      marginValueGroup.style.display = '';

      if (type === 'percentage') {
        marginValueLabel.textContent = 'Add percentage';
        marginValueSuffix.textContent = '%';
        marginValueEl.placeholder = 'e.g. 25';
        marginValueEl.value = stickyPct;
      } else {
        marginValueLabel.textContent = 'Add distance';
        marginValueSuffix.textContent = unit;
        marginValueEl.placeholder = unit === 'm' ? 'e.g. 150' : 'e.g. 500';
        marginValueEl.value = stickyFixed;
      }
    }

    roundGroup.style.display = '';
  }

  // Save the current value to the correct sticky slot before switching
  marginTypeEl.addEventListener('mousedown', () => {
    stashCurrentValue();
  });

  function stashCurrentValue() {
    const type = marginTypeEl.value;
    if (type === 'percentage') {
      stickyPct = marginValueEl.value;
    } else if (type === 'fixed') {
      stickyFixed = marginValueEl.value;
    }
  }

  marginTypeEl.addEventListener('change', updateMarginUI);
  unitEl.addEventListener('change', updateMarginUI);
  updateMarginUI();

  function buildMargins() {
    const type = marginTypeEl.value;
    const roundUp = roundEl.checked ? 100 : null;

    if (type === 'none') {
      if (roundUp) {
        const margin = { roundUp };
        return {
          groundRoll: { ...margin },
          totalOverObstacle: { ...margin },
        };
      }
      return emptyMargins();
    }

    const val = parseFloat(marginValueEl.value);
    const margin = {};

    if (type === 'percentage' && !isNaN(val) && val > 0) {
      margin.percentage = val;
    } else if (type === 'fixed' && !isNaN(val) && val > 0) {
      margin.fixed = val;
    }

    if (roundUp) margin.roundUp = roundUp;

    return {
      groundRoll: { ...margin },
      totalOverObstacle: { ...margin },
    };
  }

  function saveInputs() {
    stashCurrentValue();
    storage.set(STORAGE_KEY, {
      surface: surfaceEl.value,
      marginType: marginTypeEl.value,
      marginPctValue: stickyPct,
      marginFixedValue: stickyFixed,
      marginRoundUp: roundEl.checked,
      distanceUnit: unitEl.value,
    });
  }

  function calculate() {
    const surface = surfaceEl.value;
    if (!surface) {
      resultsEl.innerHTML = `<div class="alert alert--warning">⚠ Please select a runway surface.</div>`;
      return;
    }

    saveInputs();

    const margins = buildMargins();
    const distanceUnit = unitEl.value;

    const results = calculateTakeoff(profile, {
      surface,
      margins,
      distanceUnit,
    });

    if (results.error) {
      resultsEl.innerHTML = `<div class="alert alert--error">⚠ ${results.error}</div>`;
      return;
    }

    renderResults(resultsEl, results, marginTypeEl.value);
  }

  calcBtn.addEventListener('click', calculate);

  if (saved.surface) {
    calculate();
  }
}

/* ── Results Rendering ── */

function renderResults(el, r, marginType) {
  const gr = r.groundRoll;
  const to = r.totalOverObstacle;
  const unit = r.distanceUnit;

  let html = `<ul class="results-list">`;
  html += renderDistanceRow('Ground Roll', gr, unit);
  html += renderDistanceRow(`Total ${r.obstacleLabel}`, to, unit, true);
  html += `</ul>`;

  if (gr.marginApplied || to.marginApplied) {
    html += `<div class="alert alert--info">ℹ Safety margin applied (${gr.description})</div>`;
  }

  if (r.referenceConditions) {
    const cond = r.referenceConditions;
    const parts = [];
    if (cond.weight) parts.push(`${cond.weight.value} ${cond.weight.unit}`);
    if (cond.atmosphere) parts.push(cond.atmosphere);
    if (cond.power) parts.push(cond.power);
    if (parts.length > 0) {
      html += `<div class="to-ref-note">Reference: ${parts.join(' · ')}</div>`;
    }
  }

  el.innerHTML = html;
}

function renderDistanceRow(label, result, unit, highlight = false) {
  const hlClass = highlight ? ' results-list__item--highlight' : '';

  if (result.marginApplied) {
    return `
      <li class="results-list__item${hlClass}">
        <span class="results-list__label">${label}</span>
        <span class="results-list__value">
          ${formatNumber(result.adjusted)} ${unit}
          <span class="results-list__adjusted">(POH: ${formatNumber(result.raw)} ${unit})</span>
        </span>
      </li>`;
  }

  return `
    <li class="results-list__item${hlClass}">
      <span class="results-list__label">${label}</span>
      <span class="results-list__value">${formatNumber(result.raw)} ${unit}</span>
    </li>`;
}

function buildRefNote(conditions, description) {
  const parts = [];
  if (description) parts.push(description);
  if (conditions?.weight) parts.push(`Weight: ${conditions.weight.value} ${conditions.weight.unit}`);
  if (conditions?.atmosphere) parts.push(`Atmosphere: ${conditions.atmosphere}`);
  if (conditions?.power) parts.push(`Power: ${conditions.power}`);

  if (parts.length === 0) return '';

  return `
    <div class="to-ref-note">
      <strong>POH Reference Conditions</strong><br>
      ${parts.join('<br>')}
    </div>`;
}

function esc(val) {
  if (val == null) return '';
  return String(val).replace(/"/g, '&quot;');
}
