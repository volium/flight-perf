import { calculateTakeoff } from '../calc/takeoff.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';
import {
  marginFieldsetHTML,
  initMarginFieldset,
  renderDistanceResults,
  buildRefNote,
} from './perf-ui-common.js';

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

  const refNote = buildRefNote(takeoff.referenceConditions, takeoff.description);

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

        ${marginFieldsetHTML('to', saved)}

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
  const calcBtn = panelEl.querySelector('#to-calculate');
  const resultsEl = panelEl.querySelector('#to-results');

  const marginCtrl = initMarginFieldset(panelEl, 'to', saved, () => unitEl.value);
  unitEl.addEventListener('change', () => marginCtrl.updateUI());

  function calculate() {
    const surface = surfaceEl.value;
    if (!surface) {
      resultsEl.innerHTML = `<div class="alert alert--warning">⚠ Please select a runway surface.</div>`;
      return;
    }

    storage.set(STORAGE_KEY, {
      surface: surfaceEl.value,
      distanceUnit: unitEl.value,
      ...marginCtrl.saveState(),
    });

    const results = calculateTakeoff(getProfile(), {
      surface,
      margins: marginCtrl.buildMargins(),
      distanceUnit: unitEl.value,
    });

    if (results.error) {
      resultsEl.innerHTML = `<div class="alert alert--error">⚠ ${results.error}</div>`;
      return;
    }

    renderDistanceResults(resultsEl, results);
  }

  calcBtn.addEventListener('click', calculate);

  if (saved.surface) {
    calculate();
  }
}
