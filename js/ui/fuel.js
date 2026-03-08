import { calculateFuelPlan } from '../calc/fuel.js';
import { convert, formatNumber } from '../engine/units.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';
import { esc } from './perf-ui-common.js';
import { getUnits, altitudePlaceholder, altimeterPlaceholder, altimeterDefault, fuelUnitLabel } from '../data/unit-preferences.js';

const STORAGE_KEY = 'fuel_inputs';

export function initFuel(panelEl) {
  const profile = getProfile();
  const units = getUnits();
  const saved = storage.get(STORAGE_KEY, {});
  const fuel = profile?.performance?.fuelConsumption;

  if (!fuel) {
    panelEl.innerHTML = `
      <div class="panel">
        <div class="alert alert--warning">⚠ No fuel consumption data available in the loaded profile.</div>
      </div>`;
    return;
  }

  const fuelConfig = profile.fuel;
  const fuelLabel = fuelUnitLabel(units.fuel);
  const maxFuel = getFuelMax(fuelConfig, units.fuel);

  const rpmValues = [...new Set(fuel.data.map((d) => d.rpm))].sort((a, b) => a - b);
  const rpmOptions = rpmValues
    .map((r) => `<option value="${r}" ${saved.rpm === String(r) ? 'selected' : ''}>${formatNumber(r)} RPM</option>`)
    .join('');

  const cruiseAlt = saved.cruiseAltitude ?? '';
  const altm = saved.altimeter ?? altimeterDefault(units.altimeter);

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Fuel Planner</h2>

        <div class="form-group">
          <label class="form-label" for="fp-distance">Trip Distance</label>
          <div class="form-suffix">
            <input class="form-input" id="fp-distance" type="number" inputmode="numeric"
                   min="0" placeholder="e.g. 150" value="${esc(saved.tripDistance ?? '')}">
            <span class="form-suffix__label">NM</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="fp-alt">Cruise Altitude</label>
          <div class="form-suffix">
            <input class="form-input" id="fp-alt" type="number" inputmode="numeric"
                   placeholder="${altitudePlaceholder(units.altitude)}" value="${esc(cruiseAlt)}">
            <span class="form-suffix__label">${units.altitude}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="fp-altimeter">Altimeter Setting</label>
          <div class="form-suffix">
            <input class="form-input" id="fp-altimeter" type="number" inputmode="decimal"
                   step="0.01" placeholder="${altimeterPlaceholder(units.altimeter)}" value="${esc(altm)}">
            <span class="form-suffix__label">${units.altimeter}</span>
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
                   min="0" max="${maxFuel}" step="0.1" placeholder="e.g. ${maxFuel}" value="${esc(saved.fuelOnBoard ?? '')}">
            <span class="form-suffix__label">${fuelLabel}</span>
          </div>
          <div class="form-hint">Capacity: ${maxFuel} ${fuelLabel}</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="fp-reserve">Fuel Reserve</label>
          <div class="form-suffix">
            <input class="form-input" id="fp-reserve" type="number" inputmode="numeric"
                   min="0" step="5" placeholder="e.g. 45" value="${esc(saved.reserveMinutes ?? '45')}">
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
  const altimeterEl = panelEl.querySelector('#fp-altimeter');
  const rpmEl = panelEl.querySelector('#fp-rpm');
  const fobEl = panelEl.querySelector('#fp-fob');
  const reserveEl = panelEl.querySelector('#fp-reserve');
  const calcBtn = panelEl.querySelector('#fp-calculate');
  const resultsEl = panelEl.querySelector('#fp-results');

  fobEl.addEventListener('change', () => {
    const val = parseFloat(fobEl.value);
    if (!isNaN(val) && val > maxFuel) {
      fobEl.value = maxFuel;
    }
  });

  function calculate() {
    const currentUnits = getUnits();
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

    const altFt = currentUnits.altitude === 'm' ? convert.mToFt(altRaw) : altRaw;
    const altInHg = currentUnits.altimeter === 'hPa' ? convert.hPaToInHg(altimeterRaw) : altimeterRaw;

    // Convert fuel on board to the profile's native fuel input unit for the calc engine
    let fobForCalc = fob;
    const profileFuelUnit = profile.fuel?.inputUnit || 'us_gal';
    if (currentUnits.fuel !== profileFuelUnit) {
      if (currentUnits.fuel === 'L' && profileFuelUnit === 'us_gal') fobForCalc = convert.lToUSGal(fob);
      else if (currentUnits.fuel === 'us_gal' && profileFuelUnit === 'L') fobForCalc = convert.usGalToL(fob);
    }

    storage.set(STORAGE_KEY, {
      tripDistance: distEl.value,
      cruiseAltitude: altEl.value,
      altimeter: altimeterEl.value,
      rpm: rpmEl.value,
      fuelOnBoard: fobEl.value,
      reserveMinutes: reserveEl.value,
    });

    const results = calculateFuelPlan(getProfile(), {
      tripDistance: dist,
      cruiseAltitude: altFt,
      altimeter: altInHg,
      rpm,
      fuelOnBoard: fobForCalc,
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
  const remainClass = r.remainingL < 0 ? 'results-list__value--danger'
    : r.remainingL < r.reserveFuelL ? 'results-list__value--caution' : '';

  let html = `<ul class="results-list">`;

  html += resultRow('Trip Distance', `${formatNumber(r.tripDistance)} NM`);
  html += resultRow('Cruise TAS', `${formatNumber(r.tasKt)} KTAS`);
  html += resultRow('Time En Route', formatDuration(r.timeEnRouteMin), true);

  html += separatorRow('Fuel Flow', `${r.flowLph} L/hr (${r.flowGph} GPH)`);

  html += resultRow('Trip Fuel', `${r.tripFuelL} L (${r.tripFuelGal} gal)`);
  html += resultRow(`Reserve (${r.reserveMinutes} min)`, `${r.reserveFuelL} L (${r.reserveFuelGal} gal)`);
  html += resultRow('Total Required', `${r.totalRequiredL} L (${r.totalRequiredGal} gal)`, true);

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

  html += separatorRow('Total Endurance', formatDuration(r.enduranceMin));
  html += resultRow('Total Range', `${formatNumber(r.rangeNm)} NM`);

  html += `</ul>`;

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

function getFuelMax(fuelConfig, fuelUnit) {
  if (!fuelConfig?.capacity) return '';
  const cap = fuelConfig.capacity;
  if (fuelUnit === cap.unit) return cap.value;
  if (fuelUnit === 'us_gal' && cap.valueUSGal) return cap.valueUSGal;
  if (fuelUnit === 'us_gal' && cap.unit === 'L') return Math.round(cap.value * 0.264172 * 10) / 10;
  if (fuelUnit === 'L' && cap.unit === 'us_gal') return Math.round(cap.value * 3.78541 * 10) / 10;
  if (fuelUnit === 'L' && cap.valueUSGal) return Math.round(cap.valueUSGal * 3.78541 * 10) / 10;
  return cap.value;
}
