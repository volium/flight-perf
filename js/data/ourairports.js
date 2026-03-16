const AIRPORTS_URL = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
const RUNWAYS_URL = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/runways.csv';

let airportsData = null; // Map: lowercase lookup key -> airport object
let runwaysData = null;  // Map: airport ident -> array of runway objects
let loadPromise = null;

/**
 * Start preloading CSV data in the background.
 * Safe to call multiple times — only fetches once.
 */
export function preload() {
  if (!loadPromise) {
    loadPromise = Promise.all([
      fetchAndParse(AIRPORTS_URL, parseAirports),
      fetchAndParse(RUNWAYS_URL, parseRunways),
    ]).then(([airports, runways]) => {
      airportsData = airports;
      runwaysData = runways;
    }).catch(err => {
      console.warn('OurAirports preload failed:', err);
      loadPromise = null; // allow retry
    });
  }
  return loadPromise;
}

/**
 * Look up an airport by any identifier (ICAO, FAA local code, ident, IATA, GPS code).
 * Returns { airport, runways } or null.
 */
export async function lookup(code) {
  await preload();
  if (!airportsData) return null;

  const key = code.trim().toUpperCase();
  const airport = airportsData.get(key);
  if (!airport) return null;

  const runways = runwaysData?.get(airport.ident) || [];
  return { airport, runways };
}

/**
 * Check if data is loaded yet (for non-blocking checks).
 */
export function isLoaded() {
  return airportsData !== null;
}

async function fetchAndParse(url, parser) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return parser(text);
}

function parseAirports(csv) {
  const map = new Map();
  const lines = csv.split('\n');
  // header: id, ident, type, name, latitude_deg, longitude_deg, elevation_ft,
  //         continent, iso_country, iso_region, municipality, scheduled_service,
  //         icao_code, iata_code, gps_code, local_code, home_link, wikipedia_link, keywords
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 16) continue;

    const type = cols[2];
    if (type === 'closed') continue; // skip closed airports

    const airport = {
      ident: cols[1],
      type,
      name: cols[3],
      lat: parseFloat(cols[4]),
      lon: parseFloat(cols[5]),
      elev: cols[6] ? parseInt(cols[6], 10) : null,
      country: cols[8],
      region: cols[9],
      municipality: cols[10],
      icaoCode: cols[12] || '',
      iataCode: cols[13] || '',
      gpsCode: cols[14] || '',
      localCode: cols[15] || '',
    };

    if (isNaN(airport.lat) || isNaN(airport.lon)) continue;

    // Index by every identifier so lookup("S50"), lookup("KS50"), etc. all work
    const keys = new Set();
    if (airport.ident) keys.add(airport.ident.toUpperCase());
    if (airport.icaoCode) keys.add(airport.icaoCode.toUpperCase());
    if (airport.iataCode) keys.add(airport.iataCode.toUpperCase());
    if (airport.gpsCode) keys.add(airport.gpsCode.toUpperCase());
    if (airport.localCode) keys.add(airport.localCode.toUpperCase());

    for (const k of keys) {
      map.set(k, airport);
    }
  }
  return map;
}

function parseRunways(csv) {
  const map = new Map();
  const lines = csv.split('\n');
  // header: id, airport_ref, airport_ident, length_ft, width_ft, surface,
  //         lighted, closed, le_ident, ..., he_ident, ...
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 9) continue;

    const ident = cols[2];
    const closed = cols[7] === '1';
    if (closed) continue;

    const rwy = {
      id: [cols[8], cols[14]].filter(Boolean).join('/'),
      length: cols[3] ? parseInt(cols[3], 10) : null,
      width: cols[4] ? parseInt(cols[4], 10) : null,
      surface: cols[5] || '',
      lighted: cols[6] === '1',
    };

    if (!map.has(ident)) map.set(ident, []);
    map.get(ident).push(rwy);
  }
  return map;
}

/**
 * Minimal CSV line parser that handles quoted fields with commas and escaped quotes.
 */
function parseCSVLine(line) {
  const result = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) { result.push(''); break; }
    if (line[i] === '"') {
      let val = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') { val += '"'; i += 2; }
          else { i++; break; } // closing quote
        } else {
          val += line[i]; i++;
        }
      }
      result.push(val);
      i++; // skip comma
    } else {
      const next = line.indexOf(',', i);
      if (next === -1) { result.push(line.slice(i)); break; }
      result.push(line.slice(i, next));
      i = next + 1;
    }
  }
  return result;
}
