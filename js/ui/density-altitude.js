import { calculateDensityAltitude } from '../calc/density-altitude.js';
import { formatNumber } from '../engine/units.js';
import { storage } from '../data/storage.js';

const STORAGE_KEY = 'density_inputs';

const DEFAULTS = {
  fieldElevation: '',
  altimeter: '29.92',
  altimeterUnit: 'inHg',
  oat: '',
  tempUnit: 'C',
};

export function initDensityAltitude(panelEl) {
  const saved = storage.get(STORAGE_KEY, DEFAULTS);

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Density Altitude</h2>

        <div class="form-group">
          <label class="form-label" for="da-field-elev">Field Elevation</label>
          <div class="form-suffix">
            <input class="form-input" id="da-field-elev" type="number" inputmode="numeric"
                   placeholder="e.g. 1200" value="${esc(saved.fieldElevation)}">
            <span class="form-suffix__label">ft</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="da-oat">Outside Air Temp (OAT)</label>
            <div class="form-suffix">
              <input class="form-input" id="da-oat" type="number" inputmode="decimal"
                     placeholder="e.g. 30" value="${esc(saved.oat)}">
              <span class="form-suffix__label" id="da-temp-suffix">°${saved.tempUnit}</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="da-temp-unit">Unit</label>
            <select class="form-input" id="da-temp-unit">
              <option value="C" ${saved.tempUnit === 'C' ? 'selected' : ''}>°C</option>
              <option value="F" ${saved.tempUnit === 'F' ? 'selected' : ''}>°F</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="da-altimeter">Altimeter Setting</label>
            <div class="form-suffix">
              <input class="form-input" id="da-altimeter" type="number" inputmode="decimal"
                     step="0.01" placeholder="29.92" value="${esc(saved.altimeter)}">
              <span class="form-suffix__label" id="da-alt-suffix">${saved.altimeterUnit}</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="da-alt-unit">Unit</label>
            <select class="form-input" id="da-alt-unit">
              <option value="inHg" ${saved.altimeterUnit === 'inHg' ? 'selected' : ''}>inHg</option>
              <option value="hPa" ${saved.altimeterUnit === 'hPa' ? 'selected' : ''}>hPa</option>
            </select>
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
  const oat = panelEl.querySelector('#da-oat');
  const tempUnit = panelEl.querySelector('#da-temp-unit');
  const tempSuffix = panelEl.querySelector('#da-temp-suffix');
  const altimeter = panelEl.querySelector('#da-altimeter');
  const altUnit = panelEl.querySelector('#da-alt-unit');
  const altSuffix = panelEl.querySelector('#da-alt-suffix');
  const calcBtn = panelEl.querySelector('#da-calculate');
  const resultsEl = panelEl.querySelector('#da-results');

  tempUnit.addEventListener('change', () => {
    tempSuffix.textContent = `°${tempUnit.value}`;
    if (tempUnit.value === 'hPa') {
      altimeter.placeholder = '1013.25';
    }
  });

  altUnit.addEventListener('change', () => {
    altSuffix.textContent = altUnit.value;
    altimeter.placeholder = altUnit.value === 'hPa' ? '1013.25' : '29.92';
  });

  function calculate() {
    const fieldElevation = parseFloat(elev.value);
    const oatVal = parseFloat(oat.value);
    const altVal = parseFloat(altimeter.value);

    if (isNaN(fieldElevation) || isNaN(oatVal) || isNaN(altVal)) {
      resultsEl.innerHTML = `
        <div class="alert alert--warning">⚠ Please fill in all fields with valid numbers.</div>
      `;
      return;
    }

    storage.set(STORAGE_KEY, {
      fieldElevation: elev.value,
      altimeter: altimeter.value,
      altimeterUnit: altUnit.value,
      oat: oat.value,
      tempUnit: tempUnit.value,
    });

    const results = calculateDensityAltitude({
      fieldElevation,
      altimeter: altVal,
      altimeterUnit: altUnit.value,
      oat: oatVal,
      tempUnit: tempUnit.value,
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

function esc(val) {
  if (val == null) return '';
  return String(val).replace(/"/g, '&quot;');
}
