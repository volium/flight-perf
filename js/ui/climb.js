import { calculateClimbPlan } from '../calc/climb.js';
import { convert, formatNumber } from '../engine/units.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';
import { displayUnit, buildRefNote, esc } from './perf-ui-common.js';
import { getUnits, elevationPlaceholder, altitudePlaceholder, altimeterPlaceholder, altimeterDefault, displayAltitude } from '../data/unit-preferences.js';

const STORAGE_KEY = 'climb_inputs';

export function initClimb(panelEl) {
  const profile = getProfile();
  const units = getUnits();
  const saved = storage.get(STORAGE_KEY, {});
  const climb = profile?.performance?.climb;

  if (!climb) {
    panelEl.innerHTML = `
      <div class="panel">
        <div class="alert alert--warning">⚠ No climb performance data available in the loaded profile.</div>
      </div>`;
    return;
  }

  const depElev = saved.departureElevation ?? '';
  const tgtAlt = saved.targetAltitude ?? '';
  const alt = saved.altimeter ?? altimeterDefault(units.altimeter);
  const transAlt = saved.transitionAltitude ?? '';
  const cruiseSpd = saved.cruiseClimbSpeed ?? '';

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Climb Planner</h2>

        <div class="form-group">
          <label class="form-label" for="cl-dep-elev">Departure Field Elevation</label>
          <div class="form-suffix">
            <input class="form-input" id="cl-dep-elev" type="number" inputmode="numeric"
                   placeholder="${elevationPlaceholder(units.altitude)}" value="${esc(depElev)}">
            <span class="form-suffix__label">${units.altitude}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="cl-target">Target Altitude</label>
          <div class="form-suffix">
            <input class="form-input" id="cl-target" type="number" inputmode="numeric"
                   placeholder="${altitudePlaceholder(units.altitude)}" value="${esc(tgtAlt)}">
            <span class="form-suffix__label">${units.altitude}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="cl-altimeter">Altimeter Setting</label>
          <div class="form-suffix">
            <input class="form-input" id="cl-altimeter" type="number" inputmode="decimal"
                   step="0.01" placeholder="${altimeterPlaceholder(units.altimeter)}" value="${esc(alt)}">
            <span class="form-suffix__label">${units.altimeter}</span>
          </div>
        </div>

        <fieldset class="margin-fieldset">
          <legend class="margin-fieldset__legend">Cruise Climb</legend>

          <div class="form-group">
            <label class="form-label" for="cl-transition">Transition Altitude</label>
            <div class="form-suffix">
              <input class="form-input" id="cl-transition" type="number" inputmode="numeric"
                     placeholder="${altitudePlaceholder(units.altitude)}" value="${esc(transAlt)}">
              <span class="form-suffix__label">${units.altitude}</span>
            </div>
            <div class="form-hint">Switch from Vy to cruise climb at this altitude</div>
          </div>

          <div class="form-group">
            <label class="form-label" for="cl-cruise-speed">Cruise Climb Speed</label>
            <div class="form-suffix">
              <input class="form-input" id="cl-cruise-speed" type="number" inputmode="numeric"
                     step="1" placeholder="e.g. 85" value="${esc(cruiseSpd)}">
              <span class="form-suffix__label">KIAS</span>
            </div>
            <div class="form-hint">POH Vy: ${profile.speeds?.vy?.value ?? '—'} KIAS</div>
          </div>
        </fieldset>

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
  const targetEl = panelEl.querySelector('#cl-target');
  const altimeterEl = panelEl.querySelector('#cl-altimeter');
  const transEl = panelEl.querySelector('#cl-transition');
  const cruiseSpeedEl = panelEl.querySelector('#cl-cruise-speed');
  const calcBtn = panelEl.querySelector('#cl-calculate');
  const resultsEl = panelEl.querySelector('#cl-results');

  function calculate() {
    const currentUnits = getUnits();
    const depRaw = parseFloat(depElevEl.value);
    const tgtRaw = parseFloat(targetEl.value);
    const altRaw = parseFloat(altimeterEl.value);

    if (isNaN(depRaw) || isNaN(tgtRaw) || isNaN(altRaw)) {
      resultsEl.innerHTML = `<div class="alert alert--warning">⚠ Please fill in all fields with valid numbers.</div>`;
      return;
    }

    const depFt = currentUnits.altitude === 'm' ? convert.mToFt(depRaw) : depRaw;
    const tgtFt = currentUnits.altitude === 'm' ? convert.mToFt(tgtRaw) : tgtRaw;
    const altInHg = currentUnits.altimeter === 'hPa' ? convert.hPaToInHg(altRaw) : altRaw;

    const transRaw = parseFloat(transEl.value);
    const cruiseSpeed = parseFloat(cruiseSpeedEl.value);
    let transFt = null;

    if (!isNaN(transRaw)) {
      transFt = currentUnits.altitude === 'm' ? convert.mToFt(transRaw) : transRaw;
    }

    storage.set(STORAGE_KEY, {
      departureElevation: depElevEl.value,
      targetAltitude: targetEl.value,
      altimeter: altimeterEl.value,
      transitionAltitude: transEl.value,
      cruiseClimbSpeed: cruiseSpeedEl.value,
    });

    const results = calculateClimbPlan(getProfile(), {
      departureElevation: depFt,
      targetElevation: tgtFt,
      altimeter: altInHg,
      transitionElevation: transFt,
      cruiseClimbSpeed: !isNaN(cruiseSpeed) ? cruiseSpeed : null,
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

  const depPa = displayAltitude(r.departurePa);
  const tgtPa = displayAltitude(r.targetPa);
  const altClimb = displayAltitude(r.altitudeToClimb);

  let html = `<ul class="results-list">`;

  if (r.timeToClimb != null) {
    html += `
      <li class="results-list__item results-list__item--highlight">
        <span class="results-list__label">Estimated Time to Climb</span>
        <span class="results-list__value">${formatNumber(r.timeToClimb, 1)} min (~${Math.round(r.timeToClimb)} min)</span>
      </li>`;
  }

  html += `
    <li class="results-list__item">
      <span class="results-list__label">Departure Pressure Alt</span>
      <span class="results-list__value">${formatNumber(depPa.value)} ${depPa.unit}</span>
    </li>
    <li class="results-list__item">
      <span class="results-list__label">Target Pressure Alt</span>
      <span class="results-list__value">${formatNumber(tgtPa.value)} ${tgtPa.unit}</span>
    </li>
    <li class="results-list__item">
      <span class="results-list__label">Altitude to Climb</span>
      <span class="results-list__value">${formatNumber(altClimb.value)} ${altClimb.unit}</span>
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

  if (r.transitionPa != null && r.cruiseClimbFactor < 1) {
    const pct = Math.round(r.cruiseClimbFactor * 100);
    const transPa = displayAltitude(r.transitionPa);
    const speedNote = r.cruiseClimbSpeed ? ` at ${r.cruiseClimbSpeed} KIAS` : '';
    html += `<div class="alert alert--info">ℹ Vy climb below ${formatNumber(transPa.value)} ${transPa.unit} PA, then cruise climb${speedNote} (≈${pct}% of book ROC) above.</div>`;
  }

  if (r.ceilingReached) {
    const ceilAlt = displayAltitude(r.ceilingAltitude);
    html += `<div class="alert alert--error">⚠ Service ceiling reached at ${formatNumber(ceilAlt.value)} ${ceilAlt.unit} PA — rate of climb dropped to zero before reaching target altitude.</div>`;
  }

  if (r.extrapolated) {
    html += `<div class="alert alert--warning">⚠ Altitude is outside POH data range — results are extrapolated beyond known performance data. Use with caution.</div>`;
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
