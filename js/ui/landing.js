import { calculateLanding } from '../calc/landing.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';
import {
  marginFieldsetHTML,
  initMarginFieldset,
  renderDistanceResults,
  buildRefNote,
} from './perf-ui-common.js';
import { getUnits } from '../data/unit-preferences.js';

const STORAGE_KEY = 'landing_inputs';

const DEFAULTS = {
  surface: '',
  marginType: 'none',
  marginPctValue: '',
  marginFixedValue: '',
  marginRoundUp: false,
};

export function initLanding(panelEl) {
  const profile = getProfile();
  const saved = storage.get(STORAGE_KEY, DEFAULTS);
  const landing = profile?.performance?.landing;

  if (!landing) {
    panelEl.innerHTML = `
      <div class="panel">
        <div class="alert alert--warning">⚠ No landing performance data available in the loaded profile.</div>
      </div>`;
    return;
  }

  const surfaceOptions = landing.data
    .map(
      (d) =>
        `<option value="${d.surface}" ${saved.surface === d.surface ? 'selected' : ''}>${d.surfaceLabel}</option>`,
    )
    .join('');

  const refNote = buildRefNote(landing.referenceConditions, landing.description);

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Landing Performance</h2>

        <div class="form-group">
          <label class="form-label" for="ld-surface">Runway Surface</label>
          <select class="form-input" id="ld-surface">${surfaceOptions}</select>
        </div>

        ${marginFieldsetHTML('ld', saved)}

        <button class="btn btn-primary btn-block" id="ld-calculate">Calculate</button>

        ${refNote}
      </div>

      <div class="panel">
        <h2 class="panel__title">Results</h2>
        <div id="ld-results">
          <div class="placeholder-message">
            <div class="placeholder-message__icon">🛬</div>
            <div class="placeholder-message__text">Select surface and press Calculate</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const surfaceEl = panelEl.querySelector('#ld-surface');
  const calcBtn = panelEl.querySelector('#ld-calculate');
  const resultsEl = panelEl.querySelector('#ld-results');

  const marginCtrl = initMarginFieldset(panelEl, 'ld', saved, () => getUnits().distance);

  function calculate() {
    const surface = surfaceEl.value;
    if (!surface) {
      resultsEl.innerHTML = `<div class="alert alert--warning">⚠ Please select a runway surface.</div>`;
      return;
    }

    storage.set(STORAGE_KEY, {
      surface: surfaceEl.value,
      ...marginCtrl.saveState(),
    });

    const results = calculateLanding(getProfile(), {
      surface,
      margins: marginCtrl.buildMargins(),
      distanceUnit: getUnits().distance,
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
