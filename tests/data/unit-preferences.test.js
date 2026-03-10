import { describe, it, expect } from 'vitest';
import { convertValue } from '@/data/unit-preferences.js';

// ─── convertValue ───────────────────────────────────────────────────────────

describe('convertValue — altitude/distance', () => {
  it('converts ft to m with smart rounding (5000 ft → 1525 m)', () => {
    // 5000 * 0.3048 = 1524 → smart round (abs≥500, <2000: nearest 25) → 1525
    const r = convertValue(5000, 'ft', 'm', 'altitude');
    expect(r).toBe('1525');
  });

  it('converts m to ft with smart rounding (1524 m → 5000 ft)', () => {
    // 1524 * 3.28084 = 4999.6 → smart round (abs≥2000: nearest 100) → 5000
    const r = convertValue(1524, 'm', 'ft', 'altitude');
    expect(r).toBe('5000');
  });

  it('converts small altitude (100 ft → 30 m, nearest 5)', () => {
    // 100 * 0.3048 = 30.48 → smart round (abs<100: nearest 5) → 30
    const r = convertValue(100, 'ft', 'm', 'altitude');
    expect(r).toBe('30');
  });

  it('converts medium altitude (1000 ft → 305 m, nearest 5)', () => {
    // 1000 * 0.3048 = 304.8 → smart round (100≤abs<500: nearest 10) → 300
    const r = convertValue(1000, 'ft', 'm', 'altitude');
    expect(r).toBe('300');
  });

  it('converts large altitude (10000 ft → m)', () => {
    // 10000 * 0.3048 = 3048 → smart round (abs≥2000: nearest 50) → 3050
    const r = convertValue(10000, 'ft', 'm', 'altitude');
    expect(r).toBe('3050');
  });

  it('same unit returns original value', () => {
    expect(convertValue('5000', 'ft', 'ft', 'altitude')).toBe('5000');
  });

  it('works for distance type too', () => {
    const r = convertValue(1000, 'ft', 'm', 'distance');
    expect(Number(r)).toBeGreaterThan(0);
  });
});

describe('convertValue — altimeter', () => {
  it('converts inHg to hPa (29.92 → ~1013.2)', () => {
    const r = convertValue(29.92, 'inHg', 'hPa', 'altimeter');
    expect(Number(r)).toBeCloseTo(1013.2, 0);
  });

  it('converts hPa to inHg (1013 → ~29.92)', () => {
    const r = convertValue(1013, 'hPa', 'inHg', 'altimeter');
    expect(Number(r)).toBeCloseTo(29.91, 1);
  });

  it('inHg result has 2 decimal places', () => {
    const r = convertValue(1013.25, 'hPa', 'inHg', 'altimeter');
    const parts = r.split('.');
    expect(parts.length).toBe(2);
    expect(parts[1].length).toBeLessThanOrEqual(2);
  });
});

describe('convertValue — temperature', () => {
  it('converts C to F (15 → 59)', () => {
    expect(convertValue(15, 'C', 'F', 'temperature')).toBe('59');
  });

  it('converts F to C (59 → 15)', () => {
    expect(convertValue(59, 'F', 'C', 'temperature')).toBe('15');
  });

  it('converts 0°C to 32°F', () => {
    expect(convertValue(0, 'C', 'F', 'temperature')).toBe('32');
  });

  it('rounds to nearest whole number', () => {
    // 20°C → 68°F (exact)
    expect(convertValue(20, 'C', 'F', 'temperature')).toBe('68');
  });
});

describe('convertValue — weight', () => {
  it('converts kg to lbs (80 kg → ~176 lbs)', () => {
    expect(convertValue(80, 'kg', 'lbs', 'weight')).toBe('176');
  });

  it('converts lbs to kg (176 lbs → ~80 kg)', () => {
    expect(convertValue(176, 'lbs', 'kg', 'weight')).toBe('80');
  });
});

describe('convertValue — fuel', () => {
  it('converts gal to L (26 gal → ~98 L)', () => {
    const r = convertValue(26, 'us_gal', 'L', 'fuel');
    expect(r).toBe('98'); // 26 * 3.7854 = 98.4 → round to 98
  });

  it('converts L to gal (98 L → ~25.9 gal → rounds to 26)', () => {
    const r = convertValue(98, 'L', 'us_gal', 'fuel');
    // 98 * 0.264172 = 25.89 → round to nearest 0.5 → 26
    expect(r).toBe('26');
  });

  it('gal rounds to nearest 0.5', () => {
    // 50 L → 13.2 gal → nearest 0.5 → 13
    const r = convertValue(50, 'L', 'us_gal', 'fuel');
    expect(Number(r) % 0.5).toBe(0);
  });
});

describe('convertValue — edge cases', () => {
  it('returns empty string for empty value', () => {
    expect(convertValue('', 'ft', 'm', 'altitude')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(convertValue(null, 'ft', 'm', 'altitude')).toBe('');
  });

  it('returns empty string for NaN string', () => {
    expect(convertValue('abc', 'ft', 'm', 'altitude')).toBe('');
  });

  it('returns original value for same units', () => {
    expect(convertValue('42', 'ft', 'ft', 'altitude')).toBe('42');
  });

  it('returns original value for unknown type', () => {
    expect(convertValue('42', 'ft', 'm', 'unknown')).toBe('42');
  });
});
