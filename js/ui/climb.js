import { calculateClimbPlan } from '../calc/climb.js';
import { convert, formatNumber } from '../engine/units.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';
import { displayUnit, buildRefNote, esc } from './perf-ui-common.js';

const STORAGE_KEY = 'climb_inputs';

const DEFAULTS = {
  departureElevation: '',
  elevUnit: 'ft',
  targetAltitude: '',
  targetUnit: 'ft',
  altimeter: '29.92',
  altimeterUnit: 'inHg',
};

export function initClimb(panelEl) {
  const profile = getProfile();
  const saved = { ...DEFAULTS, ...storage.get(STORAGE_KEY, DEFAULTS) };
  const climb = profile?.performance?.climb;

  if (!climb) {
    panelEl.innerHTML = `
      <div class="panel">
        <div class="alert alert--warning">⚠ No climb performance data available in the loaded profile.</div>
      </div>`;
    return;
  }

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Climb Planner</h2>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="cl-dep-elev">Departure Field Elevation</label>
            <div class="form-suffix">
              <input class="form-input" id="cl-dep-elev" type="number" inputmode="numeric"
                     placeholder="${saved.elevUnit === 'm' ? 'e.g. 365' : 'e.g. 1200'}" value="${esc(saved.departureElevation)}">
              <span class="form-suffix__label" id="cl-elev-suffix">${saved.elevUnit}</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="cl-elev-unit">Unit</label>
            <select class="form-input" id="cl-elev-unit">
              <option value="ft" ${saved.elevUnit === 'ft' ? 'selected' : ''}>ft</option>
              <option value="m" ${saved.elevUnit === 'm' ? 'selected' : ''}>m</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="cl-target">Target Altitude</label>
            <div class="form-suffix">
              <input class="form-input" id="cl-target" type="number" inputmode="numeric"
                     placeholder="${saved.targetUnit === 'm' ? 'e.g. 1500' : 'e.g. 5000'}" value="${esc(saved.targetAltitude)}">
              <span class="form-suffix__label" id="cl-target-suffix">${saved.targetUnit}</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="cl-target-unit">Unit</label>
            <select class="form-input" id="cl-target-unit">
              <option value="ft" ${saved.targetUnit === 'ft' ? 'selected' : ''}>ft</option>
              <option value="m" ${saved.targetUnit === 'm' ? 'selected' : ''}>m</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="cl-altimeter">Altimeter Setting</label>
            <div class="form-suffix">
              <input class="form-input" id="cl-altimeter" type="number" inputmode="decimal"
                     step="0.01" placeholder="${saved.altimeterUnit === 'hPa' ? '1013.25' : '29.92'}" value="${esc(saved.altimeter)}">
              <span class="form-suffix__label" id="cl-alt-suffix">${saved.altimeterUnit}</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="cl-alt-unit">Unit</label>
            <select class="form-input" id="cl-alt-unit">
              <option value="inHg" ${saved.altimeterUnit === 'inHg' ? 'selected' : ''}>inHg</option>
              <option value="hPa" ${saved.altimeterUnit === 'hPa' ? 'selected' : ''}>hPa</option>
            </select>
          </div>
        </div>

        <button class="btn btn-primary btn-block" id="cl-calculate">Calculate</button>

        ${buildRefNote(climb.referenceConditions, climb.description)}
      </div>

      <div class="panel">
        <h2 class="panel__title">Results</h2>
        <div id="cl-results">
          <div class="placeholder-message">
            <div class="placeholder-message__icon">📈</div>
            <div class="placeholder-message__text">Enter departure and target altitudes, then press Calculate</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const depElevEl = panelEl.querySelector('#cl-dep-elev');
  const elevUnitEl = panelEl.querySelector('#cl-elev-unit');
  const elevSuffix = panelEl.querySelector('#cl-elev-suffix');
  const targetEl = panelEl.querySelector('#cl-target');
  const targetUnitEl = panelEl.querySelector('#cl-target-unit');
  const targetSuffix = panelEl.querySelector('#cl-target-suffix');
  const altimeterEl = panelEl.querySelector('#cl-altimeter');
  const altUnitEl = panelEl.querySelector('#cl-alt-unit');
  const altSuffix = panelEl.querySelector('#cl-alt-suffix');
  const calcBtn = panelEl.querySelector('#cl-calculate');
  const resultsEl = panelEl.querySelector('#cl-results');

  elevUnitEl.addEventListener('change', () => {
    elevSuffix.textContent = elevUnitEl.value;
    depElevEl.placeholder = elevUnitEl.value === 'm' ? 'e.g. 365' : 'e.g. 1200';
  });

  targetUnitEl.addEventListener('change', () => {
    targetSuffix.textContent = targetUnitEl.value;
    targetEl.placeholder = targetUnitEl.value === 'm' ? 'e.g. 1500' : 'e.g. 5000';
  });

  altUnitEl.addEventListener('change', () => {
    altSuffix.textContent = altUnitEl.value;
    altimeterEl.placeholder = altUnitEl.value === 'hPa' ? '1013.25' : '29.92';
  });

  function calculate() {
    const depRaw = parseFloat(depElevEl.value);
    const tgtRaw = parseFloat(targetEl.value);
    const altRaw = parseFloat(altimeterEl.value);

    if (isNaN(depRaw) || isNaN(tgtRaw) || isNaN(altRaw)) {
      resultsEl.innerHTML = `<div class="alert alert--warning">⚠ Please fill in all fields with valid numbers.</div>`;
      return;
    }

    const depFt = elevUnitEl.value === 'm' ? convert.mToFt(depRaw) : depRaw;
    const tgtFt = targetUnitEl.value === 'm' ? convert.mToFt(tgtRaw) : tgtRaw;
    const altInHg = altUnitEl.value === 'hPa' ? convert.hPaToInHg(altRaw) : altRaw;

    storage.set(STORAGE_KEY, {
      departureElevation: depElevEl.value,
      elevUnit: elevUnitEl.value,
      targetAltitude: targetEl.value,
      targetUnit: targetUnitEl.value,
      altimeter: altimeterEl.value,
      altimeterUnit: altUnitEl.value,
    });

    const results = calculateClimbPlan(profile, {
      departureElevation: depFt,
      targetElevation: tgtFt,
      altimeter: altInHg,
    });

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

  if (saved.departureElevation && saved.targetAltitude) {
    calculate();
  }
}

function renderResults(el, r) {
  const rocDepClass = rocSeverityClass(r.rocAtDeparture);
  const rocTgtClass = rocSeverityClass(r.rocAtTarget);
  const avgClass = r.averageRoc != null ? rocSeverityClass(r.averageRoc) : '';

  let html = `<ul class="results-list">`;

  // Time to climb — primary result
  if (r.timeToClimb != null) {
    html += `
      <li class="results-list__item results-list__item--highlight">
        <span class="results-list__label">Estimated Time to Climb</span>
        <span class="results-list__value">${formatNumber(r.timeToClimb, 1)} min</span>
      </li>`;
  }

  html += `
    <li class="results-list__item">
      <span class="results-list__label">Departure Pressure Alt</span>
      <span class="results-list__value">${formatNumber(r.departurePa)} ft</span>
    </li>
    <li class="results-list__item">
      <span class="results-list__label">Target Pressure Alt</span>
      <span class="results-list__value">${formatNumber(r.targetPa)} ft</span>
    </li>
    <li class="results-list__item">
      <span class="results-list__label">Altitude to Climb</span>
      <span class="results-list__value">${formatNumber(r.altitudeToClimb)} ft</span>
    </li>
    <li class="results-list__item">
      <span class="results-list__label">ROC at Departure</span>
      <span class="results-list__value ${rocDepClass}">${formatNumber(r.rocAtDeparture)} fpm</span>
    </li>
    <li class="results-list__item">
      <span class="results-list__label">ROC at Target</span>
      <span class="results-list__value ${rocTgtClass}">${formatNumber(r.rocAtTarget)} fpm</span>
    </li>`;

  if (r.averageRoc != null) {
    html += `
      <li class="results-list__item">
        <span class="results-list__label">Average ROC</span>
        <span class="results-list__value ${avgClass}">${formatNumber(r.averageRoc)} fpm</span>
      </li>`;
  }

  html += `
    <li class="results-list__item">
      <span class="results-list__label">Best Climb Speed (Vy)</span>
      <span class="results-list__value">${formatNumber(r.bestClimbSpeed)} KIAS</span>
    </li>
  </ul>`;

  // Warnings
  if (r.ceilingReached) {
    html += `<div class="alert alert--error">⚠ Service ceiling reached at ${formatNumber(r.ceilingAltitude)} ft PA — rate of climb dropped to zero before reaching target altitude.</div>`;
  }

  if (r.clamped) {
    html += `<div class="alert alert--warning">⚠ Altitude is outside POH data range — result clamped to ${r.clampedTo === 'min' ? 'minimum' : 'maximum'} table value.</div>`;
  }

  const minRoc = Math.min(r.rocAtDeparture, r.rocAtTarget);
  if (minRoc < 200) {
    html += `<div class="alert alert--error">⚠ Very low rate of climb — may be insufficient for safe obstacle clearance.</div>`;
  } else if (minRoc < 400) {
    html += `<div class="alert alert--warning">⚠ Reduced rate of climb — plan accordingly for terrain and obstacles.</div>`;
  }

  el.innerHTML = html;
}

function rocSeverityClass(roc) {
  if (roc < 200) return 'results-list__value--danger';
  if (roc < 400) return 'results-list__value--caution';
  return '';
}
