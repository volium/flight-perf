import { describe, it, expect } from 'vitest';
import { decodeWx, decodeCover, decodeChange, decodeRemarks } from '@/calc/wx-decode.js';

// ─── decodeWx ───────────────────────────────────────────────────────────────

describe('decodeWx', () => {
  it('decodes simple precipitation', () => {
    expect(decodeWx('RA')).toBe('rain');
    expect(decodeWx('SN')).toBe('snow');
    expect(decodeWx('DZ')).toBe('drizzle');
  });

  it('decodes light intensity prefix', () => {
    expect(decodeWx('-RA')).toBe('light rain');
    expect(decodeWx('-SN')).toBe('light snow');
  });

  it('decodes heavy intensity prefix', () => {
    expect(decodeWx('+RA')).toBe('heavy rain');
    expect(decodeWx('+SN')).toBe('heavy snow');
  });

  it('decodes vicinity prefix', () => {
    expect(decodeWx('VCTS')).toBe('vicinity thunderstorm');
    expect(decodeWx('VCSH')).toBe('vicinity showers');
  });

  it('decodes descriptor + precipitation combos', () => {
    expect(decodeWx('TSRA')).toBe('thunderstorm rain');
    expect(decodeWx('FZRA')).toBe('freezing rain');
    expect(decodeWx('FZDZ')).toBe('freezing drizzle');
    expect(decodeWx('SHRA')).toBe('showers rain');
    expect(decodeWx('SHSN')).toBe('showers snow');
  });

  it('decodes intensity + descriptor + precipitation', () => {
    expect(decodeWx('-SHRA')).toBe('light showers rain');
    expect(decodeWx('+TSRA')).toBe('heavy thunderstorm rain');
    expect(decodeWx('-FZRA')).toBe('light freezing rain');
  });

  it('decodes obscuration types', () => {
    expect(decodeWx('FG')).toBe('fog');
    expect(decodeWx('BR')).toBe('mist');
    expect(decodeWx('HZ')).toBe('haze');
    expect(decodeWx('FU')).toBe('smoke');
  });

  it('decodes multiple weather groups separated by space', () => {
    expect(decodeWx('-SN BR')).toBe('light snow, mist');
    expect(decodeWx('+RA FG')).toBe('heavy rain, fog');
    expect(decodeWx('-SHRA BR')).toBe('light showers rain, mist');
  });

  it('returns empty string for empty/null input', () => {
    expect(decodeWx('')).toBe('');
    expect(decodeWx(null)).toBe('');
    expect(decodeWx(undefined)).toBe('');
  });

  it('returns unrecognized codes as-is', () => {
    expect(decodeWx('XY')).toBe('XY');
    expect(decodeWx('RA XY')).toBe('rain, XY');
  });

  it('decodes other weather types', () => {
    expect(decodeWx('SQ')).toBe('squall');
    expect(decodeWx('FC')).toBe('funnel cloud');
    expect(decodeWx('SS')).toBe('sandstorm');
    expect(decodeWx('DS')).toBe('duststorm');
  });

  it('decodes mixed precipitation', () => {
    expect(decodeWx('RASN')).toBe('rain snow');
    expect(decodeWx('-RAPL')).toBe('light rain ice pellets');
    expect(decodeWx('SNPL')).toBe('snow ice pellets');
  });
});

// ─── decodeCover ────────────────────────────────────────────────────────────

describe('decodeCover', () => {
  it('decodes all standard cover types', () => {
    expect(decodeCover('SKC')).toBe('Clear');
    expect(decodeCover('CLR')).toBe('Clear');
    expect(decodeCover('FEW')).toBe('Few');
    expect(decodeCover('SCT')).toBe('Scattered');
    expect(decodeCover('BKN')).toBe('Broken');
    expect(decodeCover('OVC')).toBe('Overcast');
    expect(decodeCover('VV')).toBe('Vertical Vis');
  });

  it('returns unknown codes as-is', () => {
    expect(decodeCover('XYZ')).toBe('XYZ');
  });
});

// ─── decodeChange ───────────────────────────────────────────────────────────

describe('decodeChange', () => {
  it('decodes standard change types', () => {
    expect(decodeChange('FM')).toBe('From');
    expect(decodeChange('TEMPO')).toBe('Temporary');
    expect(decodeChange('BECMG')).toBe('Becoming');
  });

  it('returns "Initial" for no change type', () => {
    expect(decodeChange('')).toBe('Initial');
    expect(decodeChange(null)).toBe('Initial');
    expect(decodeChange(undefined)).toBe('Initial');
  });

  it('includes probability when provided', () => {
    expect(decodeChange('TEMPO', 30)).toBe('30% chance — Temporary');
    expect(decodeChange('', 40)).toBe('40% chance');
  });

  it('returns unknown change types as-is', () => {
    expect(decodeChange('INTER')).toBe('INTER');
  });

  it('combines probability with unknown change', () => {
    expect(decodeChange('INTER', 30)).toBe('30% chance — INTER');
  });
});

// ─── decodeRemarks ──────────────────────────────────────────────────────────

describe('decodeRemarks', () => {
  const metar = (rmk) => `METAR KJFK 210553Z 36010KT 10SM CLR 20/10 A3000 RMK ${rmk}`;

  it('returns empty array when no RMK section', () => {
    expect(decodeRemarks('METAR KJFK 210553Z 36010KT 10SM CLR 20/10 A3000')).toEqual([]);
  });

  it('returns empty array for null/empty input', () => {
    expect(decodeRemarks(null)).toEqual([]);
    expect(decodeRemarks('')).toEqual([]);
  });

  it('decodes AO1 and AO2 station types', () => {
    const r1 = decodeRemarks(metar('AO1'));
    expect(r1).toContainEqual({ label: 'Station', value: 'Automated, no precip sensor' });

    const r2 = decodeRemarks(metar('AO2'));
    expect(r2).toContainEqual({ label: 'Station', value: 'Automated, with precip sensor' });
  });

  it('decodes sea level pressure (SLP)', () => {
    const r = decodeRemarks(metar('SLP107'));
    expect(r).toContainEqual({ label: 'Sea Level Pressure', value: '1010.7 hPa' });
  });

  it('decodes SLP below 1000 hPa', () => {
    const r = decodeRemarks(metar('SLP981'));
    expect(r).toContainEqual({ label: 'Sea Level Pressure', value: '998.1 hPa' });
  });

  it('decodes precise temp/dewpoint (T group)', () => {
    const r = decodeRemarks(metar('T00061011'));
    expect(r).toContainEqual({ label: 'Precise Temp', value: '0.6°C / Dewpoint -1.1°C' });
  });

  it('decodes negative precise temp', () => {
    const r = decodeRemarks(metar('T10671078'));
    expect(r).toContainEqual({ label: 'Precise Temp', value: '-6.7°C / Dewpoint -7.8°C' });
  });

  it('decodes hourly precip (P group)', () => {
    const r1 = decodeRemarks(metar('P0000'));
    expect(r1).toContainEqual({ label: 'Hourly Precip', value: 'Trace' });

    const r2 = decodeRemarks(metar('P0025'));
    expect(r2).toContainEqual({ label: 'Hourly Precip', value: '0.25 in' });
  });

  it('decodes 6-hour precip', () => {
    const r = decodeRemarks(metar('60005'));
    expect(r).toContainEqual({ label: '6-hr Precip', value: '0.05 in' });
  });

  it('decodes 24-hour precip', () => {
    const r = decodeRemarks(metar('70125'));
    expect(r).toContainEqual({ label: '24-hr Precip', value: '1.25 in' });
  });

  it('decodes 6-hr max temp', () => {
    const r = decodeRemarks(metar('10011'));
    expect(r).toContainEqual({ label: '6-hr Max Temp', value: '1.1°C' });
  });

  it('decodes 6-hr min temp', () => {
    const r = decodeRemarks(metar('20006'));
    expect(r).toContainEqual({ label: '6-hr Min Temp', value: '0.6°C' });
  });

  it('decodes 24-hr max/min temp', () => {
    const r = decodeRemarks(metar('400330006'));
    expect(r).toContainEqual({ label: '24-hr Temp Range', value: '3.3°C / 0.6°C' });
  });

  it('decodes pressure tendency', () => {
    const r = decodeRemarks(metar('51016'));
    expect(r).toContainEqual({ label: '3-hr Pressure', value: 'Rising then slower, 1.6 hPa' });
  });

  it('decodes variable ceiling', () => {
    const r = decodeRemarks(metar('CIG 007V014'));
    expect(r).toContainEqual({ label: 'Variable Ceiling', value: '700 - 1,400 ft' });
  });

  it('decodes sensor status flags', () => {
    expect(decodeRemarks(metar('TSNO'))).toContainEqual({ label: 'Sensor', value: 'Thunderstorm info not available' });
    expect(decodeRemarks(metar('FZRANO'))).toContainEqual({ label: 'Sensor', value: 'Freezing rain info not available' });
    expect(decodeRemarks(metar('PNO'))).toContainEqual({ label: 'Sensor', value: 'Precip sensor not available' });
  });

  it('decodes pressure rising/falling rapidly', () => {
    expect(decodeRemarks(metar('PRESRR'))).toContainEqual({ label: 'Pressure', value: 'Rising rapidly' });
    expect(decodeRemarks(metar('PRESFR'))).toContainEqual({ label: 'Pressure', value: 'Falling rapidly' });
  });

  it('decodes maintenance indicator', () => {
    expect(decodeRemarks(metar('$'))).toContainEqual({ label: 'Maintenance', value: 'Station needs maintenance' });
  });

  it('decodes the full KSLN example METAR', () => {
    const raw = 'KSLN 210553Z AUTO 02014KT 5SM BR OVC009 01/M01 A2982 RMK AO2 UPB11E12B44E47FZRAB29E44SNE11B12E14 CIG 007V014 SLP107 P0000 60005 T00061011 10011 20006 400330006 51016 TSNO';
    const r = decodeRemarks(raw);
    expect(r.length).toBeGreaterThanOrEqual(10);
    expect(r).toContainEqual({ label: 'Station', value: 'Automated, with precip sensor' });
    expect(r).toContainEqual({ label: 'Variable Ceiling', value: '700 - 1,400 ft' });
    expect(r).toContainEqual({ label: 'Sea Level Pressure', value: '1010.7 hPa' });
    expect(r).toContainEqual({ label: 'Hourly Precip', value: 'Trace' });
    expect(r).toContainEqual({ label: '6-hr Precip', value: '0.05 in' });
    expect(r).toContainEqual({ label: 'Precise Temp', value: '0.6°C / Dewpoint -1.1°C' });
    expect(r).toContainEqual({ label: '6-hr Max Temp', value: '1.1°C' });
    expect(r).toContainEqual({ label: '6-hr Min Temp', value: '0.6°C' });
    expect(r).toContainEqual({ label: '24-hr Temp Range', value: '3.3°C / 0.6°C' });
    expect(r).toContainEqual({ label: '3-hr Pressure', value: 'Rising then slower, 1.6 hPa' });
    expect(r).toContainEqual({ label: 'Sensor', value: 'Thunderstorm info not available' });
  });

  it('decodes sensor flag with runway qualifier', () => {
    const r = decodeRemarks(metar('VISNO RWY04R'));
    expect(r).toContainEqual({ label: 'Sensor', value: 'Visibility sensor not available (RWY04R)' });
  });

  it('decodes the PHNL example METAR', () => {
    const raw = 'PHNL 291953Z 07010G22KT 7SM +RA SCT025 BKN035 27/22 A3016 RMK AO2 RAB50 SLP212 T02670217 PNO VISNO RWY04R $';
    const r = decodeRemarks(raw);
    expect(r).toContainEqual({ label: 'Station', value: 'Automated, with precip sensor' });
    expect(r).toContainEqual({ label: 'Sea Level Pressure', value: '1021.2 hPa' });
    expect(r).toContainEqual({ label: 'Precise Temp', value: '26.7°C / Dewpoint 21.7°C' });
    expect(r).toContainEqual({ label: 'Sensor', value: 'Precip sensor not available' });
    expect(r).toContainEqual({ label: 'Sensor', value: 'Visibility sensor not available (RWY04R)' });
    expect(r).toContainEqual({ label: 'Maintenance', value: 'Station needs maintenance' });
  });

  it('decodes peak wind', () => {
    const r = decodeRemarks(metar('PK WND 36045/0115'));
    expect(r).toContainEqual({ label: 'Peak Wind', value: '360° at 45 kt at :0115' });
  });

  it('decodes thunderstorm overhead moving east', () => {
    const r = decodeRemarks(metar('TS OHD MOV E'));
    expect(r).toContainEqual({ label: 'Thunderstorm', value: 'Thunderstorm overhead moving E' });
  });

  it('decodes thunderstorm distant', () => {
    const r = decodeRemarks(metar('TS DSNT W'));
    expect(r).toContainEqual({ label: 'Thunderstorm', value: 'Thunderstorm distant W' });
  });

  it('decodes thunderstorm all quadrants', () => {
    const r = decodeRemarks(metar('TS ALQDS'));
    expect(r).toContainEqual({ label: 'Thunderstorm', value: 'Thunderstorm all quadrants' });
  });

  it('decodes the KOKC example METAR remarks', () => {
    const raw = 'KOKC 011955Z AUTO 22015G25KT 180V250 3/4SM R17L/2600FT +TSRA BR OVC010CB 18/16 A2992 RMK AO2 TSB25 TS OHD MOV E SLP132';
    const r = decodeRemarks(raw);
    expect(r).toContainEqual({ label: 'Station', value: 'Automated, with precip sensor' });
    expect(r).toContainEqual({ label: 'Thunderstorm', value: 'Thunderstorm overhead moving E' });
    expect(r).toContainEqual({ label: 'Sea Level Pressure', value: '1013.2 hPa' });
  });
});
