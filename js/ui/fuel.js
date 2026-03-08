import { calculateFuelPlan } from '../calc/fuel.js';
import { convert, formatNumber } from '../engine/units.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';
import { esc } from './perf-ui-common.js';

const STORAGE_KEY = 'fuel_inputs';

const DEFAULTS = {
  tripDistance: '',
  cruiseAltitude: '',
  altUnit: 'ft',
  altimeter: '29.92',
  altimeterUnit: 'inHg',
  rpm: '',
  fuelOnBoard: '',
  reserveMinutes: '45',
};

export function initFuel(panelEl) {
  const profile = getProfile();
  const saved = { ...DEFAULTS, ...storage.get(STORAGE_KEY, DEFAULTS) };
  const fuel = profile?.performance?.fuelConsumption;

  if (!fuel) {
    panelEl.innerHTML = `
      <div class="panel">
        <div class="alert alert--warning">⚠ No fuel consumption data available in the loaded profile.</div>
      </div>`;
    return;
  }

  const fuelConfig = profile.fuel;
  const fuelUnit = fuelConfig?.inputUnit || 'L';
  const fuelLabel = fuelUnit === 'us_gal' ? 'US gal' : fuelUnit;
  const maxFuel = getFuelMax(fuelConfig);

  const rpmValues = [...new Set(fuel.data.map((d) => d.rpm))].sort((a, b) => a - b);
  const rpmOptions = rpmValues
    .map((r) => `<option value="${r}" ${saved.rpm === String(r) ? 'selected' : ''}>${formatNumber(r)} RPM</option>`)
    .join('');

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Fuel Planner</h2>

        <div class="form-group">
          <label class="form-label" for="fp-distance">Trip Distance</label>
          <div class="form-suffix">
            <input class="form-input" id="fp-distance" type="number" inputmode="numeric"
                   min="0" placeholder="e.g. 150" value="${esc(saved.tripDistance)}">
            <span class="form-suffix__label">NM</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="fp-alt">Cruise Altitude</label>
            <div class="form-suffix">
              <input class="form-input" id="fp-alt" type="number" inputmode="numeric"
                     placeholder="${saved.altUnit === 'm' ? 'e.g. 1500' : 'e.g. 5000'}" value="${esc(saved.cruiseAltitude)}">
              <span class="form-suffix__label" id="fp-alt-suffix">${saved.altUnit}</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="fp-alt-unit">Unit</label>
            <select class="form-input" id="fp-alt-unit">
              <option value="ft" ${saved.altUnit === 'ft' ? 'selected' : ''}>ft</option>
              <option value="m" ${saved.altUnit === 'm' ? 'selected' : ''}>m</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="fp-altimeter">Altimeter Setting</label>
            <div class="form-suffix">
              <input class="form-input" id="fp-altimeter" type="number" inputmode="decimal"
                     step="0.01" placeholder="${saved.altimeterUnit === 'hPa' ? '1013.25' : '29.92'}" value="${esc(saved.altimeter)}">
              <span class="form-suffix__label" id="fp-altimeter-suffix">${saved.altimeterUnit}</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="fp-altimeter-unit">Unit</label>
            <select class="form-input" id="fp-altimeter-unit">
              <option value="inHg" ${saved.altimeterUnit === 'inHg' ? 'selected' : ''}>inHg</option>
              <option value="hPa" ${saved.altimeterUnit === 'hPa' ? 'selected' : ''}>hPa</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="fp-rpm">Cruise RPM</label>
          <select class="form-input" id="fp-rpm">
            <option value="">Select RPM…</option>
            ${rpmOptions}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="fp-fob">Fuel On Board</label>
          <div class="form-suffix">
            <input class="form-input" id="fp-fob" type="number" inputmode="decimal"
                   min="0" max="${maxFuel}" step="0.1" placeholder="e.g. ${maxFuel}" value="${esc(saved.fuelOnBoard)}">
            <span class="form-suffix__label">${fuelLabel}</span>
          </div>
          <div class="form-hint">Capacity: ${maxFuel} ${fuelLabel}</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="fp-reserve">Fuel Reserve</label>
          <div class="form-suffix">
            <input class="form-input" id="fp-reserve" type="number" inputmode="numeric"
                   min="0" step="5" placeholder="e.g. 45" value="${esc(saved.reserveMinutes)}">
            <span class="form-suffix__label">min</span>
          </div>
          <div class="form-hint">VFR day: 30 min · VFR night: 45 min · IFR: 45 min</div>
        </div>

        <button class="btn btn-primary btn-block" id="fp-calculate">Calculate</button>
      </div>

      <div class="panel">
        <h2 class="panel__title">Results</h2>
        <div id="fp-results">
          <div class="placeholder-message">
            <div class="placeholder-message__icon">⛽</div>
            <div class="placeholder-message__text">Enter trip details and press Calculate</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const distEl = panelEl.querySelector('#fp-distance');
  const altEl = panelEl.querySelector('#fp-alt');
  const altUnitEl = panelEl.querySelector('#fp-alt-unit');
  const altSuffix = panelEl.querySelector('#fp-alt-suffix');
  const altimeterEl = panelEl.querySelector('#fp-altimeter');
  const altimeterUnitEl = panelEl.querySelector('#fp-altimeter-unit');
  const altimeterSuffix = panelEl.querySelector('#fp-altimeter-suffix');
  const rpmEl = panelEl.querySelector('#fp-rpm');
  const fobEl = panelEl.querySelector('#fp-fob');
  const reserveEl = panelEl.querySelector('#fp-reserve');
  const calcBtn = panelEl.querySelector('#fp-calculate');
  const resultsEl = panelEl.querySelector('#fp-results');

  altUnitEl.addEventListener('change', () => {
    altSuffix.textContent = altUnitEl.value;
    altEl.placeholder = altUnitEl.value === 'm' ? 'e.g. 1500' : 'e.g. 5000';
  });

  altimeterUnitEl.addEventListener('change', () => {
    altimeterSuffix.textContent = altimeterUnitEl.value;
    altimeterEl.placeholder = altimeterUnitEl.value === 'hPa' ? '1013.25' : '29.92';
  });

  fobEl.addEventListener('change', () => {
    const val = parseFloat(fobEl.value);
    if (!isNaN(val) && val > maxFuel) {
      fobEl.value = maxFuel;
    }
  });

  function calculate() {
    const dist = parseFloat(distEl.value);
    const altRaw = parseFloat(altEl.value);
    const altimeterRaw = parseFloat(altimeterEl.value);
    const rpm = parseFloat(rpmEl.value);
    const fob = parseFloat(fobEl.value);
    const reserve = parseFloat(reserveEl.value);

    if (isNaN(dist) || isNaN(altRaw) || isNaN(altimeterRaw) || isNaN(rpm) || isNaN(fob)) {
      resultsEl.innerHTML = `<div class="alert alert--warning">⚠ Please fill in all fields.</div>`;
      return;
    }

    const altFt = altUnitEl.value === 'm' ? convert.mToFt(altRaw) : altRaw;
    const altInHg = altimeterUnitEl.value === 'hPa' ? convert.hPaToInHg(altimeterRaw) : altimeterRaw;

    storage.set(STORAGE_KEY, {
      tripDistance: distEl.value,
      cruiseAltitude: altEl.value,
      altUnit: altUnitEl.value,
      altimeter: altimeterEl.value,
      altimeterUnit: altimeterUnitEl.value,
      rpm: rpmEl.value,
      fuelOnBoard: fobEl.value,
      reserveMinutes: reserveEl.value,
    });

    const results = calculateFuelPlan(profile, {
      tripDistance: dist,
      cruiseAltitude: altFt,
      altimeter: altInHg,
      rpm,
      fuelOnBoard: fob,
      reserveMinutes: isNaN(reserve) ? 0 : reserve,
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

  if (saved.tripDistance && saved.rpm && saved.fuelOnBoard) {
    calculate();
  }
}

function renderResults(el, r) {
  const sufficientClass = r.sufficient ? '' : 'results-list__value--danger';
  const remainClass = r.remainingL < 0 ? 'results-list__value--danger'
    : r.remainingL < r.reserveFuelL ? 'results-list__value--caution' : '';

  let html = `<ul class="results-list">`;

  // Trip summary
  html += resultRow('Trip Distance', `${formatNumber(r.tripDistance)} NM`);
  html += resultRow('Cruise TAS', `${formatNumber(r.tasKt)} KTAS`);
  html += resultRow('Time En Route', formatDuration(r.timeEnRouteMin), true);

  // Fuel flow
  html += separatorRow('Fuel Flow', `${r.flowLph} L/hr (${r.flowGph} GPH)`);

  // Fuel breakdown
  html += resultRow('Trip Fuel', `${r.tripFuelL} L (${r.tripFuelGal} gal)`);
  html += resultRow(`Reserve (${r.reserveMinutes} min)`, `${r.reserveFuelL} L (${r.reserveFuelGal} gal)`);
  html += resultRow('Total Required', `${r.totalRequiredL} L (${r.totalRequiredGal} gal)`, true);

  // Fuel on board
  html += separatorRow('Fuel On Board (total)', `${r.fobL} L (${r.fobGal.toFixed(1)} gal)`);
  if (r.unusableL > 0) {
    html += resultRow('Unusable Fuel', `${r.unusableL} L`);
    html += resultRow('Usable Fuel', `${r.usableFobL} L (${r.usableFobGal.toFixed(1)} gal)`);
  }
  html += resultRow('Remaining After Trip',
    `${r.remainingL} L (${r.remainingGal.toFixed(1)} gal)`,
    false, remainClass);
  html += resultRow('Endurance After Trip', formatDuration(r.enduranceAfterTripMin), false,
    r.enduranceAfterTripMin < r.reserveMinutes ? 'results-list__value--caution' : '');

  // Total endurance & range
  html += separatorRow('Total Endurance', formatDuration(r.enduranceMin));
  html += resultRow('Total Range', `${formatNumber(r.rangeNm)} NM`);

  html += `</ul>`;

  // Alerts
  if (!r.sufficient) {
    const shortL = Math.abs(r.remainingL - r.reserveFuelL);
    html += `<div class="alert alert--error">⚠ Insufficient fuel — short by ${shortL.toFixed(1)} L for ${r.reserveMinutes} min reserve.</div>`;
  } else if (r.remainingL < 0) {
    html += `<div class="alert alert--error">⚠ Trip fuel exceeds fuel on board. Cannot complete trip.</div>`;
  } else if (r.remainingL > 0 && r.remainingL < r.reserveFuelL * 1.2) {
    html += `<div class="alert alert--warning">⚠ Fuel reserve is marginal — consider reducing trip distance or increasing fuel.</div>`;
  }

  if (r.densityCorrected) {
    html += `<div class="alert alert--info">ℹ Fuel flow adjusted for cruise altitude (density ratio correction).</div>`;
  }

  el.innerHTML = html;
}

function resultRow(label, value, highlight = false, extraClass = '') {
  const hlClass = highlight ? ' results-list__item--highlight' : '';
  return `
    <li class="results-list__item${hlClass}">
      <span class="results-list__label">${label}</span>
      <span class="results-list__value ${extraClass}">${value}</span>
    </li>`;
}

function separatorRow(label, value) {
  return `
    <li class="results-list__item results-list__item--separator">
      <span class="results-list__label">${label}</span>
      <span class="results-list__value">${value}</span>
    </li>`;
}

function formatDuration(totalMinutes) {
  if (totalMinutes <= 0) return '0 min';
  const hrs = Math.floor(totalMinutes / 60);
  const min = Math.round(totalMinutes % 60);
  if (hrs === 0) return `${min} min`;
  return `${hrs}h ${String(min).padStart(2, '0')}m`;
}

function getFuelMax(fuelConfig) {
  if (!fuelConfig?.capacity) return '';
  const cap = fuelConfig.capacity;
  const inputUnit = fuelConfig.inputUnit || 'L';
  if (inputUnit === cap.unit) return cap.value;
  if (inputUnit === 'us_gal' && cap.valueUSGal) return cap.valueUSGal;
  if (inputUnit === 'us_gal' && cap.unit === 'L') return Math.round(cap.value * 0.264172 * 10) / 10;
  if (inputUnit === 'L' && cap.unit === 'us_gal') return Math.round(cap.value * 3.78541 * 10) / 10;
  return cap.value;
}
