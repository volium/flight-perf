import { calculateClimb } from '../calc/climb.js';
import { formatNumber } from '../engine/units.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';
import { displayUnit } from './perf-ui-common.js';

const STORAGE_KEY = 'climb_inputs';

const DEFAULTS = {
  pressureAltitude: '',
};

export function initClimb(panelEl) {
  const profile = getProfile();
  const saved = storage.get(STORAGE_KEY, DEFAULTS);
  const climb = profile?.performance?.climb;

  if (!climb) {
    panelEl.innerHTML = `
      <div class="panel">
        <div class="alert alert--warning">⚠ No climb performance data available in the loaded profile.</div>
      </div>`;
    return;
  }

  const altRange = getAltitudeRange(climb.data);

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Climb Performance</h2>

        <div class="form-group">
          <label class="form-label" for="cl-alt">Pressure Altitude</label>
          <div class="form-suffix">
            <input class="form-input" id="cl-alt" type="number" inputmode="numeric"
                   min="${altRange.min}" max="${altRange.max}" step="100"
                   placeholder="e.g. 3000" value="${esc(saved.pressureAltitude)}">
            <span class="form-suffix__label">ft</span>
          </div>
          <div class="form-hint">POH data: ${formatNumber(altRange.min)} – ${formatNumber(altRange.max)} ft</div>
        </div>

        <button class="btn btn-primary btn-block" id="cl-calculate">Calculate</button>

        ${buildRefNote(climb.referenceConditions, climb.description)}
      </div>

      <div class="panel">
        <h2 class="panel__title">Results</h2>
        <div id="cl-results">
          <div class="placeholder-message">
            <div class="placeholder-message__icon">📈</div>
            <div class="placeholder-message__text">Enter altitude and press Calculate</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const altEl = panelEl.querySelector('#cl-alt');
  const calcBtn = panelEl.querySelector('#cl-calculate');
  const resultsEl = panelEl.querySelector('#cl-results');

  function calculate() {
    const alt = parseFloat(altEl.value);

    if (isNaN(alt)) {
      resultsEl.innerHTML = `<div class="alert alert--warning">⚠ Please enter a pressure altitude.</div>`;
      return;
    }

    storage.set(STORAGE_KEY, { pressureAltitude: altEl.value });

    const results = calculateClimb(profile, { pressureAltitude: alt });

    if (results.error) {
      resultsEl.innerHTML = `<div class="alert alert--error">⚠ ${results.error}</div>`;
      return;
    }

    renderResults(resultsEl, results);
  }

  calcBtn.addEventListener('click', calculate);

  panelEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input')) {
      calculate();
    }
  });

  if (saved.pressureAltitude) {
    calculate();
  }
}

function renderResults(el, r) {
  const rocClass =
    r.rateOfClimb < 200
      ? 'results-list__value--danger'
      : r.rateOfClimb < 400
        ? 'results-list__value--caution'
        : '';

  let html = `
    <ul class="results-list">
      <li class="results-list__item results-list__item--highlight">
        <span class="results-list__label">Rate of Climb</span>
        <span class="results-list__value ${rocClass}">${formatNumber(r.rateOfClimb)} fpm</span>
      </li>
      <li class="results-list__item">
        <span class="results-list__label">Best Climb Speed (Vy)</span>
        <span class="results-list__value">${formatNumber(r.bestClimbSpeed)} KIAS</span>
      </li>
      <li class="results-list__item">
        <span class="results-list__label">Pressure Altitude</span>
        <span class="results-list__value">${formatNumber(r.pressureAltitude)} ft</span>
      </li>
    </ul>`;

  if (r.clamped) {
    html += `<div class="alert alert--warning">⚠ Altitude is outside POH data range — result clamped to ${r.clampedTo === 'min' ? 'minimum' : 'maximum'} table value.</div>`;
  }

  if (r.rateOfClimb < 200) {
    html += `<div class="alert alert--error">⚠ Very low rate of climb — may be insufficient for safe obstacle clearance.</div>`;
  } else if (r.rateOfClimb < 400) {
    html += `<div class="alert alert--warning">⚠ Reduced rate of climb — plan accordingly for terrain and obstacles.</div>`;
  }

  el.innerHTML = html;
}

function getAltitudeRange(data) {
  const alts = data.map((d) =>
    typeof d.pressureAltitude === 'object' ? d.pressureAltitude.value : d.pressureAltitude,
  );
  return { min: Math.min(...alts), max: Math.max(...alts) };
}

function buildRefNote(conditions, description) {
  const parts = [];
  if (description) parts.push(description);
  if (conditions?.weight) parts.push(`Weight: ${conditions.weight.value} ${displayUnit(conditions.weight.unit)}`);
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
