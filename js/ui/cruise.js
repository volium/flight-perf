import { calculateCruise } from '../calc/cruise.js';
import { convert, formatNumber } from '../engine/units.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';
import { buildRefNote, esc } from './perf-ui-common.js';

const STORAGE_KEY = 'cruise_inputs';

const DEFAULTS = {
  altitude: '',
  altUnit: 'ft',
  altimeter: '29.92',
  altimeterUnit: 'inHg',
  rpm: '',
};

export function initCruise(panelEl) {
  const profile = getProfile();
  const saved = { ...DEFAULTS, ...storage.get(STORAGE_KEY, DEFAULTS) };
  const cruise = profile?.performance?.cruise;

  if (!cruise) {
    panelEl.innerHTML = `
      <div class="panel">
        <div class="alert alert--warning">⚠ No cruise performance data available in the loaded profile.</div>
      </div>`;
    return;
  }

  const rpmValues = [...new Set(cruise.data.map((d) => d.rpm))].sort((a, b) => a - b);
  const rpmOptions = rpmValues
    .map((r) => `<option value="${r}" ${saved.rpm === String(r) ? 'selected' : ''}>${formatNumber(r)} RPM</option>`)
    .join('');

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Cruise Performance</h2>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="cr-alt">Cruise Altitude</label>
            <div class="form-suffix">
              <input class="form-input" id="cr-alt" type="number" inputmode="numeric"
                     placeholder="${saved.altUnit === 'm' ? 'e.g. 1500' : 'e.g. 5000'}" value="${esc(saved.altitude)}">
              <span class="form-suffix__label" id="cr-alt-suffix">${saved.altUnit}</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="cr-alt-unit">Unit</label>
            <select class="form-input" id="cr-alt-unit">
              <option value="ft" ${saved.altUnit === 'ft' ? 'selected' : ''}>ft</option>
              <option value="m" ${saved.altUnit === 'm' ? 'selected' : ''}>m</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="cr-altimeter">Altimeter Setting</label>
            <div class="form-suffix">
              <input class="form-input" id="cr-altimeter" type="number" inputmode="decimal"
                     step="0.01" placeholder="${saved.altimeterUnit === 'hPa' ? '1013.25' : '29.92'}" value="${esc(saved.altimeter)}">
              <span class="form-suffix__label" id="cr-altimeter-suffix">${saved.altimeterUnit}</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="cr-altimeter-unit">Unit</label>
            <select class="form-input" id="cr-altimeter-unit">
              <option value="inHg" ${saved.altimeterUnit === 'inHg' ? 'selected' : ''}>inHg</option>
              <option value="hPa" ${saved.altimeterUnit === 'hPa' ? 'selected' : ''}>hPa</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="cr-rpm">Engine RPM</label>
          <select class="form-input" id="cr-rpm">
            <option value="">Select RPM…</option>
            ${rpmOptions}
          </select>
          <div class="form-hint">Range: ${formatNumber(rpmValues[0])} – ${formatNumber(rpmValues[rpmValues.length - 1])} RPM</div>
        </div>

        <button class="btn btn-primary btn-block" id="cr-calculate">Calculate</button>

        ${buildRefNote(null, cruise.description)}
      </div>

      <div class="panel">
        <h2 class="panel__title">Results</h2>
        <div id="cr-results">
          <div class="placeholder-message">
            <div class="placeholder-message__icon">✈️</div>
            <div class="placeholder-message__text">Enter altitude and RPM, then press Calculate</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const altEl = panelEl.querySelector('#cr-alt');
  const altUnitEl = panelEl.querySelector('#cr-alt-unit');
  const altSuffix = panelEl.querySelector('#cr-alt-suffix');
  const altimeterEl = panelEl.querySelector('#cr-altimeter');
  const altimeterUnitEl = panelEl.querySelector('#cr-altimeter-unit');
  const altimeterSuffix = panelEl.querySelector('#cr-altimeter-suffix');
  const rpmEl = panelEl.querySelector('#cr-rpm');
  const calcBtn = panelEl.querySelector('#cr-calculate');
  const resultsEl = panelEl.querySelector('#cr-results');

  altUnitEl.addEventListener('change', () => {
    altSuffix.textContent = altUnitEl.value;
    altEl.placeholder = altUnitEl.value === 'm' ? 'e.g. 1500' : 'e.g. 5000';
  });

  altimeterUnitEl.addEventListener('change', () => {
    altimeterSuffix.textContent = altimeterUnitEl.value;
    altimeterEl.placeholder = altimeterUnitEl.value === 'hPa' ? '1013.25' : '29.92';
  });

  function calculate() {
    const altRaw = parseFloat(altEl.value);
    const altimeterRaw = parseFloat(altimeterEl.value);
    const rpm = parseFloat(rpmEl.value);

    if (isNaN(altRaw) || isNaN(altimeterRaw)) {
      resultsEl.innerHTML = `<div class="alert alert--warning">⚠ Please enter altitude and altimeter setting.</div>`;
      return;
    }

    if (isNaN(rpm)) {
      resultsEl.innerHTML = `<div class="alert alert--warning">⚠ Please select an RPM setting.</div>`;
      return;
    }

    const altFt = altUnitEl.value === 'm' ? convert.mToFt(altRaw) : altRaw;
    const altInHg = altimeterUnitEl.value === 'hPa' ? convert.hPaToInHg(altimeterRaw) : altimeterRaw;

    storage.set(STORAGE_KEY, {
      altitude: altEl.value,
      altUnit: altUnitEl.value,
      altimeter: altimeterEl.value,
      altimeterUnit: altimeterUnitEl.value,
      rpm: rpmEl.value,
    });

    const results = calculateCruise(profile, {
      fieldElevation: altFt,
      altimeter: altInHg,
      rpm,
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

  if (saved.altitude && saved.rpm) {
    calculate();
  }
}

function renderResults(el, r) {
  let html = `<ul class="results-list">`;

  html += `
    <li class="results-list__item">
      <span class="results-list__label">Pressure Altitude</span>
      <span class="results-list__value">${formatNumber(r.pressureAltitude)} ft</span>
    </li>
    <li class="results-list__item">
      <span class="results-list__label">Engine RPM</span>
      <span class="results-list__value">${formatNumber(r.rpm)}</span>
    </li>`;

  html += `
    <li class="results-list__item results-list__item--highlight">
      <span class="results-list__label">True Airspeed (TAS)</span>
      <span class="results-list__value">${formatNumber(r.ktas)} KTAS</span>
    </li>
    <li class="results-list__item">
      <span class="results-list__label">Indicated Airspeed (IAS)</span>
      <span class="results-list__value">${formatNumber(r.kias)} KIAS</span>
    </li>`;

  if (r.fuelFlow) {
    html += `
      <li class="results-list__item results-list__item--separator">
        <span class="results-list__label">Fuel Flow</span>
        <span class="results-list__value">${r.fuelFlow.lph} L/hr (${r.fuelFlow.gph} GPH)</span>
      </li>`;
  }

  if (r.endurance) {
    const durStr = `${r.endurance.hours}h ${String(r.endurance.minutes).padStart(2, '0')}m`;
    html += `
      <li class="results-list__item">
        <span class="results-list__label">Endurance (full fuel)</span>
        <span class="results-list__value">${durStr}</span>
      </li>`;
  }

  if (r.range != null) {
    html += `
      <li class="results-list__item">
        <span class="results-list__label">Range (full fuel, no reserve)</span>
        <span class="results-list__value">${formatNumber(r.range)} NM</span>
      </li>`;
  }

  html += `</ul>`;

  if (r.clamped) {
    html += `<div class="alert alert--warning">⚠ Input is outside POH data range — results are clamped to boundary values.</div>`;
  }

  if (r.fuelReferenceConditions) {
    const cond = r.fuelReferenceConditions;
    const parts = [];
    if (cond.altitude) parts.push(`${cond.altitude.value} ${cond.altitude.unit}`);
    if (cond.atmosphere) parts.push(cond.atmosphere);
    html += `<div class="to-ref-note">Fuel data reference: ${parts.join(' · ')}</div>`;
  }

  el.innerHTML = html;
}
