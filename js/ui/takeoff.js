import { calculateTakeoff } from '../calc/takeoff.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';
import {
  marginFieldsetHTML,
  initMarginFieldset,
  renderDistanceResults,
  buildRefNote,
  esc,
} from './perf-ui-common.js';
import { getUnits, elevationPlaceholder, altimeterPlaceholder, altimeterDefault } from '../data/unit-preferences.js';
import { pressureAltitude } from '../calc/density-altitude.js';
import { convert } from '../engine/units.js';

const STORAGE_KEY = 'takeoff_inputs';

const DEFAULTS = {
  surface: '',
  fieldElevation: '',
  altimeter: '',
  oat: '',
  weight: '',
  marginType: 'none',
  marginPctValue: '',
  marginFixedValue: '',
  marginRoundUp: false,
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

  const method = takeoff.method;
  const refNote = buildRefNote(takeoff.referenceConditions, takeoff.description);

  if (method === 'reference_table') {
    renderReferenceTableUI(panelEl, takeoff, saved, refNote);
  } else if (method === 'table_interpolation') {
    renderTableInterpolationUI(panelEl, takeoff, saved, refNote, profile);
  } else {
    panelEl.innerHTML = `
      <div class="panel">
        <div class="alert alert--error">⚠ Unsupported takeoff method: ${method}</div>
      </div>`;
  }
}

function renderReferenceTableUI(panelEl, takeoff, saved, refNote) {
  const surfaceOptions = takeoff.data
    .map(
      (d) =>
        `<option value="${d.surface}" ${saved.surface === d.surface ? 'selected' : ''}>${d.surfaceLabel}</option>`,
    )
    .join('');

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Takeoff Performance</h2>
        <div class="form-group">
          <label class="form-label" for="to-surface">Runway Surface</label>
          <select class="form-input" id="to-surface">${surfaceOptions}</select>
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
  const calcBtn = panelEl.querySelector('#to-calculate');
  const resultsEl = panelEl.querySelector('#to-results');
  const marginCtrl = initMarginFieldset(panelEl, 'to', saved, () => getUnits().distance);

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

    const results = calculateTakeoff(getProfile(), {
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
  if (saved.surface) calculate();
}

function renderTableInterpolationUI(panelEl, takeoff, saved, refNote, profile) {
  const units = getUnits();
  const hasWeight = (takeoff.variables || []).includes('weight');
  const altDefault = saved.altimeter || altimeterDefault(units.altimeter);
  const weightUnit = profile?.weightBalance?.weightUnit || 'lbs';
  const mtow = profile?.limits?.maxTakeoffWeight?.value || '';

  // Build surface options from corrections
  const corrections = takeoff.corrections || [];
  const hasGrass = corrections.some((c) => c.type === 'grass_runway');

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Takeoff Performance</h2>

        <div class="form-group">
          <label class="form-label" for="to-field-elev">Field Elevation</label>
          <div class="form-suffix">
            <input class="form-input" id="to-field-elev" type="number" inputmode="numeric"
                   placeholder="${elevationPlaceholder(units.altitude)}" value="${esc(saved.fieldElevation)}">
            <span class="form-suffix__label">${units.altitude}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="to-oat">Outside Air Temp (OAT)</label>
          <div class="form-suffix">
            <input class="form-input" id="to-oat" type="number" inputmode="decimal"
                   placeholder="e.g. 20" value="${esc(saved.oat)}">
            <span class="form-suffix__label">°${units.temperature}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="to-altimeter">Altimeter Setting</label>
          <div class="form-suffix">
            <input class="form-input" id="to-altimeter" type="number" inputmode="decimal"
                   step="0.01" placeholder="${altimeterPlaceholder(units.altimeter)}" value="${esc(altDefault)}">
            <span class="form-suffix__label">${units.altimeter}</span>
          </div>
        </div>

        ${hasWeight ? `
        <div class="form-group">
          <label class="form-label" for="to-weight">Aircraft Weight</label>
          <div class="form-suffix">
            <input class="form-input" id="to-weight" type="number" inputmode="numeric"
                   placeholder="${mtow} (MTOW)" value="${esc(saved.weight)}">
            <span class="form-suffix__label">${weightUnit}</span>
          </div>
        </div>
        ` : ''}

        ${hasGrass ? `
        <div class="form-group">
          <label class="form-label" for="to-surface">Runway Surface</label>
          <select class="form-input" id="to-surface">
            <option value="paved" ${saved.surface !== 'grass' ? 'selected' : ''}>Paved</option>
            <option value="grass" ${saved.surface === 'grass' ? 'selected' : ''}>Dry Grass</option>
          </select>
        </div>
        ` : ''}

        ${marginFieldsetHTML('to', saved)}

        <button class="btn btn-primary btn-block" id="to-calculate">Calculate</button>

        ${refNote}
      </div>

      <div class="panel">
        <h2 class="panel__title">Results</h2>
        <div id="to-results">
          <div class="placeholder-message">
            <div class="placeholder-message__icon">🛫</div>
            <div class="placeholder-message__text">Enter conditions and press Calculate</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const fieldElevEl = panelEl.querySelector('#to-field-elev');
  const oatEl = panelEl.querySelector('#to-oat');
  const altimeterEl = panelEl.querySelector('#to-altimeter');
  const weightEl = panelEl.querySelector('#to-weight');
  const surfaceEl = panelEl.querySelector('#to-surface');
  const calcBtn = panelEl.querySelector('#to-calculate');
  const resultsEl = panelEl.querySelector('#to-results');
  const marginCtrl = initMarginFieldset(panelEl, 'to', saved, () => getUnits().distance);

  function calculate() {
    const fieldElev = parseFloat(fieldElevEl.value);
    const oat = parseFloat(oatEl.value);
    const altSetting = parseFloat(altimeterEl.value);

    if (isNaN(fieldElev) || isNaN(oat) || isNaN(altSetting)) {
      resultsEl.innerHTML = `<div class="alert alert--warning">⚠ Please enter field elevation, OAT, and altimeter setting.</div>`;
      return;
    }

    const currentUnits = getUnits();

    // Convert to internal units (ft, °C, inHg)
    const fieldElevFt = currentUnits.altitude === 'm' ? convert.mToFt(fieldElev) : fieldElev;
    const oatC = currentUnits.temperature === 'F' ? convert.fToC(oat) : oat;
    const altInHg = currentUnits.altimeter === 'hPa' ? convert.hPaToInHg(altSetting) : altSetting;

    const pa = Math.round(pressureAltitude(fieldElevFt, altInHg));

    const weight = weightEl ? parseFloat(weightEl.value) || null : null;
    const surface = surfaceEl?.value || 'paved';

    // Build active corrections
    const activeCorrections = [];
    if (surface === 'grass') {
      activeCorrections.push({ type: 'grass_runway' });
    }

    storage.set(STORAGE_KEY, {
      fieldElevation: fieldElevEl.value,
      oat: oatEl.value,
      altimeter: altimeterEl.value,
      weight: weightEl?.value || '',
      surface,
      ...marginCtrl.saveState(),
    });

    const results = calculateTakeoff(getProfile(), {
      pressureAltitude: pa,
      temperature: oatC,
      weight,
      corrections: activeCorrections.length > 0 ? activeCorrections : null,
      margins: marginCtrl.buildMargins(),
      distanceUnit: currentUnits.distance,
    });

    if (results.error) {
      resultsEl.innerHTML = `<div class="alert alert--error">⚠ ${results.error}</div>`;
      return;
    }

    renderDistanceResults(resultsEl, results);
  }

  calcBtn.addEventListener('click', calculate);

  if (saved.fieldElevation && saved.oat) calculate();
}
