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

/**
 * Map wind speed to a color from green (calm) through amber to red (strong).
 * 0 kt → green, ~15 kt → amber, 30+ kt → red.
 */
function windSpeedColor(kt) {
  const t = Math.min(Math.max(kt / 30, 0), 1);
  if (t < 0.5) {
    const p = t * 2;
    const r = Math.round(34 + p * (217 - 34));
    const g = Math.round(197 + p * (119 - 197));
    const b = Math.round(94 + p * (6 - 94));
    return `rgb(${r},${g},${b})`;
  }
  const p = (t - 0.5) * 2;
  const r = Math.round(217 + p * (220 - 217));
  const g = Math.round(119 + p * (38 - 119));
  const b = Math.round(6 + p * (38 - 6));
  return `rgb(${r},${g},${b})`;
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
  const W = 480, H = 480;
  const cx = W / 2, cy = H / 2;
  const compassR = 200;
  const compassStroke = 1.5;
  const rwyW = 24;
  const labelR = compassR - 22;
  const rwyHalf = labelR - 16;

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
    .xd-rwy   { font: 700 12px -apple-system, system-ui, sans-serif; fill: white; }
    .xd-comp  { font: 600 10px -apple-system, system-ui, sans-serif; fill: #64748b; }
    .xd-comp-c { font: 700 11px -apple-system, system-ui, sans-serif; fill: #475569; }
    .xd-wind  { font: 700 14px -apple-system, system-ui, sans-serif; }
  </style></defs>`);

  // ── Compass rose ──
  p.push(
    `<circle cx="${cx}" cy="${cy}" r="${compassR}" ` +
    `fill="none" stroke="#cbd5e1" stroke-width="${compassStroke}"/>`,
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

  // Centerline dashes — computed outside the rotated group for consistency
  const rwyNumInset = 27;

  // ── Runway markings (applied identically to each end) ──
  // Stripe x-offsets: 8 longitudinal bars symmetric about centerline
  const thStripes = [-9, -5.4, -1.8, 1.8, 5.4, 9];
  const thLen = 12; // stripe length

  for (const sign of [1, -1]) {
    // sign=1 → bottom (selected), sign=-1 → top (reciprocal)
    const edgeY = cy + sign * rwyHalf;
    const inward = -sign; // direction from edge toward center

    // Threshold line — solid bar across full width
    p.push(
      `<line x1="${rd(cx - rwyW / 2 + 1)}" y1="${rd(edgeY + inward * 2)}" ` +
      `x2="${rd(cx + rwyW / 2 - 1)}" y2="${rd(edgeY + inward * 2)}" ` +
      `stroke="white" stroke-width="1" opacity="0.9"/>`,
    );

    // Threshold stripes — longitudinal bars
    for (const dx of thStripes) {
      p.push(
        `<line x1="${rd(cx + dx)}" y1="${rd(edgeY + inward * 5)}" ` +
        `x2="${rd(cx + dx)}" y2="${rd(edgeY + inward * (5 + thLen))}" ` +
        `stroke="white" stroke-width="1.2" opacity="0.85"/>`,
      );
    }

    // Aiming point markers — two bold bars flanking the centerline
    const aimY = edgeY + inward * 42;
    const aimH = 16;
    const aimBarW = 3;
    const aimGap = 1.5;
    p.push(
      `<rect x="${rd(cx - aimGap - aimBarW)}" y="${rd(aimY - aimH / 2)}" ` +
      `width="${aimBarW}" height="${aimH}" fill="white" opacity="0.75"/>`,
    );
    p.push(
      `<rect x="${rd(cx + aimGap)}" y="${rd(aimY - aimH / 2)}" ` +
      `width="${aimBarW}" height="${aimH}" fill="white" opacity="0.75"/>`,
    );
  }

  p.push('</g>');

  // ── Centerline (outside rotated group for consistent dash rendering) ──
  const hdgRad = degToRad(hdg);
  const clR = rwyHalf - rwyNumInset - 8;
  const clLen = clR * 2;
  const targetDash = 7;
  const numDashes = Math.round(clLen / (targetDash * 2));
  const dash = clLen / (numDashes * 2 - 1);

  // Always draw from the visually "upper/left" point for consistent dasharray
  const cl1x = cx - clR * Math.sin(hdgRad);
  const cl1y = cy + clR * Math.cos(hdgRad);
  const cl2x = cx + clR * Math.sin(hdgRad);
  const cl2y = cy - clR * Math.cos(hdgRad);
  const clStartX = cl1y < cl2y || (cl1y === cl2y && cl1x <= cl2x) ? cl1x : cl2x;
  const clStartY = cl1y < cl2y || (cl1y === cl2y && cl1x <= cl2x) ? cl1y : cl2y;
  const clEndX = clStartX === cl1x ? cl2x : cl1x;
  const clEndY = clStartY === cl1y ? cl2y : cl1y;
  p.push(
    `<line x1="${rd(clStartX)}" y1="${rd(clStartY)}" x2="${rd(clEndX)}" y2="${rd(clEndY)}" ` +
    `stroke="white" stroke-width="1" opacity="0.4" stroke-dasharray="${rd(dash)},${rd(dash)}"/>`,
  );

  // ── Runway numbers (outside rotated group — single rotation, no compound transform) ──
  const numInset = rwyHalf - 25;

  // Selected runway number at approach end (opposite heading direction)
  const selX = cx - numInset * Math.sin(hdgRad);
  const selY = cy + numInset * Math.cos(hdgRad);
  p.push(
    `<text x="${rd(selX)}" y="${rd(selY)}" text-anchor="middle" ` +
    `dominant-baseline="central" class="xd-rwy" ` +
    `transform="rotate(${hdg}, ${rd(selX)}, ${rd(selY)})">${rwyNum}</text>`,
  );

  // Reciprocal number at heading end
  const recX = cx + numInset * Math.sin(hdgRad);
  const recY = cy - numInset * Math.cos(hdgRad);
  p.push(
    `<text x="${rd(recX)}" y="${rd(recY)}" text-anchor="middle" ` +
    `dominant-baseline="central" class="xd-rwy" ` +
    `transform="rotate(${recipHdg}, ${rd(recX)}, ${rd(recY)})">${recipNum}</text>`,
  );

  // ── Wind arrow ──
  if (windKt > 0.5) {
    const windRad = degToRad(windDir);
    const windSX = cx + (compassR - 2 * compassStroke) * Math.sin(windRad);
    const windSY = cy - (compassR - 2 * compassStroke) * Math.cos(windRad);

    // Stop the arrowhead 15px from center so it doesn't crowd the runway
    const stopR = 15;
    const wdx = windSX - cx, wdy = windSY - cy;
    const wdLen = Math.sqrt(wdx * wdx + wdy * wdy);
    const endX = cx + (stopR / wdLen) * wdx;
    const endY = cy + (stopR / wdLen) * wdy;

    const windColor = windSpeedColor(windKt);
    p.push(svgArrow(windSX, windSY, endX, endY, windColor, 6, 16));

    // Wind label — at arrow midpoint, on whichever side is further from the runway
    const wlR = compassR * 0.5;
    const baseX = cx + wlR * Math.sin(windRad);
    const baseY = cy - wlR * Math.cos(windRad);
    const pxDir = Math.cos(windRad), pyDir = Math.sin(windRad);
    const wlOff = 20;

    // Two candidate positions (perpendicular to arrow, both sides)
    const aX = baseX + pxDir * wlOff, aY = baseY + pyDir * wlOff;
    const bX = baseX - pxDir * wlOff, bY = baseY - pyDir * wlOff;

    // Pick the one further from the runway centerline
    const hRad = degToRad(hdg);
    const distA = Math.abs((aX - cx) * Math.cos(hRad) + (aY - cy) * Math.sin(hRad));
    const distB = Math.abs((bX - cx) * Math.cos(hRad) + (bY - cy) * Math.sin(hRad));
    const useA = distA >= distB;
    let wlX = useA ? aX : bX;
    let wlY = useA ? aY : bY;

    // Text-anchor: extend text away from the arrow, not back across it
    const chosenPerpX = useA ? pxDir : -pxDir;
    let wlAnchor = 'middle';
    if (chosenPerpX > 0.3) wlAnchor = 'start';
    else if (chosenPerpX < -0.3) wlAnchor = 'end';
    p.push(svgText(wlX, wlY, `${windDir}°/${Math.round(windKt)} kt`, 'xd-wind', { anchor: wlAnchor, fill: windColor }));
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
  const windIcon = s.isHeadwind ? '↓' : '↑';
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
        <span class="results-list__label">${xwDir || '↔'} Crosswind</span>
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
        <span class="results-list__label">${gustXwDir || '↔'} Gust Crosswind</span>
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
  const recipWindIcon = recip.isHeadwind ? '↓' : '↑';
  const recipXwDir = fmtXwDir(recip.crosswindDirection);

  html += `<h3 class="results-section__title">Reciprocal Runway ${recipLabel}</h3>`;
  html += `
    <ul class="results-list">
      <li class="results-list__item">
        <span class="results-list__label">${recipWindIcon} ${recipWindLabel}</span>
        <span class="results-list__value">${formatNumber(recipWindValue, 1)} kt</span>
      </li>
      <li class="results-list__item">
        <span class="results-list__label">${recipXwDir || '↔'} Crosswind</span>
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
        <span class="results-list__label">${grXwDir || '↔'} Gust Crosswind</span>
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
  return dir === 'right' ? '←' : dir === 'left' ? '→' : '';
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
