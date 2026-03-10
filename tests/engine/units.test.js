import { describe, it, expect } from 'vitest';
import { convert, formatNumber } from '@/engine/units.js';

// ─── Weight conversions ────────────────────────────────────────────────────

describe('weight conversions', () => {
  it('converts kg to lbs (1 kg ≈ 2.205 lbs)', () => {
    expect(convert.kgToLbs(1)).toBeCloseTo(2.20462, 4);
  });

  it('converts lbs to kg (1 lb ≈ 0.4536 kg)', () => {
    expect(convert.lbsToKg(1)).toBeCloseTo(0.45359, 4);
  });

  it('round-trips kg → lbs → kg', () => {
    const original = 384; // Sling LSA empty weight
    const roundTrip = convert.lbsToKg(convert.kgToLbs(original));
    expect(roundTrip).toBeCloseTo(original, 6);
  });

  it('converts Sling LSA empty weight (384 kg → ~846.6 lbs)', () => {
    expect(convert.kgToLbs(384)).toBeCloseTo(846.6, 0);
  });

  it('converts Sling LSA MTOW (600 kg → ~1322.8 lbs)', () => {
    expect(convert.kgToLbs(600)).toBeCloseTo(1322.8, 0);
  });
});

// ─── Distance conversions ──────────────────────────────────────────────────

describe('distance conversions', () => {
  it('converts m to ft (1 m = 3.28084 ft)', () => {
    expect(convert.mToFt(1)).toBeCloseTo(3.28084, 4);
  });

  it('converts ft to m (1 ft = 0.3048 m)', () => {
    expect(convert.ftToM(1)).toBeCloseTo(0.3048, 4);
  });

  it('round-trips ft → m → ft', () => {
    const original = 5000;
    const roundTrip = convert.mToFt(convert.ftToM(original));
    expect(roundTrip).toBeCloseTo(original, 3);
  });

  it('converts Sling TO ground roll (120 m → ~394 ft)', () => {
    expect(convert.mToFt(120)).toBeCloseTo(393.7, 0);
  });
});

// ─── mm/in conversions ─────────────────────────────────────────────────────

describe('mm/in conversions', () => {
  it('converts mm to in (25.4 mm = 1 in)', () => {
    expect(convert.mmToIn(25.4)).toBeCloseTo(1, 6);
  });

  it('converts in to mm (1 in = 25.4 mm)', () => {
    expect(convert.inToMm(1)).toBe(25.4);
  });
});

// ─── Volume conversions ────────────────────────────────────────────────────

describe('volume conversions', () => {
  it('converts L to US gal (1 L ≈ 0.2642 gal)', () => {
    expect(convert.lToUSGal(1)).toBeCloseTo(0.2642, 3);
  });

  it('converts US gal to L (1 gal ≈ 3.7854 L)', () => {
    expect(convert.usGalToL(1)).toBeCloseTo(3.7854, 3);
  });

  it('round-trips L → gal → L', () => {
    const original = 150; // Sling LSA fuel capacity
    const roundTrip = convert.usGalToL(convert.lToUSGal(original));
    expect(roundTrip).toBeCloseTo(original, 6);
  });

  it('converts Sling fuel capacity (150 L → ~39.6 gal)', () => {
    expect(convert.lToUSGal(150)).toBeCloseTo(39.6, 0);
  });
});

// ─── Speed conversions ─────────────────────────────────────────────────────

describe('speed conversions', () => {
  it('converts kt to km/h (1 kt = 1.852 km/h)', () => {
    expect(convert.ktToKmh(1)).toBeCloseTo(1.852, 3);
  });

  it('converts km/h to kt (1 km/h ≈ 0.5400 kt)', () => {
    expect(convert.kmhToKt(1)).toBeCloseTo(0.5400, 3);
  });

  it('converts Sling cruise TAS 104 kt → ~192.6 km/h', () => {
    expect(convert.ktToKmh(104)).toBeCloseTo(192.6, 0);
  });
});

// ─── Navigation distance ───────────────────────────────────────────────────

describe('navigation distance conversions', () => {
  it('converts nm to km (1 nm = 1.852 km)', () => {
    expect(convert.nmToKm(1)).toBeCloseTo(1.852, 3);
  });

  it('converts km to nm', () => {
    expect(convert.kmToNm(1.852)).toBeCloseTo(1, 2);
  });
});

// ─── Temperature conversions ───────────────────────────────────────────────

describe('temperature conversions', () => {
  it('converts 0°C to 32°F', () => {
    expect(convert.cToF(0)).toBe(32);
  });

  it('converts 100°C to 212°F', () => {
    expect(convert.cToF(100)).toBe(212);
  });

  it('converts 15°C (ISA sea level) to 59°F', () => {
    expect(convert.cToF(15)).toBe(59);
  });

  it('converts 32°F to 0°C', () => {
    expect(convert.fToC(32)).toBe(0);
  });

  it('converts 212°F to 100°C', () => {
    expect(convert.fToC(212)).toBe(100);
  });

  it('round-trips °C → °F → °C', () => {
    const original = 15;
    const roundTrip = convert.fToC(convert.cToF(original));
    expect(roundTrip).toBeCloseTo(original, 10);
  });

  it('handles negative temperatures (-40°C = -40°F)', () => {
    expect(convert.cToF(-40)).toBe(-40);
    expect(convert.fToC(-40)).toBe(-40);
  });
});

// ─── Pressure conversions ──────────────────────────────────────────────────

describe('pressure conversions', () => {
  it('converts standard pressure 29.92 inHg → ~1013.25 hPa', () => {
    expect(convert.inHgToHPa(29.92)).toBeCloseTo(1013.25, 0);
  });

  it('converts 1013.25 hPa → ~29.92 inHg', () => {
    expect(convert.hPaToInHg(1013.25)).toBeCloseTo(29.92, 1);
  });

  it('round-trips inHg → hPa → inHg', () => {
    const original = 29.92;
    const roundTrip = convert.hPaToInHg(convert.inHgToHPa(original));
    expect(roundTrip).toBeCloseTo(original, 6);
  });
});

// ─── formatNumber ──────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('returns em-dash for null', () => {
    expect(formatNumber(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatNumber(undefined)).toBe('—');
  });

  it('returns em-dash for NaN', () => {
    expect(formatNumber(NaN)).toBe('—');
  });

  it('formats integer with no decimals', () => {
    const result = formatNumber(1234);
    // Locale-dependent, but should contain "1234" or "1,234"
    expect(result).toMatch(/1[,.]?234/);
  });

  it('formats with specified decimal places', () => {
    const result = formatNumber(3.14159, 2);
    expect(result).toMatch(/3[.,]14/);
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});
