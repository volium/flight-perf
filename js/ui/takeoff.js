import { calculateTakeoff } from '../calc/takeoff.js';
import { formatNumber } from '../engine/units.js';
import { getAllMarginPresets, getMarginPreset } from '../engine/margins.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';

const STORAGE_KEY = 'takeoff_inputs';

const DEFAULTS = {
  surface: '',
  marginPreset: 'none',
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

  const presetOptions = getAllMarginPresets()
    .map(
      (p) =>
        `<option value="${p.id}" ${saved.marginPreset === p.id ? 'selected' : ''}>${p.name}</option>`,
    )
    .join('');

  const refCond = takeoff.referenceConditions;
  const refNote = buildRefNote(refCond, takeoff.description);

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Takeoff Performance</h2>

        <div class="form-group">
          <label class="form-label" for="to-surface">Runway Surface</label>
          <select class="form-input" id="to-surface">${surfaceOptions}</select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="to-margin">Safety Margin</label>
            <select class="form-input" id="to-margin">${presetOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label" for="to-unit">Distance Unit</label>
            <select class="form-input" id="to-unit">
              <option value="ft" ${saved.distanceUnit === 'ft' ? 'selected' : ''}>ft</option>
              <option value="m" ${saved.distanceUnit === 'm' ? 'selected' : ''}>m</option>
            </select>
          </div>
        </div>

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
  const marginEl = panelEl.querySelector('#to-margin');
  const unitEl = panelEl.querySelector('#to-unit');
  const calcBtn = panelEl.querySelector('#to-calculate');
  const resultsEl = panelEl.querySelector('#to-results');

  function calculate() {
    const surface = surfaceEl.value;
    if (!surface) {
      resultsEl.innerHTML = `<div class="alert alert--warning">⚠ Please select a runway surface.</div>`;
      return;
    }

    const presetId = marginEl.value;
    const distanceUnit = unitEl.value;

    storage.set(STORAGE_KEY, { surface, marginPreset: presetId, distanceUnit });

    const preset = getMarginPreset(presetId);

    const results = calculateTakeoff(profile, {
      surface,
      margins: preset.takeoff,
      distanceUnit,
    });

    if (results.error) {
      resultsEl.innerHTML = `<div class="alert alert--error">⚠ ${results.error}</div>`;
      return;
    }

    renderResults(resultsEl, results, presetId);
  }

  calcBtn.addEventListener('click', calculate);

  // Auto-calculate if saved values exist
  if (saved.surface) {
    calculate();
  }
}

function renderResults(el, r, presetId) {
  const gr = r.groundRoll;
  const to = r.totalOverObstacle;
  const unit = r.distanceUnit;

  let html = `<ul class="results-list">`;

  html += renderDistanceRow('Ground Roll', gr, unit);
  html += renderDistanceRow(`Total ${r.obstacleLabel}`, to, unit, true);

  html += `</ul>`;

  // Margin info
  if (gr.marginApplied || to.marginApplied) {
    const preset = getMarginPreset(presetId);
    html += `<div class="alert alert--info">ℹ Safety margin applied: ${preset.name}</div>`;
  }

  // Reference conditions note
  if (r.referenceConditions) {
    const cond = r.referenceConditions;
    const parts = [];
    if (cond.weight) parts.push(`${cond.weight.value} ${cond.weight.unit}`);
    if (cond.atmosphere) parts.push(cond.atmosphere);
    if (cond.power) parts.push(cond.power);
    if (parts.length > 0) {
      html += `<div class="to-ref-note">Reference: ${parts.join(' · ')}</div>`;
    }
  }

  el.innerHTML = html;
}

function renderDistanceRow(label, result, unit, highlight = false) {
  const hlClass = highlight ? ' results-list__item--highlight' : '';

  if (result.marginApplied) {
    return `
      <li class="results-list__item${hlClass}">
        <span class="results-list__label">${label}</span>
        <span class="results-list__value">
          ${formatNumber(result.adjusted)} ${unit}
          <span class="results-list__adjusted">(POH: ${formatNumber(result.raw)} ${unit})</span>
        </span>
      </li>`;
  }

  return `
    <li class="results-list__item${hlClass}">
      <span class="results-list__label">${label}</span>
      <span class="results-list__value">${formatNumber(result.raw)} ${unit}</span>
    </li>`;
}

function buildRefNote(conditions, description) {
  const parts = [];
  if (description) parts.push(description);
  if (conditions?.weight) parts.push(`Weight: ${conditions.weight.value} ${conditions.weight.unit}`);
  if (conditions?.atmosphere) parts.push(`Atmosphere: ${conditions.atmosphere}`);
  if (conditions?.power) parts.push(`Power: ${conditions.power}`);

  if (parts.length === 0) return '';

  return `
    <div class="to-ref-note">
      <strong>POH Reference Conditions</strong><br>
      ${parts.join('<br>')}
    </div>`;
}
