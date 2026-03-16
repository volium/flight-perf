/**
 * METAR / TAF weather decoding utilities.
 */

const WX_CODES = {
  // Descriptors
  MI: 'shallow', BC: 'patches', PR: 'partial', DR: 'drifting',
  BL: 'blowing', SH: 'showers', TS: 'thunderstorm', FZ: 'freezing',
  // Precipitation
  RA: 'rain', DZ: 'drizzle', SN: 'snow', SG: 'snow grains',
  IC: 'ice crystals', PL: 'ice pellets', GR: 'hail', GS: 'small hail',
  UP: 'unknown precip',
  // Obscuration
  FG: 'fog', BR: 'mist', HZ: 'haze', FU: 'smoke',
  SA: 'sand', DU: 'dust', VA: 'volcanic ash', PY: 'spray',
  // Other
  SQ: 'squall', FC: 'funnel cloud', PO: 'dust whirls', SS: 'sandstorm', DS: 'duststorm',
};

/**
 * Decode a weather string like "-SN BR" into "light snow, mist".
 */
export function decodeWx(wxString) {
  if (!wxString) return '';
  return wxString.split(/\s+/).map(token => {
    let intensity = '';
    let t = token;
    if (t.startsWith('+')) { intensity = 'heavy '; t = t.slice(1); }
    else if (t.startsWith('-')) { intensity = 'light '; t = t.slice(1); }
    else if (t.startsWith('VC')) { intensity = 'vicinity '; t = t.slice(2); }

    const parts = [];
    while (t.length >= 2) {
      const code = t.slice(0, 2);
      if (WX_CODES[code]) { parts.push(WX_CODES[code]); t = t.slice(2); }
      else break;
    }
    if (parts.length) return intensity + parts.join(' ');
    return token;
  }).join(', ');
}

/**
 * Decode cloud cover abbreviation: BKN → "Broken".
 */
export function decodeCover(code) {
  const covers = {
    SKC: 'Clear', CLR: 'Clear', FEW: 'Few', SCT: 'Scattered',
    BKN: 'Broken', OVC: 'Overcast', VV: 'Vertical Vis',
  };
  return covers[code] || code;
}

/**
 * Decode TAF change type: FM → "From", TEMPO → "Temporary", etc.
 */
export function decodeChange(change, probability) {
  const types = {
    FM: 'From',
    TEMPO: 'Temporary',
    BECMG: 'Becoming',
  };
  const parts = [];
  if (probability) parts.push(`${probability}% chance`);
  if (change && types[change]) parts.push(types[change]);
  else if (change) parts.push(change);
  return parts.join(' — ') || 'Initial';
}

/**
 * Decode the remarks (RMK) section of a METAR.
 * Returns an array of { label, value } objects for display.
 *
 * @param {string} rawOb - Full raw METAR string
 * @returns {{ label: string, value: string }[]}
 */
export function decodeRemarks(rawOb) {
  if (!rawOb) return [];
  const rmkIdx = rawOb.indexOf('RMK');
  if (rmkIdx === -1) return [];
  const rmk = rawOb.slice(rmkIdx + 3).trim();
  if (!rmk) return [];

  const results = [];
  const tokens = rmk.split(/\s+/);
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];

    // Station type
    if (t === 'AO1') {
      results.push({ label: 'Station', value: 'Automated, no precip sensor' });
      i++; continue;
    }
    if (t === 'AO2') {
      results.push({ label: 'Station', value: 'Automated, with precip sensor' });
      i++; continue;
    }

    // Sea level pressure: SLP followed by 3 digits
    const slpMatch = t.match(/^SLP(\d{3})$/);
    if (slpMatch) {
      const raw = parseInt(slpMatch[1], 10);
      const slp = (raw >= 500 ? 900 : 1000) + raw / 10;
      results.push({ label: 'Sea Level Pressure', value: `${slp.toFixed(1)} hPa` });
      i++; continue;
    }

    // Precise temp/dewpoint: T followed by 8 digits
    const tempMatch = t.match(/^T(\d{4})(\d{4})$/);
    if (tempMatch) {
      const temp = decodePreciseTemp(tempMatch[1]);
      const dewp = decodePreciseTemp(tempMatch[2]);
      results.push({ label: 'Precise Temp', value: `${temp}°C / Dewpoint ${dewp}°C` });
      i++; continue;
    }

    // Hourly precip: P followed by 4 digits
    const precipMatch = t.match(/^P(\d{4})$/);
    if (precipMatch) {
      const val = parseInt(precipMatch[1], 10);
      results.push({ label: 'Hourly Precip', value: val === 0 ? 'Trace' : `${(val / 100).toFixed(2)} in` });
      i++; continue;
    }

    // 6-hour precip: 6 followed by 4 digits
    const precip6Match = t.match(/^6(\d{4})$/);
    if (precip6Match) {
      const val = parseInt(precip6Match[1], 10);
      results.push({ label: '6-hr Precip', value: val === 0 ? 'Trace' : `${(val / 100).toFixed(2)} in` });
      i++; continue;
    }

    // 24-hour precip: 7 followed by 4 digits
    const precip24Match = t.match(/^7(\d{4})$/);
    if (precip24Match) {
      const val = parseInt(precip24Match[1], 10);
      results.push({ label: '24-hr Precip', value: val === 0 ? 'Trace' : `${(val / 100).toFixed(2)} in` });
      i++; continue;
    }

    // 6-hr max temp: 1 followed by 4 digits
    const max6Match = t.match(/^1(\d{4})$/);
    if (max6Match) {
      results.push({ label: '6-hr Max Temp', value: `${decodePreciseTemp(max6Match[1])}°C` });
      i++; continue;
    }

    // 6-hr min temp: 2 followed by 4 digits
    const min6Match = t.match(/^2(\d{4})$/);
    if (min6Match) {
      results.push({ label: '6-hr Min Temp', value: `${decodePreciseTemp(min6Match[1])}°C` });
      i++; continue;
    }

    // 24-hr max/min temp: 4 followed by 8 digits
    const temp24Match = t.match(/^4(\d{4})(\d{4})$/);
    if (temp24Match) {
      const max = decodePreciseTemp(temp24Match[1]);
      const min = decodePreciseTemp(temp24Match[2]);
      results.push({ label: '24-hr Temp Range', value: `${max}°C / ${min}°C` });
      i++; continue;
    }

    // Pressure tendency: 5 followed by 4 digits
    const pressMatch = t.match(/^5([0-8])(\d{3})$/);
    if (pressMatch) {
      const code = parseInt(pressMatch[1], 10);
      const amt = parseInt(pressMatch[2], 10) / 10;
      const desc = decodePressureTendency(code);
      results.push({ label: '3-hr Pressure', value: `${desc} ${amt.toFixed(1)} hPa` });
      i++; continue;
    }

    // Variable ceiling: CIG xxxVxxx
    if (t === 'CIG' && i + 1 < tokens.length) {
      const cigMatch = tokens[i + 1].match(/^(\d{3})V(\d{3})$/);
      if (cigMatch) {
        const lo = parseInt(cigMatch[1], 10) * 100;
        const hi = parseInt(cigMatch[2], 10) * 100;
        results.push({ label: 'Variable Ceiling', value: `${lo.toLocaleString()} - ${hi.toLocaleString()} ft` });
        i += 2; continue;
      }
    }

    // Variable wind: WND xxxVxxx or VRBxx (handled separately)
    if (t === 'VIS' && i + 1 < tokens.length) {
      const visMatch = tokens[i + 1].match(/^(\d+)V(\d+)$/);
      if (visMatch) {
        results.push({ label: 'Variable Vis', value: `${visMatch[1]} - ${visMatch[2]} SM` });
        i += 2; continue;
      }
    }

    // Precip begin/end: patterns like RAB15E25, SNB05, UPB11E12B44E47FZRAB29E44SNE11B12E14
    const precipBeMatch = t.match(/^([A-Z]{2,4}(?:B\d{2,4}|E\d{2,4})+)$/);
    if (precipBeMatch && /[BE]\d{2}/.test(t)) {
      const decoded = decodePrecipEvents(t);
      if (decoded) {
        results.push({ label: 'Precip History', value: decoded });
        i++; continue;
      }
    }

    // Peak wind: PK WND dddff(f)/hhmm
    if (t === 'PK' && i + 2 < tokens.length && tokens[i + 1] === 'WND') {
      const pkMatch = tokens[i + 2].match(/^(\d{3})(\d{2,3})\/(\d{2,4})$/);
      if (pkMatch) {
        const dir = pkMatch[1];
        const spd = parseInt(pkMatch[2], 10);
        const time = pkMatch[3];
        results.push({ label: 'Peak Wind', value: `${dir}° at ${spd} kt at :${time}` });
        i += 3; continue;
      }
    }

    // Thunderstorm location/movement: TS [location] [MOV direction]
    // e.g. "TS OHD MOV E", "TS W MOV NE", "TS ALQDS" (all quadrants)
    if (t === 'TS' && i + 1 < tokens.length) {
      const locDirs = new Set(['OHD', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW',
        'DSNT', 'ALQDS', 'VC', 'AND', 'THRU', 'OMTS', 'MOV']);
      const tsParts = ['Thunderstorm'];
      let j = i + 1;
      while (j < tokens.length && (locDirs.has(tokens[j]) || tokens[j] === 'MOV')) {
        if (tokens[j] === 'MOV' && j + 1 < tokens.length) {
          tsParts.push('moving ' + tokens[j + 1]);
          j += 2;
        } else if (tokens[j] === 'OHD') {
          tsParts.push('overhead');
          j++;
        } else if (tokens[j] === 'DSNT') {
          tsParts.push('distant');
          j++;
        } else if (tokens[j] === 'ALQDS') {
          tsParts.push('all quadrants');
          j++;
        } else if (tokens[j] === 'VC') {
          tsParts.push('vicinity');
          j++;
        } else {
          tsParts.push(tokens[j]);
          j++;
        }
      }
      if (j > i + 1) {
        results.push({ label: 'Thunderstorm', value: tsParts.join(' ') });
        i = j; continue;
      }
    }

    // Sensor status flags (some may have a runway qualifier like VISNO RWY04R)
    const sensorFlags = {
      TSNO: 'Thunderstorm info not available',
      FZRANO: 'Freezing rain info not available',
      PNO: 'Precip sensor not available',
      RVRNO: 'RVR not available',
      PWINO: 'Precip identifier not available',
      VISNO: 'Visibility sensor not available',
    };
    if (sensorFlags[t]) {
      let val = sensorFlags[t];
      if (i + 1 < tokens.length && tokens[i + 1].startsWith('RWY')) {
        val += ` (${tokens[i + 1]})`;
        i++;
      }
      results.push({ label: 'Sensor', value: val });
      i++; continue;
    }

    // Pressure rising/falling rapidly
    if (t === 'PRESRR') { results.push({ label: 'Pressure', value: 'Rising rapidly' }); i++; continue; }
    if (t === 'PRESFR') { results.push({ label: 'Pressure', value: 'Falling rapidly' }); i++; continue; }

    // Maintenance indicator
    if (t === '$') { results.push({ label: 'Maintenance', value: 'Station needs maintenance' }); i++; continue; }

    // Skip unrecognized tokens silently
    i++;
  }

  return results;
}

function decodePreciseTemp(fourDigit) {
  const sign = fourDigit[0] === '1' ? -1 : 1;
  const val = parseInt(fourDigit.slice(1), 10) / 10;
  return (sign * val).toFixed(1);
}

function decodePressureTendency(code) {
  const tendencies = {
    0: 'Rising then steady,',
    1: 'Rising then slower,',
    2: 'Rising steadily,',
    3: 'Falling/steady then rising,',
    4: 'Steady,',
    5: 'Falling then steady,',
    6: 'Falling then slower,',
    7: 'Falling steadily,',
    8: 'Rising then falling,',
  };
  return tendencies[code] || '';
}

function decodePrecipEvents(token) {
  // Parse patterns like UPB11E12B44E47FZRAB29E44SNE11B12E14
  const events = [];
  // Split into wx-type + begin/end sequences
  const re = /([A-Z]{2,4}?)((?:[BE]\d{2,4})+)/g;
  let m;
  while ((m = re.exec(token)) !== null) {
    const wxCode = m[1];
    const times = m[2];
    const wxName = decodeWxType(wxCode);
    const timeEvents = [];
    const timeRe = /([BE])(\d{2,4})/g;
    let tm;
    while ((tm = timeRe.exec(times)) !== null) {
      const action = tm[1] === 'B' ? 'began' : 'ended';
      timeEvents.push(`${action} :${tm[2]}`);
    }
    events.push(`${wxName} ${timeEvents.join(', ')}`);
  }
  return events.length ? events.join('; ') : null;
}

function decodeWxType(code) {
  // Map abbreviated wx codes used in remarks
  const map = {
    UP: 'unknown precip', RA: 'rain', SN: 'snow', DZ: 'drizzle',
    PL: 'ice pellets', GR: 'hail', GS: 'small hail', IC: 'ice crystals',
    FG: 'fog', BR: 'mist', HZ: 'haze', FU: 'smoke',
    FZRA: 'freezing rain', FZDZ: 'freezing drizzle',
    TSRA: 'thunderstorm rain', TSSN: 'thunderstorm snow',
    SHRA: 'showers rain', SHSN: 'showers snow',
    TS: 'thunderstorm', SH: 'showers', FZ: 'freezing',
  };
  return map[code] || code;
}
