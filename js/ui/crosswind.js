import { calculateCrosswind } from '../calc/crosswind.js';
import { formatNumber } from '../engine/units.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';

const STORAGE_KEY = 'crosswind_inputs';

const DEFAULTS = {
  windDirection: '',
  windSpeed: '',
  windSpeedUnit: 'kt',
  gustSpeed: '',
  runwayHeading: '',
};

export function initCrosswind(panelEl) {
  const saved = storage.get(STORAGE_KEY, DEFAULTS);

  panelEl.innerHTML = `
    <div class="tab-panel__layout">
      <div class="panel">
        <h2 class="panel__title">Crosswind Component</h2>

        <div class="form-group">
          <label class="form-label" for="xw-runway">Runway Heading</label>
          <div class="form-suffix">
            <input class="form-input" id="xw-runway" type="number" inputmode="numeric"
                   min="1" max="360" placeholder="e.g. 270" value="${esc(saved.runwayHeading)}">
            <span class="form-suffix__label">°</span>
          </div>
          <div class="runway-shortcuts" id="xw-runway-shortcuts"></div>
        </div>

        <div class="form-group">
          <label class="form-label" for="xw-wind-dir">Wind Direction</label>
          <div class="form-suffix">
            <input class="form-input" id="xw-wind-dir" type="number" inputmode="numeric"
                   min="0" max="360" placeholder="e.g. 310" value="${esc(saved.windDirection)}">
            <span class="form-suffix__label">°</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="xw-wind-speed">Wind Speed</label>
            <div class="form-suffix">
              <input class="form-input" id="xw-wind-speed" type="number" inputmode="numeric"
                     min="0" placeholder="e.g. 15" value="${esc(saved.windSpeed)}">
              <span class="form-suffix__label" id="xw-speed-suffix">${saved.windSpeedUnit === 'kmh' ? 'km/h' : 'kt'}</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="xw-speed-unit">Unit</label>
            <select class="form-input" id="xw-speed-unit">
              <option value="kt" ${saved.windSpeedUnit === 'kt' ? 'selected' : ''}>kt</option>
              <option value="kmh" ${saved.windSpeedUnit === 'kmh' ? 'selected' : ''}>km/h</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="xw-gust">Gust Speed <span class="form-label--optional">(optional)</span></label>
          <div class="form-suffix">
            <input class="form-input" id="xw-gust" type="number" inputmode="numeric"
                   min="0" placeholder="—" value="${esc(saved.gustSpeed)}">
            <span class="form-suffix__label" id="xw-gust-suffix">${saved.windSpeedUnit === 'kmh' ? 'km/h' : 'kt'}</span>
          </div>
        </div>

        <button class="btn btn-primary btn-block" id="xw-calculate">Calculate</button>
      </div>

      <div class="panel" id="xw-results-panel">
        <h2 class="panel__title">Results</h2>
        <div id="xw-results">
          <div class="placeholder-message">
            <div class="placeholder-message__icon">💨</div>
            <div class="placeholder-message__text">Enter values and press Calculate</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const runway = panelEl.querySelector('#xw-runway');
  const windDir = panelEl.querySelector('#xw-wind-dir');
  const windSpeed = panelEl.querySelector('#xw-wind-speed');
  const speedUnit = panelEl.querySelector('#xw-speed-unit');
  const speedSuffix = panelEl.querySelector('#xw-speed-suffix');
  const gust = panelEl.querySelector('#xw-gust');
  const gustSuffix = panelEl.querySelector('#xw-gust-suffix');
  const calcBtn = panelEl.querySelector('#xw-calculate');
  const resultsEl = panelEl.querySelector('#xw-results');
  const shortcutsEl = panelEl.querySelector('#xw-runway-shortcuts');

  buildRunwayShortcuts(shortcutsEl, runway);

  speedUnit.addEventListener('change', () => {
    const label = speedUnit.value === 'kmh' ? 'km/h' : 'kt';
    speedSuffix.textContent = label;
    gustSuffix.textContent = label;
  });

  function calculate() {
    const rwyVal = parseFloat(runway.value);
    const dirVal = parseFloat(windDir.value);
    const spdVal = parseFloat(windSpeed.value);

    if (isNaN(rwyVal) || isNaN(dirVal) || isNaN(spdVal)) {
      resultsEl.innerHTML = `
        <div class="alert alert--warning">⚠ Please enter runway heading, wind direction, and wind speed.</div>
      `;
      return;
    }

    const gustVal = parseFloat(gust.value);

    storage.set(STORAGE_KEY, {
      windDirection: windDir.value,
      windSpeed: windSpeed.value,
      windSpeedUnit: speedUnit.value,
      gustSpeed: gust.value,
      runwayHeading: runway.value,
    });

    const profile = getProfile();
    const maxXw = profile?.limits?.maxCrosswind?.value ?? null;

    const results = calculateCrosswind({
      windDirection: dirVal,
      windSpeed: spdVal,
      windSpeedUnit: speedUnit.value,
      runwayHeading: rwyVal,
      gustSpeed: isNaN(gustVal) ? null : gustVal,
      maxCrosswind: maxXw,
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

function buildRunwayShortcuts(containerEl, inputEl) {
  const common = [
    [9, 27], [18, 36], [4, 22], [10, 28], [13, 31],
  ];

  const html = common
    .map(
      ([a, b]) =>
        `<button type="button" class="runway-btn" data-hdg-a="${a * 10}" data-hdg-b="${b * 10}">${String(a).padStart(2, '0')}/${String(b).padStart(2, '0')}</button>`,
    )
    .join('');

  containerEl.innerHTML = html;

  containerEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.runway-btn');
    if (!btn) return;

    const existing = parseFloat(inputEl.value);
    const hdgA = parseInt(btn.dataset.hdgA, 10);
    const hdgB = parseInt(btn.dataset.hdgB, 10);

    if (existing === hdgA) {
      inputEl.value = hdgB;
    } else {
      inputEl.value = hdgA;
    }
  });
}

function renderResults(el, r) {
  const s = r.steady;
  const g = r.gust;

  const windLabel = s.isHeadwind ? 'Headwind' : 'Tailwind';
  const windValue = s.isHeadwind ? s.headwind : s.tailwind;
  const windIcon = s.isHeadwind ? '↑' : '↓';

  const xwDir =
    s.crosswindDirection === 'right'
      ? 'from Right'
      : s.crosswindDirection === 'left'
        ? 'from Left'
        : '';

  const xwClass =
    r.crosswindStatus === 'exceeds'
      ? 'results-list__value--danger'
      : r.crosswindStatus === 'caution'
        ? 'results-list__value--caution'
        : '';

  let html = `
    <ul class="results-list">
      <li class="results-list__item">
        <span class="results-list__label">${windIcon} ${windLabel}</span>
        <span class="results-list__value">${formatNumber(windValue, 1)} kt</span>
      </li>
      <li class="results-list__item results-list__item--highlight">
        <span class="results-list__label">↔ Crosswind ${xwDir}</span>
        <span class="results-list__value ${xwClass}">${formatNumber(s.crosswind, 1)} kt</span>
      </li>
      <li class="results-list__item">
        <span class="results-list__label">Wind Angle</span>
        <span class="results-list__value">${s.angleNormalized}°</span>
      </li>`;

  if (g) {
    const gustWindLabel = g.isHeadwind ? 'Gust Headwind' : 'Gust Tailwind';
    const gustWindValue = g.isHeadwind ? g.headwind : g.tailwind;
    const gustXwDir =
      g.crosswindDirection === 'right'
        ? 'from Right'
        : g.crosswindDirection === 'left'
          ? 'from Left'
          : '';

    html += `
      <li class="results-list__item results-list__item--separator">
        <span class="results-list__label">${windIcon} ${gustWindLabel}</span>
        <span class="results-list__value">${formatNumber(gustWindValue, 1)} kt</span>
      </li>
      <li class="results-list__item">
        <span class="results-list__label">↔ Gust Crosswind ${gustXwDir}</span>
        <span class="results-list__value ${xwClass}">${formatNumber(g.crosswind, 1)} kt</span>
      </li>`;
  }

  if (r.maxCrosswind != null) {
    html += `
      <li class="results-list__item">
        <span class="results-list__label">Max Demonstrated Crosswind</span>
        <span class="results-list__value">${formatNumber(r.maxCrosswind)} kt</span>
      </li>`;
  }

  html += '</ul>';

  if (r.crosswindStatus === 'exceeds') {
    html += `<div class="alert alert--error">⚠ Crosswind exceeds maximum demonstrated crosswind component (${r.maxCrosswind} kt).</div>`;
  } else if (r.crosswindStatus === 'caution') {
    html += `<div class="alert alert--warning">⚠ Crosswind approaching maximum demonstrated limit (${r.maxCrosswind} kt).</div>`;
  }

  if (s.isTailwind) {
    html += `<div class="alert alert--warning">⚠ Tailwind component present — consider using the opposite runway direction.</div>`;
  }

  el.innerHTML = html;
}

function esc(val) {
  if (val == null) return '';
  return String(val).replace(/"/g, '&quot;');
}
