import { calculateWeightBalance } from '../calc/weight-balance.js';
import { convert, formatNumber } from '../engine/units.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';
import { displayUnit, esc } from './perf-ui-common.js';
import { getUnits, fuelUnitLabel } from '../data/unit-preferences.js';

const STORAGE_KEY = 'wb_inputs';

export function initWeightBalance(panelEl) {
  const profile = getProfile();
  const wb = profile?.weightBalance;

  if (!wb) {
    panelEl.innerHTML = `
      <div class="panel">
        <div class="alert alert--warning">⚠ No weight & balance data available in the loaded profile.</div>
      </div>`;
    return;
  }

  const units = getUnits();
  const saved = storage.get(STORAGE_KEY, {});
  const fuelConfig = profile.fuel;
  const fuelLabel = fuelUnitLabel(units.fuel);
  const weightUnit = units.weight;
  const profileWeightUnit = wb.weightUnit || 'kg';

  const nonFuelStations = wb.stations.filter((s) => !s.fuelStation);

  // Convert profile values to display weight unit
  const emptyWeightDisplay = Math.round(convertWeight(profile.limits.emptyWeight.value, profileWeightUnit, weightUnit));
  const maxTakeoffDisplay = convertWeight(profile.limits.maxTakeoffWeight.value, profileWeightUnit, weightUnit);

  let stationHTML = '';
  for (const station of nonFuelStations) {
    const savedVal = saved[station.id] ?? '';
    let maxNote = '';
    if (station.maxWeight) {
      const maxDisplay = convertWeight(station.maxWeight.value, station.maxWeight.unit || profileWeightUnit, weightUnit);
      maxNote = `<div class="form-hint">Max: ${formatNumber(maxDisplay)} ${weightUnit}</div>`;
    }

    stationHTML += `
      <div class="form-group">
        <label class="form-label" for="wb-${station.id}">${station.name}</label>
        <div class="form-suffix">
          <input class="form-input" id="wb-${station.id}" type="number" inputmode="decimal"
                 min="0" step="0.1" placeholder="0" value="${esc(savedVal)}"
                 data-station-id="${station.id}">
          <span class="form-suffix__label">${weightUnit}</span>
        </div>
        ${maxNote}
      </div>`;
  }

  const maxFuelDisplay = getFuelMax(fuelConfig, units.fuel);
  const maxFuelNote = maxFuelDisplay
    ? `<div class="form-hint">Capacity: ${maxFuelDisplay} ${fuelLabel}</div>`
    : '';

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Weight &amp; Balance</h2>

        <div class="wb-section-label">Empty Weight: ${formatNumber(emptyWeightDisplay)} ${weightUnit}</div>

        ${stationHTML}

        <div class="form-group">
          <label class="form-label" for="wb-fuel">Fuel</label>
          <div class="form-suffix">
            <input class="form-input" id="wb-fuel" type="number" inputmode="decimal"
                   min="0" max="${maxFuelDisplay}" step="0.1" placeholder="0" value="${esc(saved._fuel ?? '')}">
            <span class="form-suffix__label">${fuelLabel}</span>
          </div>
          ${maxFuelNote}
        </div>

        <button class="btn btn-primary btn-block" id="wb-calculate">Calculate</button>
      </div>

      <div class="panel">
        <h2 class="panel__title">Results</h2>
        <div id="wb-results">
          <div class="placeholder-message">
            <div class="placeholder-message__icon">⚖️</div>
            <div class="placeholder-message__text">Enter weights and press Calculate</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const fuelEl = panelEl.querySelector('#wb-fuel');
  const calcBtn = panelEl.querySelector('#wb-calculate');
  const resultsEl = panelEl.querySelector('#wb-results');

  fuelEl.addEventListener('change', () => {
    const val = parseFloat(fuelEl.value);
    if (!isNaN(val) && val > maxFuelDisplay) {
      fuelEl.value = maxFuelDisplay;
    }
    // Save clamped value immediately so unit conversion uses the correct value
    const saved = storage.get(STORAGE_KEY, {});
    saved._fuel = fuelEl.value;
    storage.set(STORAGE_KEY, saved);
  });

  function calculate() {
    const currentUnits = getUnits();
    const stationWeights = {};
    for (const station of nonFuelStations) {
      const el = panelEl.querySelector(`#wb-${station.id}`);
      stationWeights[station.id] = parseFloat(el?.value) || 0;
    }

    const fuelQty = parseFloat(fuelEl.value) || 0;

    // Save inputs (in display units)
    const toSave = {};
    for (const station of nonFuelStations) {
      const el = panelEl.querySelector(`#wb-${station.id}`);
      toSave[station.id] = el?.value || '';
    }
    toSave._fuel = fuelEl.value;
    storage.set(STORAGE_KEY, toSave);

    const results = calculateWeightBalance(getProfile(), {
      stationWeights,
      fuelQuantity: fuelQty,
      displayWeightUnit: currentUnits.weight,
      displayFuelUnit: currentUnits.fuel,
    });

    if (results.error) {
      resultsEl.innerHTML = `<div class="alert alert--error">⚠ ${results.error}</div>`;
      return;
    }

    renderResults(resultsEl, results, wb);
  }

  calcBtn.addEventListener('click', calculate);

  panelEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input')) {
      calculate();
    }
  });

  const hasSaved = Object.values(saved).some((v) => v !== '' && v != null);
  if (hasSaved) {
    calculate();
  }
}

function renderResults(el, r, wb) {
  const cgLabel = r.cgReference === 'percent_mac' ? `${r.cgPercent}% MAC` : `${r.cgArm} ${r.armUnit}`;
  const wu = r.weightUnit;

  const weightClass = r.overweight ? 'results-list__value--danger' : '';
  const envelopeOk = r.withinAny;
  const cgOk = r.cgInAnyRange;
  const cgClass = envelopeOk ? '' : (cgOk ? 'results-list__value--caution' : 'results-list__value--danger');

  let envStatus, envClass;
  if (envelopeOk) {
    const envLabels = r.envelopes.filter((e) => e.within).map((e) => e.name).join(', ');
    envStatus = envLabels;
    envClass = 'results-list__value--ok';
  } else if (r.overweight && cgOk) {
    envStatus = 'OVERWEIGHT';
    envClass = 'results-list__value--danger';
  } else {
    envStatus = 'OUTSIDE LIMITS';
    envClass = 'results-list__value--danger';
  }

  let html = renderEnvelopeChart(r, wb);

  html += `<ul class="results-list">`;

  html += `
    <li class="results-list__item results-list__item--highlight">
      <span class="results-list__label">Total Weight</span>
      <span class="results-list__value ${weightClass}">${formatNumber(r.totalWeight, 1)} ${wu}</span>
    </li>
    <li class="results-list__item">
      <span class="results-list__label">Max Takeoff Weight</span>
      <span class="results-list__value">${formatNumber(r.maxWeight)} ${wu}</span>
    </li>
    <li class="results-list__item">
      <span class="results-list__label">Weight Remaining</span>
      <span class="results-list__value ${weightClass}">${r.overweight ? '−' : ''}${formatNumber(Math.abs(r.weightRemaining), 1)} ${wu}</span>
    </li>
    <li class="results-list__item results-list__item--highlight">
      <span class="results-list__label">CG Position</span>
      <span class="results-list__value ${cgClass}">${cgLabel}</span>
    </li>
    <li class="results-list__item">
      <span class="results-list__label">Envelope</span>
      <span class="results-list__value ${envClass}">${envStatus}</span>
    </li>`;

  html += `</ul>`;

  if (r.overweight) {
    html += `<div class="alert alert--error">⚠ Total weight exceeds maximum takeoff weight by ${formatNumber(Math.abs(r.weightRemaining), 1)} ${wu}.</div>`;
  }

  if (!r.withinAny && !cgOk) {
    html += `<div class="alert alert--error">⚠ CG is outside allowable range. Aircraft may be uncontrollable.</div>`;
  } else if (!r.withinAny && cgOk && !r.overweight) {
    html += `<div class="alert alert--error">⚠ Weight/CG combination is outside the defined envelope.</div>`;
  }

  for (const s of r.stations) {
    if (s.overweight) {
      html += `<div class="alert alert--warning">⚠ ${s.name} exceeds max weight (${formatNumber(s.weight, 1)} > ${formatNumber(s.maxWeight)} ${wu}).</div>`;
    }
  }

  for (const w of r.constraintWarnings) {
    html += `<div class="alert alert--warning">⚠ ${w.description} (${formatNumber(w.combined, 1)} > ${formatNumber(w.max)} ${wu}).</div>`;
  }

  el.innerHTML = html;
}

/* ── Weight Conversion ── */

function convertWeight(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'kg' && toUnit === 'lbs') return convert.kgToLbs(value);
  if (fromUnit === 'lbs' && toUnit === 'kg') return convert.lbsToKg(value);
  return value;
}

/* ── SVG Envelope Chart ── */

function renderEnvelopeChart(r, wb) {
  const W = 400, H = 300;
  const pad = { top: 30, right: 30, bottom: 40, left: 55 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const wu = r.weightUnit;

  // Envelope points and totalWeight are already in display units from the calc engine
  let allWeights = [], allCGs = [];
  for (const env of r.envelopePoints) {
    for (const pt of env.points) {
      allWeights.push(pt.weight);
      allCGs.push(pt.cg);
    }
  }
  allWeights.push(r.totalWeight);
  allCGs.push(r.cgReference === 'percent_mac' ? r.cgPercent : r.cgArm);

  const wMin = Math.floor(Math.min(...allWeights) * 0.95);
  const wMax = Math.ceil(Math.max(...allWeights) * 1.02);
  const cgMin = Math.floor(Math.min(...allCGs) - 2);
  const cgMax = Math.ceil(Math.max(...allCGs) + 2);

  const scaleX = (cg) => pad.left + ((cg - cgMin) / (cgMax - cgMin)) * plotW;
  const scaleY = (w) => pad.top + plotH - ((w - wMin) / (wMax - wMin)) * plotH;

  let svg = `<svg class="wb-chart__svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  svg += '<g class="wb-grid">';
  const wStep = niceStep(wMax - wMin, 5);
  for (let w = Math.ceil(wMin / wStep) * wStep; w <= wMax; w += wStep) {
    const y = scaleY(w);
    svg += `<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    svg += `<text x="${pad.left - 6}" y="${y}" text-anchor="end" dominant-baseline="middle" class="wb-chart__label">${Math.round(w)}</text>`;
  }
  const cgStep = niceStep(cgMax - cgMin, 5);
  for (let c = Math.ceil(cgMin / cgStep) * cgStep; c <= cgMax; c += cgStep) {
    const x = scaleX(c);
    svg += `<line x1="${x}" y1="${pad.top}" x2="${x}" y2="${H - pad.bottom}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    svg += `<text x="${x}" y="${H - pad.bottom + 14}" text-anchor="middle" class="wb-chart__label">${c}</text>`;
  }
  svg += '</g>';

  const cgAxisLabel = r.cgReference === 'percent_mac' ? 'CG (% MAC)' : `CG (${r.armUnit})`;
  svg += `<text x="${pad.left + plotW / 2}" y="${H - 4}" text-anchor="middle" class="wb-chart__axis-label">${cgAxisLabel}</text>`;
  svg += `<text x="14" y="${pad.top + plotH / 2}" text-anchor="middle" dominant-baseline="middle" class="wb-chart__axis-label" transform="rotate(-90, 14, ${pad.top + plotH / 2})">Weight (${wu})</text>`;

  for (const env of r.envelopePoints) {
    const polyPoints = env.points
      .map((pt) => `${scaleX(pt.cg).toFixed(1)},${scaleY(pt.weight).toFixed(1)}`)
      .join(' ');
    svg += `<polygon points="${polyPoints}" fill="${env.color}" fill-opacity="0.15" stroke="${env.color}" stroke-width="1.5"/>`;
  }

  const ptCg = r.cgReference === 'percent_mac' ? r.cgPercent : r.cgArm;
  const px = scaleX(ptCg);
  const py = scaleY(r.totalWeight);
  const ptColor = r.withinAny ? '#22c55e' : '#ef4444';

  // Place label as callout in top margin, with a connector line to the point
  const labelText = `${formatNumber(r.totalWeight, 1)} ${wu}`;
  const labelY = 20;
  const labelX = Math.max(pad.left + 10, Math.min(px, W - pad.right - 10));
  const anchor = labelX <= pad.left + 15 ? 'start' : labelX >= W - pad.right - 15 ? 'end' : 'middle';

  svg += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${labelX.toFixed(1)}" y2="${(labelY + 4).toFixed(1)}" stroke="${ptColor}" stroke-width="0.75" stroke-dasharray="3,2"/>`;
  svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="${ptColor}" stroke="white" stroke-width="1.5"/>`;
  svg += `<text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${anchor}" class="wb-chart__point-label" fill="${ptColor}">${labelText}</text>`;

  svg += `<rect x="${pad.left}" y="${pad.top}" width="${plotW}" height="${plotH}" fill="none" stroke="#94a3b8" stroke-width="0.5"/>`;

  svg += '</svg>';

  return `<div class="wb-chart">${svg}</div>`;
}

function niceStep(range, targetTicks) {
  const rough = range / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  let step;
  if (norm < 1.5) step = 1;
  else if (norm < 3.5) step = 2;
  else if (norm < 7.5) step = 5;
  else step = 10;
  return step * pow;
}

function getFuelMax(fuelConfig, fuelUnit) {
  if (!fuelConfig?.capacity) return '';
  const cap = fuelConfig.capacity;
  if (fuelUnit === cap.unit) return cap.value;
  if (fuelUnit === 'us_gal' && cap.valueUSGal) return cap.valueUSGal;
  if (fuelUnit === 'us_gal' && cap.unit === 'L') return Math.round(cap.value * 0.264172 * 10) / 10;
  if (fuelUnit === 'L' && cap.unit === 'us_gal') return Math.round(cap.value * 3.78541 * 10) / 10;
  if (fuelUnit === 'L' && cap.valueUSGal) return Math.round(cap.valueUSGal * 3.78541 * 10) / 10;
  if (fuelUnit === 'L') return cap.value;
  return cap.value;
}
