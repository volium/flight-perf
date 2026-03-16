import { storage } from '../data/storage.js';
import { lookup as oaLookup } from '../data/ourairports.js';
import { getUnits } from '../data/unit-preferences.js';
import { convert, formatNumber } from '../engine/units.js';
import { decodeWx, decodeCover, decodeChange, decodeRemarks } from '../calc/wx-decode.js';

const FAVORITES_KEY = 'airport_favorites';
const LAST_KEY = 'airport_last';

const PROXY = (url) => 'https://corsproxy.io/?' + encodeURIComponent(url);
const AWX = 'https://aviationweather.gov/api/data';

let panelRef = null;

export function initAirport(panelEl) {
  panelRef = panelEl;
  const favorites = storage.get(FAVORITES_KEY, []);
  const lastIcao = storage.get(LAST_KEY, '');

  panelEl.innerHTML = `
    <div class="airport-search">
      <div class="airport-search__row">
        <input class="form-input airport-search__input" id="apt-icao" type="text"
               maxlength="4" placeholder="Airport code (e.g. KJFK)" value="${lastIcao}"
               autocapitalize="characters" autocomplete="off" spellcheck="false">
        <button class="btn btn-primary" id="apt-search">Search</button>
        <button class="btn btn-secondary btn-icon apt-fav-toggle" id="apt-fav-toggle"
                title="Toggle favorite" aria-label="Toggle favorite">&#9734;</button>
      </div>
      <div class="airport-favorites" id="apt-favorites"></div>
    </div>
    <div id="apt-results">
      <div class="placeholder-message">
        <div class="placeholder-message__icon">&#9992;&#65039;</div>
        <div class="placeholder-message__text">Enter an airport code and press Search</div>
      </div>
    </div>
  `;

  const icaoInput = panelEl.querySelector('#apt-icao');
  const searchBtn = panelEl.querySelector('#apt-search');
  const favToggle = panelEl.querySelector('#apt-fav-toggle');
  const resultsEl = panelEl.querySelector('#apt-results');
  const favoritesEl = panelEl.querySelector('#apt-favorites');

  renderFavorites(favoritesEl, favorites, doSearch);
  updateFavStar(favToggle, icaoInput.value.trim().toUpperCase(), favorites);

  icaoInput.addEventListener('input', () => {
    icaoInput.value = icaoInput.value.toUpperCase();
    updateFavStar(favToggle, icaoInput.value.trim(), storage.get(FAVORITES_KEY, []));
  });

  function doSearch(icao) {
    if (icao) icaoInput.value = icao;
    const code = icaoInput.value.trim().toUpperCase();
    if (!code || code.length < 2) {
      resultsEl.innerHTML = `<div class="alert alert--warning">Please enter a valid airport code.</div>`;
      return;
    }
    icaoInput.value = code;
    storage.set(LAST_KEY, code);
    updateFavStar(favToggle, code, storage.get(FAVORITES_KEY, []));
    fetchAirport(code, resultsEl);
  }

  searchBtn.addEventListener('click', () => doSearch());
  panelEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target === icaoInput) doSearch();
  });

  favToggle.addEventListener('click', () => {
    const code = icaoInput.value.trim().toUpperCase();
    if (!code) return;
    toggleFavorite(code, favoritesEl, favToggle, doSearch);
  });

  if (lastIcao && navigator.onLine) {
    doSearch(lastIcao);
  } else if (!navigator.onLine) {
    resultsEl.innerHTML = `<div class="alert alert--info">Airport data requires an internet connection.</div>`;
  }
}

/* ── Favorites ── */

function toggleFavorite(icao, favoritesEl, favToggle, onChipClick) {
  const favs = storage.get(FAVORITES_KEY, []);
  const idx = favs.indexOf(icao);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.unshift(icao);
    if (favs.length > 20) favs.pop();
  }
  storage.set(FAVORITES_KEY, favs);
  renderFavorites(favoritesEl, favs, onChipClick);
  updateFavStar(favToggle, icao, favs);
}

function updateFavStar(btn, icao, favs) {
  const isFav = icao && favs.includes(icao);
  btn.innerHTML = isFav ? '&#9733;' : '&#9734;';
  btn.classList.toggle('apt-fav-toggle--active', isFav);
}

function renderFavorites(el, favs, onChipClick) {
  if (!favs.length) { el.innerHTML = ''; return; }
  el.innerHTML = favs.map(icao => `
    <span class="apt-chip" data-icao="${icao}">
      ${icao}<button class="apt-chip__remove" data-remove="${icao}" aria-label="Remove ${icao}">&times;</button>
    </span>
  `).join('');

  el.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
      e.stopPropagation();
      const code = removeBtn.dataset.remove;
      const updated = storage.get(FAVORITES_KEY, []).filter(f => f !== code);
      storage.set(FAVORITES_KEY, updated);
      renderFavorites(el, updated, onChipClick);
      const favToggle = panelRef.querySelector('#apt-fav-toggle');
      const icaoInput = panelRef.querySelector('#apt-icao');
      if (favToggle && icaoInput) {
        updateFavStar(favToggle, icaoInput.value.trim().toUpperCase(), updated);
      }
      return;
    }
    const chip = e.target.closest('[data-icao]');
    if (chip) onChipClick(chip.dataset.icao);
  }, { once: false });
}

/* ── Main fetch logic ── */

async function fetchAirport(icao, resultsEl) {
  if (!navigator.onLine) {
    resultsEl.innerHTML = `<div class="alert alert--info">Airport data requires an internet connection.</div>`;
    return;
  }

  resultsEl.innerHTML = `<div class="placeholder-message">
    <div class="placeholder-message__icon apt-spinner"></div>
    <div class="placeholder-message__text">Loading ${icao}...</div>
  </div>`;

  try {
    // Phase 1: Try aviationweather.gov for all three
    const [airportRes, metarRes, tafRes] = await Promise.allSettled([
      awxFetch(`${AWX}/airport?ids=${icao}&format=json`),
      awxFetch(`${AWX}/metar?ids=${icao}&format=json`),
      awxFetch(`${AWX}/taf?ids=${icao}&format=json`),
    ]);

    let airport = settled(airportRes);
    let metar = settled(metarRes);
    let taf = settled(tafRes);
    let airportSource = 'awx';
    let weatherNote = null;

    // Phase 2: If no airport data from AWX, try OurAirports
    if (!airport) {
      const oaResult = await oaLookup(icao);
      if (oaResult) {
        airport = normalizeOA(oaResult);
        airportSource = 'ourairports';
      }
    }

    if (!airport && !metar && !taf) {
      resultsEl.innerHTML = `<div class="alert alert--error">No data found for "${icao}". Check the airport code and try again.</div>`;
      return;
    }

    // Phase 3: If we have airport coords but no weather, try bbox lookup
    if (airport && !metar) {
      const nearby = await fetchNearbyWeather(airport.lat, airport.lon, icao);
      if (nearby) {
        metar = nearby.metar;
        taf = nearby.taf;
        weatherNote = nearby.note;
      }
    }

    resultsEl.innerHTML =
      renderAirportInfo(airport, airportSource) +
      renderMetar(metar, weatherNote) +
      renderTaf(taf, weatherNote && !taf ? weatherNote : null);

    wireTafTimeToggle(resultsEl);
  } catch (err) {
    resultsEl.innerHTML = `<div class="alert alert--error">Failed to fetch airport data: ${err.message}</div>`;
  }
}

/** Fetch from AWX through CORS proxy, return parsed JSON or []. */
async function awxFetch(url) {
  const r = await fetch(PROXY(url));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  return text ? JSON.parse(text) : [];
}

/** Extract first element from a settled promise result, or null. */
function settled(res) {
  return res.status === 'fulfilled' && res.value?.length ? res.value[0] : null;
}

/**
 * Search for nearby METAR/TAF using a geographic bounding box.
 * Returns { metar, taf, note } or null.
 */
async function fetchNearbyWeather(lat, lon, excludeIcao) {
  const delta = 0.5; // ~30 nm
  const bbox = `${lat - delta},${lon - delta},${lat + delta},${lon + delta}`;

  const [metarRes, tafRes] = await Promise.allSettled([
    awxFetch(`${AWX}/metar?bbox=${bbox}&format=json`),
    awxFetch(`${AWX}/taf?bbox=${bbox}&format=json`),
  ]);

  const metars = metarRes.status === 'fulfilled' ? metarRes.value : [];
  const tafs = tafRes.status === 'fulfilled' ? tafRes.value : [];

  if (!metars.length && !tafs.length) return null;

  // Find the closest METAR station
  let bestMetar = null;
  let bestDist = Infinity;
  for (const m of metars) {
    if (m.icaoId === excludeIcao) continue;
    const d = haversineNm(lat, lon, m.lat, m.lon);
    if (d < bestDist) { bestDist = d; bestMetar = m; }
  }

  if (!bestMetar) return null;

  // Find TAF from the same station, or the closest one
  let bestTaf = tafs.find(t => t.icaoId === bestMetar.icaoId) || null;
  if (!bestTaf && tafs.length) {
    let tafDist = Infinity;
    for (const t of tafs) {
      const d = haversineNm(lat, lon, t.lat, t.lon);
      if (d < tafDist) { tafDist = d; bestTaf = t; }
    }
  }

  // If bbox didn't return TAFs, try a direct fetch for the nearest METAR station
  if (!bestTaf && bestMetar.icaoId) {
    try {
      const directTafs = await awxFetch(`${AWX}/taf?ids=${bestMetar.icaoId}&format=json`);
      if (directTafs?.length) bestTaf = directTafs[0];
    } catch { /* ignore */ }
  }

  const dir = bearing(lat, lon, bestMetar.lat, bestMetar.lon);
  const note = `From ${bestMetar.icaoId} (${bestMetar.name || ''}), ${Math.round(bestDist)} nm ${compassDir(dir)}`;

  return { metar: bestMetar, taf: bestTaf, note };
}

/**
 * Normalize OurAirports data to match the shape we use for rendering.
 */
function normalizeOA({ airport: oa, runways }) {
  const ids = [oa.icaoCode, oa.localCode, oa.iataCode ? `IATA: ${oa.iataCode}` : '']
    .filter(Boolean);

  return {
    name: oa.name,
    icaoId: oa.icaoCode || oa.ident,
    iataId: oa.iataCode,
    localCode: oa.localCode,
    elev: oa.elev,
    lat: oa.lat,
    lon: oa.lon,
    municipality: oa.municipality,
    region: oa.region,
    country: oa.country,
    type: oa.type,
    _ids: ids,
    runways: runways.map(r => ({
      id: r.id,
      dimension: [r.length, r.width].filter(Boolean).join(' x ') + (r.length ? ' ft' : ''),
      surface: r.surface,
      lighted: r.lighted,
    })),
  };
}

/* ── Renderers ── */

function renderAirportInfo(apt, source) {
  if (!apt) return '';
  const units = getUnits();

  const ids = apt._ids
    ? apt._ids.join(' / ')
    : [apt.icaoId, apt.iataId ? `IATA: ${apt.iataId}` : '', apt.faaId ? `FAA: ${apt.faaId}` : '']
        .filter(Boolean).join(' / ');

  const location = [apt.municipality, apt.region, apt.country].filter(Boolean).join(', ');
  const elev = apt.elev != null ? dispAlt(apt.elev, units) : '—';

  let runwaysHtml = '';
  if (apt.runways?.length) {
    runwaysHtml = `
      <table class="apt-table">
        <thead><tr><th>Runway</th><th>Dimensions</th><th>Surface</th></tr></thead>
        <tbody>
          ${apt.runways.map(r => `
            <tr>
              <td>${r.id || '—'}</td>
              <td>${r.dimension ? dispDimension(r.dimension, units) : '—'}</td>
              <td>${surfaceName(r.surface)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  const sourceLabel = source === 'ourairports'
    ? '<span class="apt-source">OurAirports</span>'
    : '';

  return `
    <div class="panel apt-card">
      <h2 class="panel__title">${apt.name || apt.icaoId} ${sourceLabel}</h2>
      <ul class="results-list">
        <li class="results-list__item">
          <span class="results-list__label">Identifiers</span>
          <span class="results-list__value">${ids}</span>
        </li>
        ${location ? `
        <li class="results-list__item">
          <span class="results-list__label">Location</span>
          <span class="results-list__value">${location}</span>
        </li>` : ''}
        <li class="results-list__item">
          <span class="results-list__label">Elevation</span>
          <span class="results-list__value">${elev}</span>
        </li>
        ${apt.lat != null ? `
        <li class="results-list__item">
          <span class="results-list__label">Coordinates</span>
          <span class="results-list__value">${apt.lat.toFixed(4)}, ${apt.lon.toFixed(4)}</span>
        </li>` : ''}
      </ul>
      ${runwaysHtml}
    </div>
  `;
}

function renderMetar(m, note) {
  if (!m) return '<div class="panel apt-card"><h2 class="panel__title">METAR</h2><div class="alert alert--info">No METAR available.</div></div>';

  const units = getUnits();
  const catClass = flightCatClass(m.fltCat);
  const wind = formatWind(m.wdir, m.wspd, m.wgst);
  const reportAge = m.obsTime ? timeSince(m.obsTime) : '';

  let cloudsHtml = '';
  if (m.clouds?.length) {
    cloudsHtml = m.clouds.map(c => {
      const coverName = decodeCover(c.cover);
      return `${coverName}${c.base != null ? ' at ' + dispAlt(c.base, units) : ''}`;
    }).join(', ');
  }

  const wxDecoded = m.wxString ? decodeWx(m.wxString) : '';

  const noteHtml = note ? `<div class="apt-nearby-note">${note}</div>` : '';

  return `
    <div class="panel apt-card">
      <h2 class="panel__title">METAR <span class="apt-flt-cat ${catClass}">${m.fltCat || '—'}</span></h2>
      ${noteHtml}
      <div class="apt-raw">${m.rawOb || '—'}</div>
      <ul class="results-list">
        <li class="results-list__item">
          <span class="results-list__label">Wind</span>
          <span class="results-list__value">${wind}</span>
        </li>
        <li class="results-list__item">
          <span class="results-list__label">Visibility</span>
          <span class="results-list__value">${m.visib != null ? m.visib + ' SM' : '—'}</span>
        </li>
        ${wxDecoded ? `
        <li class="results-list__item">
          <span class="results-list__label">Weather</span>
          <span class="results-list__value">${wxDecoded}</span>
        </li>` : ''}
        <li class="results-list__item">
          <span class="results-list__label">Clouds</span>
          <span class="results-list__value">${cloudsHtml || 'Clear'}</span>
        </li>
        <li class="results-list__item">
          <span class="results-list__label">Temperature</span>
          <span class="results-list__value">${m.temp != null ? dispTemp(m.temp, units) : '—'}</span>
        </li>
        <li class="results-list__item">
          <span class="results-list__label">Dewpoint</span>
          <span class="results-list__value">${m.dewp != null ? dispTemp(m.dewp, units) : '—'}</span>
        </li>
        <li class="results-list__item">
          <span class="results-list__label">Altimeter</span>
          <span class="results-list__value">${m.altim != null ? dispAltimeter(m.altim, units) : '—'}</span>
        </li>
        ${reportAge ? `
        <li class="results-list__item">
          <span class="results-list__label">Observed</span>
          <span class="results-list__value">${reportAge}</span>
        </li>` : ''}
      </ul>
      ${renderRemarksSection(m.rawOb)}
      ${m.rawOb?.trimEnd().endsWith('$') ? '<div class="alert alert--warning">Station needs maintenance — data may be unreliable.</div>' : ''}
    </div>
  `;
}

function renderTaf(t, note) {
  if (!t) return '<div class="panel apt-card"><h2 class="panel__title">TAF</h2><div class="alert alert--info">No TAF available.</div></div>';

  const units = getUnits();
  const noteHtml = note ? `<div class="apt-nearby-note">${note}</div>` : '';

  let rawRows = '';
  let decodedRows = '';
  if (t.fcsts?.length) {
    for (const f of t.fcsts) {
      const change = f.fcstChange || '';
      const from = f.timeFrom || '';
      const to = f.timeTo || '';
      const wind = formatWind(f.wdir, f.wspd, f.wgst);
      const vis = f.visib != null ? f.visib + ' SM' : '';
      const wx = f.wxString || '';
      const clouds = f.clouds?.length
        ? f.clouds.map(c => `${c.cover}${c.base != null ? ' ' + dispAlt(c.base, units) : ''}`).join(' ')
        : '';
      const prob = f.probability ? `PROB${f.probability}` : '';
      const rawLabel = [prob, change].filter(Boolean).join(' ') || 'BASE';
      const rawPeriod = (from ? formatUtc(from) : '') + (to ? ' - ' + formatUtc(to) : '');

      rawRows += `
        <tr>
          <td><strong>${rawLabel}</strong></td>
          <td>${rawPeriod}</td>
          <td>${wind}</td>
          <td>${vis}</td>
          <td>${[wx, clouds].filter(Boolean).join(' ')}</td>
        </tr>`;

      const decLabel = decodeChange(change, f.probability);
      const decPeriod = (from ? formatLocal(from) : '') + (to ? ' - ' + formatLocal(to) : '');
      const decWx = [wx ? decodeWx(wx) : '', clouds].filter(Boolean).join('; ');

      decodedRows += `
        <tr>
          <td><strong>${decLabel}</strong></td>
          <td>${decPeriod}</td>
          <td>${wind}</td>
          <td>${vis}</td>
          <td>${decWx}</td>
        </tr>`;
    }
  }

  const hasRows = rawRows.length > 0;

  return `
    <div class="panel apt-card" id="taf-card">
      <h2 class="panel__title">TAF
        ${hasRows ? '<button class="btn btn-sm apt-time-toggle" id="taf-mode-toggle" title="Toggle Raw / Decoded">Raw</button>' : ''}
      </h2>
      ${noteHtml}
      <div class="apt-raw">${t.rawTAF || '—'}</div>
      ${hasRows ? `
      <table class="apt-table apt-table--taf" id="taf-table-raw">
        <thead><tr><th>Type</th><th>Period (UTC)</th><th>Wind</th><th>Vis</th><th>Wx / Clouds</th></tr></thead>
        <tbody>${rawRows}</tbody>
      </table>
      <table class="apt-table apt-table--taf" id="taf-table-decoded" style="display:none">
        <thead><tr><th>Type</th><th>Period (Local)</th><th>Wind</th><th>Vis</th><th>Weather / Clouds</th></tr></thead>
        <tbody>${decodedRows}</tbody>
      </table>` : ''}
    </div>
  `;
}

/* ── Helpers ── */

function renderRemarksSection(rawOb) {
  const remarks = decodeRemarks(rawOb);
  if (!remarks.length) return '';
  return `
    <details class="apt-remarks">
      <summary class="apt-remarks__summary">Remarks (${remarks.length})</summary>
      <ul class="results-list">
        ${remarks.map(r => `
        <li class="results-list__item">
          <span class="results-list__label">${r.label}</span>
          <span class="results-list__value">${r.value}</span>
        </li>`).join('')}
      </ul>
    </details>
  `;
}

function wireTafTimeToggle(container) {
  const btn = container.querySelector('#taf-mode-toggle');
  if (!btn) return;
  const rawTable = container.querySelector('#taf-table-raw');
  const decTable = container.querySelector('#taf-table-decoded');
  if (!rawTable || !decTable) return;

  let decoded = false;
  btn.addEventListener('click', () => {
    decoded = !decoded;
    btn.textContent = decoded ? 'Decoded' : 'Raw';
    rawTable.style.display = decoded ? 'none' : '';
    decTable.style.display = decoded ? '' : 'none';
  });
}

function formatWind(dir, spd, gust) {
  if (dir == null && spd == null) return 'Calm';
  const d = dir === 0 ? 'VRB' : (dir != null ? String(dir).padStart(3, '0') + '°' : '—');
  const g = gust ? `G${gust}` : '';
  return `${d} at ${spd ?? '—'}${g} kt`;
}

function formatUtc(epoch) {
  const d = new Date(epoch * 1000);
  return d.toISOString().slice(5, 16).replace('T', ' ') + 'Z';
}

function formatLocal(epoch) {
  const d = new Date(epoch * 1000);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timeSince(epoch) {
  const mins = Math.round((Date.now() / 1000 - epoch) / 60);
  const d = new Date(epoch * 1000);
  const local = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  let ago;
  if (mins < 1) ago = 'Just now';
  else if (mins < 60) ago = `${mins} min ago`;
  else { const hrs = Math.floor(mins / 60); ago = `${hrs}h ${mins % 60}m ago`; }
  return `${ago} (${local})`;
}

function flightCatClass(cat) {
  switch (cat) {
    case 'VFR': return 'apt-flt-cat--vfr';
    case 'MVFR': return 'apt-flt-cat--mvfr';
    case 'IFR': return 'apt-flt-cat--ifr';
    case 'LIFR': return 'apt-flt-cat--lifr';
    default: return '';
  }
}

function surfaceName(code) {
  if (!code) return '—';
  const map = {
    A: 'Asphalt', C: 'Concrete', G: 'Grass', T: 'Turf',
    D: 'Dirt', V: 'Gravel', W: 'Water', S: 'Snow',
  };
  // AWX uses single letters; OurAirports uses strings like "ASP", "ASPH-G", "CONC"
  if (map[code]) return map[code];
  const upper = code.toUpperCase();
  if (upper.startsWith('ASP')) return 'Asphalt';
  if (upper.startsWith('CON')) return 'Concrete';
  if (upper.startsWith('GRS') || upper.startsWith('GRA') || upper === 'GRASS') return 'Grass';
  if (upper.startsWith('TUR')) return 'Turf';
  if (upper.startsWith('GRV') || upper.startsWith('GRVL')) return 'Gravel';
  if (upper.startsWith('DIR') || upper === 'DIRT') return 'Dirt';
  return code;
}

/** Display altitude/elevation in user's preferred unit. Input is always ft. */
function dispAlt(valueFt, units) {
  if (units.altitude === 'm') {
    return `${formatNumber(Math.round(convert.ftToM(valueFt)))} m`;
  }
  return `${formatNumber(Math.round(valueFt))} ft`;
}

/** Display temperature in user's preferred unit. Input is always °C. */
function dispTemp(valueC, units) {
  if (units.temperature === 'F') {
    return `${formatNumber(Math.round(convert.cToF(valueC)))} °F`;
  }
  return `${formatNumber(valueC, 1)} °C`;
}

/** Display altimeter in user's preferred unit. Input is always hPa. */
function dispAltimeter(valueHPa, units) {
  if (units.altimeter === 'inHg') {
    return `${formatNumber(convert.hPaToInHg(valueHPa), 2)} inHg`;
  }
  return `${formatNumber(valueHPa, 1)} hPa`;
}

/** Display runway dimension string in user's preferred unit. Parses "3400 x 75 ft" format. */
function dispDimension(dim, units) {
  if (units.altitude === 'm') {
    return dim.replace(/(\d+)/g, (match) => {
      const ft = parseInt(match, 10);
      return Math.round(convert.ftToM(ft));
    }).replace(/ft/g, 'm');
  }
  return dim;
}

/** Haversine distance in nautical miles. */
function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** Initial bearing from point 1 to point 2 in degrees. */
function bearing(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function compassDir(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }
