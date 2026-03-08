import { calculateDensityAltitude } from '../calc/density-altitude.js';
import { formatNumber } from '../engine/units.js';
import { storage } from '../data/storage.js';
import { esc } from './perf-ui-common.js';
import { getUnits, elevationPlaceholder, altimeterPlaceholder, altimeterDefault } from '../data/unit-preferences.js';

const STORAGE_KEY = 'density_inputs';

export function initDensityAltitude(panelEl) {
  const units = getUnits();
  const saved = storage.get(STORAGE_KEY, {});

  const fieldElev = saved.fieldElevation ?? '';
  const alt = saved.altimeter ?? altimeterDefault(units.altimeter);
  const oat = saved.oat ?? '';

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Density Altitude</h2>

        <div class="form-group">
          <label class="form-label" for="da-field-elev">Field Elevation</label>
          <div class="form-suffix">
            <input class="form-input" id="da-field-elev" type="number" inputmode="numeric"
                   placeholder="${elevationPlaceholder(units.altitude)}" value="${esc(fieldElev)}">
            <span class="form-suffix__label">${units.altitude}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="da-oat">Outside Air Temp (OAT)</label>
          <div class="form-suffix">
            <input class="form-input" id="da-oat" type="number" inputmode="decimal"
                   placeholder="e.g. 30" value="${esc(oat)}">
            <span class="form-suffix__label">°${units.temperature}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="da-altimeter">Altimeter Setting</label>
          <div class="form-suffix">
            <input class="form-input" id="da-altimeter" type="number" inputmode="decimal"
                   step="0.01" placeholder="${altimeterPlaceholder(units.altimeter)}" value="${esc(alt)}">
            <span class="form-suffix__label">${units.altimeter}</span>
          </div>
        </div>

        <button class="btn btn-primary btn-block" id="da-calculate">Calculate</button>
      </div>

      <div class="panel" id="da-results-panel">
        <h2 class="panel__title">Results</h2>
        <div id="da-results">
          <div class="placeholder-message">
            <div class="placeholder-message__icon">🌡️</div>
            <div class="placeholder-message__text">Enter values and press Calculate</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const elev = panelEl.querySelector('#da-field-elev');
  const oatEl = panelEl.querySelector('#da-oat');
  const altimeter = panelEl.querySelector('#da-altimeter');
  const calcBtn = panelEl.querySelector('#da-calculate');
  const resultsEl = panelEl.querySelector('#da-results');

  function calculate() {
    const fieldElevation = parseFloat(elev.value);
    const oatVal = parseFloat(oatEl.value);
    const altVal = parseFloat(altimeter.value);

    if (isNaN(fieldElevation) || isNaN(oatVal) || isNaN(altVal)) {
      resultsEl.innerHTML = `
        <div class="alert alert--warning">⚠ Please fill in all fields with valid numbers.</div>
      `;
      return;
    }

    const currentUnits = getUnits();

    storage.set(STORAGE_KEY, {
      fieldElevation: elev.value,
      altimeter: altimeter.value,
      oat: oatEl.value,
    });

    const results = calculateDensityAltitude({
      fieldElevation,
      elevUnit: currentUnits.altitude,
      altimeter: altVal,
      altimeterUnit: currentUnits.altimeter,
      oat: oatVal,
      tempUnit: currentUnits.temperature,
    });

    renderResults(resultsEl, results);
  }

  calcBtn.addEventListener('click', calculate);

  panelEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input')) {
      calculate();
    }
  });
}

function renderResults(el, r) {
  const daClass =
    r.densityAltitude > 7000
      ? 'results-list__value--danger'
      : r.densityAltitude > 4000
        ? 'results-list__value--caution'
        : '';

  const deviationSign = r.isaDeviation > 0 ? '+' : '';

  el.innerHTML = `
    <ul class="results-list">
      <li class="results-list__item">
        <span class="results-list__label">Pressure Altitude</span>
        <span class="results-list__value">${formatNumber(r.pressureAltitude)} ft</span>
      </li>
      <li class="results-list__item results-list__item--highlight">
        <span class="results-list__label">Density Altitude</span>
        <span class="results-list__value ${daClass}">${formatNumber(r.densityAltitude)} ft</span>
      </li>
      <li class="results-list__item">
        <span class="results-list__label">ISA Temp at Altitude</span>
        <span class="results-list__value">${formatNumber(r.isaTemperature, 1)} °C</span>
      </li>
      <li class="results-list__item">
        <span class="results-list__label">ISA Deviation</span>
        <span class="results-list__value">${deviationSign}${formatNumber(r.isaDeviation, 1)} °C</span>
      </li>
      <li class="results-list__item">
        <span class="results-list__label">OAT</span>
        <span class="results-list__value">${formatNumber(r.oatC, 1)} °C / ${formatNumber(r.oatF, 1)} °F</span>
      </li>
      <li class="results-list__item">
        <span class="results-list__label">Altimeter</span>
        <span class="results-list__value">${r.altimeterInHg} inHg / ${r.altimeterHPa} hPa</span>
      </li>
      <li class="results-list__item">
        <span class="results-list__label">Density Ratio (σ)</span>
        <span class="results-list__value">${r.densityRatio}</span>
      </li>
    </ul>
    ${densityAltitudeAlert(r)}
  `;
}

function densityAltitudeAlert(r) {
  if (r.densityAltitude > 7000) {
    return `<div class="alert alert--error">⚠ High density altitude — significantly reduced aircraft performance. Review takeoff and climb data carefully.</div>`;
  }
  if (r.densityAltitude > 4000) {
    return `<div class="alert alert--warning">⚠ Elevated density altitude — expect reduced climb and takeoff performance.</div>`;
  }
  if (r.densityAltitude < 0) {
    return `<div class="alert alert--info">ℹ Below sea level standard — performance better than standard conditions.</div>`;
  }
  return '';
}
