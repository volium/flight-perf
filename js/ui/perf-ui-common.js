import { formatNumber } from '../engine/units.js';
import { emptyMargins } from '../engine/margins.js';

/**
 * Build the margin fieldset HTML and wire up its behavior.
 * Shared by takeoff and landing UI modules.
 *
 * @param {string} prefix    – ID prefix for elements (e.g., "to" or "ld")
 * @param {object} saved     – Saved input state
 * @returns {string} HTML string for the fieldset
 */
export function marginFieldsetHTML(prefix, saved) {
  return `
    <fieldset class="margin-fieldset">
      <legend class="margin-fieldset__legend">Safety Margin</legend>

      <div class="form-group">
        <label class="form-label" for="${prefix}-margin-type">Type</label>
        <select class="form-input" id="${prefix}-margin-type">
          <option value="none" ${saved.marginType === 'none' ? 'selected' : ''}>None (POH values)</option>
          <option value="percentage" ${saved.marginType === 'percentage' ? 'selected' : ''}>Percentage</option>
          <option value="fixed" ${saved.marginType === 'fixed' ? 'selected' : ''}>Fixed Distance</option>
        </select>
      </div>

      <div class="form-group" id="${prefix}-margin-value-group" style="display:none">
        <label class="form-label" id="${prefix}-margin-value-label" for="${prefix}-margin-value">Value</label>
        <div class="form-suffix">
          <input class="form-input" id="${prefix}-margin-value" type="number" inputmode="decimal"
                 min="0" step="any" placeholder="" value="">
          <span class="form-suffix__label" id="${prefix}-margin-value-suffix"></span>
        </div>
      </div>

      <div class="form-group" id="${prefix}-round-group" style="display:none">
        <label class="form-checkbox">
          <input type="checkbox" id="${prefix}-margin-round" ${saved.marginRoundUp ? 'checked' : ''}>
          <span>Round up to nearest 100</span>
        </label>
      </div>
    </fieldset>`;
}

/**
 * Wire up margin fieldset interactivity.
 *
 * @param {HTMLElement} panelEl – Parent panel element
 * @param {string} prefix      – ID prefix
 * @param {object} saved       – Saved input state
 * @param {function} getUnit   – Returns current distance unit ("ft" or "m")
 * @returns {object} Controller with buildMargins(), saveState(), stash()
 */
export function initMarginFieldset(panelEl, prefix, saved, getUnit) {
  const marginTypeEl = panelEl.querySelector(`#${prefix}-margin-type`);
  const marginValueGroup = panelEl.querySelector(`#${prefix}-margin-value-group`);
  const marginValueEl = panelEl.querySelector(`#${prefix}-margin-value`);
  const marginValueLabel = panelEl.querySelector(`#${prefix}-margin-value-label`);
  const marginValueSuffix = panelEl.querySelector(`#${prefix}-margin-value-suffix`);
  const roundGroup = panelEl.querySelector(`#${prefix}-round-group`);
  const roundEl = panelEl.querySelector(`#${prefix}-margin-round`);

  let stickyPct = saved.marginPctValue || '';
  let stickyFixed = saved.marginFixedValue || '';

  function updateUI() {
    const type = marginTypeEl.value;
    const unit = getUnit();

    if (type === 'none') {
      marginValueGroup.style.display = 'none';
    } else {
      marginValueGroup.style.display = '';

      if (type === 'percentage') {
        marginValueLabel.textContent = 'Add percentage';
        marginValueSuffix.textContent = '%';
        marginValueEl.placeholder = 'e.g. 25';
        marginValueEl.value = stickyPct;
      } else {
        marginValueLabel.textContent = 'Add distance';
        marginValueSuffix.textContent = unit;
        marginValueEl.placeholder = unit === 'm' ? 'e.g. 150' : 'e.g. 500';
        marginValueEl.value = stickyFixed;
      }
    }

    roundGroup.style.display = '';
  }

  function stash() {
    const type = marginTypeEl.value;
    if (type === 'percentage') {
      stickyPct = marginValueEl.value;
    } else if (type === 'fixed') {
      stickyFixed = marginValueEl.value;
    }
  }

  marginTypeEl.addEventListener('mousedown', stash);
  marginTypeEl.addEventListener('change', updateUI);
  updateUI();

  return {
    updateUI,
    stash,

    buildMargins() {
      const type = marginTypeEl.value;
      const roundUp = roundEl.checked ? 100 : null;

      if (type === 'none') {
        if (roundUp) {
          const margin = { roundUp };
          return { groundRoll: { ...margin }, totalOverObstacle: { ...margin } };
        }
        return emptyMargins();
      }

      const val = parseFloat(marginValueEl.value);
      const margin = {};

      if (type === 'percentage' && !isNaN(val) && val > 0) {
        margin.percentage = val;
      } else if (type === 'fixed' && !isNaN(val) && val > 0) {
        margin.fixed = val;
      }

      if (roundUp) margin.roundUp = roundUp;

      return { groundRoll: { ...margin }, totalOverObstacle: { ...margin } };
    },

    saveState() {
      stash();
      return {
        marginType: marginTypeEl.value,
        marginPctValue: stickyPct,
        marginFixedValue: stickyFixed,
        marginRoundUp: roundEl.checked,
      };
    },
  };
}

/* ── Shared Results Rendering ── */

export function displayUnit(unit) {
  if (!unit) return '';
  const upper = ['kias', 'ktas', 'kw', 'hp', 'nm', 'gph'];
  if (upper.includes(unit.toLowerCase())) return unit.toUpperCase();
  return unit;
}

export function renderDistanceResults(el, r) {
  const gr = r.groundRoll;
  const to = r.totalOverObstacle;
  const unit = r.distanceUnit;

  let html = `<ul class="results-list">`;
  html += distanceRow('Ground Roll', gr, unit);
  html += distanceRow(`Total ${r.obstacleLabel}`, to, unit, true);
  html += `</ul>`;

  if (gr.marginApplied || to.marginApplied) {
    html += `<div class="alert alert--info">ℹ Safety margin applied (${gr.description})</div>`;
  }

  if (r.referenceConditions) {
    const cond = r.referenceConditions;
    const parts = [];
    if (cond.weight) parts.push(`${cond.weight.value} ${displayUnit(cond.weight.unit)}`);
      if (cond.atmosphere) parts.push(cond.atmosphere);
      if (cond.power) parts.push(cond.power);
      if (cond.approachSpeed) parts.push(`Vref ${cond.approachSpeed.value} ${displayUnit(cond.approachSpeed.unit)}`);
    if (parts.length > 0) {
      html += `<div class="to-ref-note">Reference: ${parts.join(' · ')}</div>`;
    }
  }

  el.innerHTML = html;
}

function distanceRow(label, result, unit, highlight = false) {
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

export function buildRefNote(conditions, description) {
  const parts = [];
  if (description) parts.push(description);
  if (conditions?.weight) parts.push(`Weight: ${conditions.weight.value} ${displayUnit(conditions.weight.unit)}`);
  if (conditions?.atmosphere) parts.push(`Atmosphere: ${conditions.atmosphere}`);
  if (conditions?.power) parts.push(`Power: ${conditions.power}`);
  if (conditions?.approachSpeed) parts.push(`Approach: ${conditions.approachSpeed.value} ${displayUnit(conditions.approachSpeed.unit)}`);

  if (parts.length === 0) return '';

  return `
    <div class="to-ref-note">
      <strong>POH Reference Conditions</strong><br>
      ${parts.join('<br>')}
    </div>`;
}

export function esc(val) {
  if (val == null) return '';
  return String(val).replace(/"/g, '&quot;');
}
