import { calculateCrosswind } from '../calc/crosswind.js';
import { formatNumber } from '../engine/units.js';
import { storage } from '../data/storage.js';
import { getProfile } from '../app.js';

const STORAGE_KEY = 'crosswind_inputs';

const DEFAULTS = {
  windDirection: '',
  windSpeed: '',
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

        <div class="form-group">
          <label class="form-label" for="xw-wind-speed">Wind Speed</label>
          <div class="form-suffix">
            <input class="form-input" id="xw-wind-speed" type="number" inputmode="numeric"
                   min="0" placeholder="e.g. 15" value="${esc(saved.windSpeed)}">
            <span class="form-suffix__label">kt</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="xw-gust">Gust Speed <span class="form-label--optional">(optional)</span></label>
          <div class="form-suffix">
            <input class="form-input" id="xw-gust" type="number" inputmode="numeric"
                   min="0" placeholder="—" value="${esc(saved.gustSpeed)}">
            <span class="form-suffix__label">kt</span>
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
  const gust = panelEl.querySelector('#xw-gust');
  const calcBtn = panelEl.querySelector('#xw-calculate');
  const resultsEl = panelEl.querySelector('#xw-results');
  const shortcutsEl = panelEl.querySelector('#xw-runway-shortcuts');

  buildRunwayShortcuts(shortcutsEl, runway);

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
      gustSpeed: gust.value,
      runwayHeading: runway.value,
    });

    const profile = getProfile();
    const maxXw = profile?.limits?.maxCrosswind?.value ?? null;

    const results = calculateCrosswind({
      windDirection: dirVal,
      windSpeed: spdVal,
      windSpeedUnit: 'kt',
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

/* ── Diagram Helpers ── */

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function rd(v) {
  return Math.round(v * 10) / 10;
}

function rwyNumStr(hdg) {
  const num = Math.round(hdg / 10) % 36 || 36;
  return String(num).padStart(2, '0');
}

function svgArrow(x1, y1, x2, y2, color, sw = 2.5, hl = 8) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return '';
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const hw = hl * 0.5;
  const bx = x2 - ux * hl, by = y2 - uy * hl;
  return (
    `<line x1="${rd(x1)}" y1="${rd(y1)}" x2="${rd(bx)}" y2="${rd(by)}" ` +
    `stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>` +
    `<polygon points="${rd(x2)},${rd(y2)} ${rd(bx + px * hw)},${rd(by + py * hw)} ` +
    `${rd(bx - px * hw)},${rd(by - py * hw)}" fill="${color}"/>`
  );
}

function svgText(x, y, text, cls, opts = {}) {
  const anchor = opts.anchor || 'middle';
  const baseline = opts.baseline || 'middle';
  const fill = opts.fill || '';
  const fillAttr = fill ? ` fill="${fill}"` : '';
  return (
    `<text x="${rd(x)}" y="${rd(y)}" text-anchor="${anchor}" ` +
    `dominant-baseline="${baseline}" class="${cls}"${fillAttr}>${text}</text>`
  );
}

/* ── SVG Diagram ── */

/**
 * Compass-to-SVG coordinate helper.
 * Compass heading 0°/360° = north = top of SVG.
 */
function compassXY(cx, cy, deg, r) {
  const rad = degToRad(deg);
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function renderDiagram(r) {
  const W = 300, H = 300;
  const cx = W / 2, cy = H / 2;
  const compassR = 118;
  const rwyHalf = 80;
  const rwyW = 30;
  const labelR = 98;

  const hdg = r.runwayHeading;
  const recipHdg = r.reciprocalHeading;
  const windDir = r.windDirection;
  const windKt = r.windSpeedKt;

  const rwyNum = rwyNumStr(hdg);
  const recipNum = rwyNumStr(recipHdg);

  const p = [];

  p.push(
    `<svg class="xw-diagram__svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ` +
    `role="img" aria-label="Crosswind component diagram">`,
  );

  p.push(`<defs><style>
    .xd-rwy   { font: 700 13px -apple-system, system-ui, sans-serif; fill: white; }
    .xd-comp  { font: 600 10px -apple-system, system-ui, sans-serif; fill: #64748b; }
    .xd-comp-c { font: 700 11px -apple-system, system-ui, sans-serif; fill: #475569; }
    .xd-wind  { font: 600 10px -apple-system, system-ui, sans-serif; fill: #1e40af; }
  </style></defs>`);

  // ── Compass rose ──
  p.push(
    `<circle cx="${cx}" cy="${cy}" r="${compassR}" ` +
    `fill="none" stroke="#cbd5e1" stroke-width="1.5"/>`,
  );

  // Tick marks every 5°
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = degToRad(deg);
    const sn = Math.sin(rad), cs = Math.cos(rad);
    let innerR, sw, color;
    if (deg % 30 === 0) {
      innerR = compassR - 10; sw = 1.5; color = '#64748b';
    } else if (deg % 10 === 0) {
      innerR = compassR - 7; sw = 1; color = '#94a3b8';
    } else {
      innerR = compassR - 4; sw = 0.5; color = '#cbd5e1';
    }
    p.push(
      `<line x1="${rd(cx + innerR * sn)}" y1="${rd(cy - innerR * cs)}" ` +
      `x2="${rd(cx + compassR * sn)}" y2="${rd(cy - compassR * cs)}" ` +
      `stroke="${color}" stroke-width="${sw}"/>`,
    );
  }

  // Compass labels every 30° (inside the circle, rotated to bearing)
  const compassLabels = [
    [0, 'N'], [30, '3'], [60, '6'], [90, 'E'],
    [120, '12'], [150, '15'], [180, 'S'], [210, '21'],
    [240, '24'], [270, 'W'], [300, '30'], [330, '33'],
  ];
  for (const [deg, label] of compassLabels) {
    const pos = compassXY(cx, cy, deg, labelR);
    const cls = deg % 90 === 0 ? 'xd-comp-c' : 'xd-comp';
    p.push(
      `<text x="${rd(pos.x)}" y="${rd(pos.y)}" text-anchor="middle" ` +
      `dominant-baseline="central" class="${cls}" ` +
      `transform="rotate(${deg}, ${rd(pos.x)}, ${rd(pos.y)})">${label}</text>`,
    );
  }

  // ── Runway strip (drawn vertical, rotated by heading) ──
  p.push(`<g transform="rotate(${hdg}, ${cx}, ${cy})">`);

  // Surface
  p.push(
    `<rect x="${cx - rwyW / 2}" y="${cy - rwyHalf}" width="${rwyW}" ` +
    `height="${rwyHalf * 2}" fill="#6b7280" rx="1"/>`,
  );

  // Edge lines
  p.push(
    `<line x1="${cx - rwyW / 2}" y1="${cy - rwyHalf}" ` +
    `x2="${cx - rwyW / 2}" y2="${cy + rwyHalf}" stroke="#9ca3af" stroke-width="0.5"/>`,
  );
  p.push(
    `<line x1="${cx + rwyW / 2}" y1="${cy - rwyHalf}" ` +
    `x2="${cx + rwyW / 2}" y2="${cy + rwyHalf}" stroke="#9ca3af" stroke-width="0.5"/>`,
  );

  // Centerline dashes (between the threshold zones)
  for (let yy = cy - rwyHalf + 28; yy < cy + rwyHalf - 27; yy += 12) {
    const de = Math.min(yy + 6, cy + rwyHalf - 28);
    p.push(
      `<line x1="${cx}" y1="${rd(yy)}" x2="${cx}" y2="${rd(de)}" ` +
      `stroke="white" stroke-width="1" opacity="0.4"/>`,
    );
  }

  // Threshold stripes — longitudinal bars like real pavement markings
  const stripeCount = 4;
  const stripeSpan = rwyW - 8;
  const stripeGap = stripeSpan / (stripeCount - 1);

  // Top threshold (reciprocal approach end, pre-rotation)
  for (let i = 0; i < stripeCount; i++) {
    const x = cx - stripeSpan / 2 + i * stripeGap;
    p.push(
      `<line x1="${rd(x)}" y1="${rd(cy - rwyHalf + 4)}" ` +
      `x2="${rd(x)}" y2="${rd(cy - rwyHalf + 18)}" ` +
      `stroke="white" stroke-width="2" opacity="0.85"/>`,
    );
  }

  // Bottom threshold (selected runway approach end, pre-rotation)
  for (let i = 0; i < stripeCount; i++) {
    const x = cx - stripeSpan / 2 + i * stripeGap;
    p.push(
      `<line x1="${rd(x)}" y1="${rd(cy + rwyHalf - 4)}" ` +
      `x2="${rd(x)}" y2="${rd(cy + rwyHalf - 18)}" ` +
      `stroke="white" stroke-width="2" opacity="0.85"/>`,
    );
  }

  // Selected runway number — near bottom (approach end), upright in pre-rotation
  p.push(
    `<text x="${cx}" y="${rd(cy + rwyHalf - 28)}" text-anchor="middle" ` +
    `dominant-baseline="central" class="xd-rwy">${rwyNum}</text>`,
  );

  // Reciprocal number — near top (other approach end), rotated 180° in pre-rotation
  p.push(
    `<text x="${cx}" y="${rd(cy - rwyHalf + 28)}" text-anchor="middle" ` +
    `dominant-baseline="central" class="xd-rwy" ` +
    `transform="rotate(180, ${cx}, ${rd(cy - rwyHalf + 28)})">${recipNum}</text>`,
  );

  p.push('</g>');

  // ── Wind arrow ──
  if (windKt > 0.5) {
    const windRad = degToRad(windDir);
    const windSX = cx + compassR * Math.sin(windRad);
    const windSY = cy - compassR * Math.cos(windRad);

    // Stop the arrowhead 15px from center so it doesn't crowd the runway
    const stopR = 15;
    const wdx = windSX - cx, wdy = windSY - cy;
    const wdLen = Math.sqrt(wdx * wdx + wdy * wdy);
    const endX = cx + (stopR / wdLen) * wdx;
    const endY = cy + (stopR / wdLen) * wdy;

    p.push(svgArrow(windSX, windSY, endX, endY, '#1e40af', 3, 9));

    // Wind label just outside the compass circle
    const wlR = compassR + 14;
    let wlX = cx + wlR * Math.sin(windRad);
    let wlY = cy - wlR * Math.cos(windRad);
    wlX = Math.max(24, Math.min(W - 24, wlX));
    wlY = Math.max(10, Math.min(H - 6, wlY));
    let wlAnchor = 'middle';
    if (wlX > cx + 30) wlAnchor = 'start';
    else if (wlX < cx - 30) wlAnchor = 'end';
    p.push(svgText(wlX, wlY, `${windDir}°/${Math.round(windKt)} kt`, 'xd-wind', { anchor: wlAnchor }));
  }

  p.push('</svg>');
  return `<div class="xw-diagram">${p.join('\n')}</div>`;
}

/* ── Results Rendering ── */

function renderResults(el, r) {
  const s = r.steady;
  const g = r.gust;
  const recip = r.reciprocal;
  const gRecip = r.gustReciprocal;

  const rwyLabel = rwyNumStr(r.runwayHeading);
  const recipLabel = rwyNumStr(r.reciprocalHeading);

  // Diagram
  let html = renderDiagram(r);

  // ── Selected Runway ──
  const windLabel = s.isHeadwind ? 'Headwind' : 'Tailwind';
  const windValue = s.isHeadwind ? s.headwind : s.tailwind;
  const windIcon = s.isHeadwind ? '↑' : '↓';
  const xwDir = fmtXwDir(s.crosswindDirection);
  const xwClass = xwStatusClass(r.crosswindStatus);

  html += `<h3 class="results-section__title">Runway ${rwyLabel}</h3>`;
  html += `
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
    const gustXwDir = fmtXwDir(g.crosswindDirection);

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

  // ── Reciprocal Runway ──
  const recipWindLabel = recip.isHeadwind ? 'Headwind' : 'Tailwind';
  const recipWindValue = recip.isHeadwind ? recip.headwind : recip.tailwind;
  const recipWindIcon = recip.isHeadwind ? '↑' : '↓';
  const recipXwDir = fmtXwDir(recip.crosswindDirection);

  html += `<h3 class="results-section__title">Reciprocal Runway ${recipLabel}</h3>`;
  html += `
    <ul class="results-list">
      <li class="results-list__item">
        <span class="results-list__label">${recipWindIcon} ${recipWindLabel}</span>
        <span class="results-list__value">${formatNumber(recipWindValue, 1)} kt</span>
      </li>
      <li class="results-list__item">
        <span class="results-list__label">↔ Crosswind ${recipXwDir}</span>
        <span class="results-list__value">${formatNumber(recip.crosswind, 1)} kt</span>
      </li>`;

  if (gRecip) {
    const grWindLabel = gRecip.isHeadwind ? 'Gust Headwind' : 'Gust Tailwind';
    const grWindValue = gRecip.isHeadwind ? gRecip.headwind : gRecip.tailwind;
    const grXwDir = fmtXwDir(gRecip.crosswindDirection);

    html += `
      <li class="results-list__item results-list__item--separator">
        <span class="results-list__label">${recipWindIcon} ${grWindLabel}</span>
        <span class="results-list__value">${formatNumber(grWindValue, 1)} kt</span>
      </li>
      <li class="results-list__item">
        <span class="results-list__label">↔ Gust Crosswind ${grXwDir}</span>
        <span class="results-list__value">${formatNumber(gRecip.crosswind, 1)} kt</span>
      </li>`;
  }

  html += '</ul>';

  // ── Alerts ──
  if (r.crosswindStatus === 'exceeds') {
    html += `<div class="alert alert--error">⚠ Crosswind exceeds maximum demonstrated crosswind component (${r.maxCrosswind} kt).</div>`;
  } else if (r.crosswindStatus === 'caution') {
    html += `<div class="alert alert--warning">⚠ Crosswind approaching maximum demonstrated limit (${r.maxCrosswind} kt).</div>`;
  }

  if (s.isTailwind) {
    html += `<div class="alert alert--warning">⚠ Tailwind component on Runway ${rwyLabel} — consider Runway ${recipLabel}.</div>`;
  }

  el.innerHTML = html;
}

function fmtXwDir(dir) {
  return dir === 'right' ? 'from Right' : dir === 'left' ? 'from Left' : '';
}

function xwStatusClass(status) {
  return status === 'exceeds'
    ? 'results-list__value--danger'
    : status === 'caution'
      ? 'results-list__value--caution'
      : '';
}

function esc(val) {
  if (val == null) return '';
  return String(val).replace(/"/g, '&quot;');
}
