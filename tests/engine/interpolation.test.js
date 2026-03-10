import { describe, it, expect } from 'vitest';
import { interpolate1D, interpolateFromTable, interpolate2D } from '@/engine/interpolation.js';

// ─── interpolate1D ──────────────────────────────────────────────────────────

describe('interpolate1D', () => {
  it('returns NaN for empty arrays', () => {
    const r = interpolate1D([], [], 5);
    expect(r.value).toBeNaN();
    expect(r.clamped).toBe(false);
  });

  it('returns NaN for mismatched array lengths', () => {
    const r = interpolate1D([1, 2], [10], 1.5);
    expect(r.value).toBeNaN();
  });

  it('returns the only value for a single-point array', () => {
    const r = interpolate1D([5], [100], 5);
    expect(r.value).toBe(100);
    expect(r.clamped).toBe(false);
    expect(r.extrapolated).toBe(false);
  });

  it('returns the only value for single-point even when x differs', () => {
    const r = interpolate1D([5], [100], 99);
    expect(r.value).toBe(100);
  });

  it('returns exact value at first endpoint', () => {
    const r = interpolate1D([0, 10], [100, 200], 0);
    expect(r.value).toBe(100);
    expect(r.clamped).toBe(false);
    expect(r.clampedTo).toBeNull();
  });

  it('returns exact value at last endpoint', () => {
    const r = interpolate1D([0, 10], [100, 200], 10);
    expect(r.value).toBe(200);
    expect(r.clamped).toBe(false);
  });

  it('interpolates at midpoint', () => {
    const r = interpolate1D([0, 10], [100, 200], 5);
    expect(r.value).toBe(150);
    expect(r.clamped).toBe(false);
  });

  it('interpolates at 25% position', () => {
    const r = interpolate1D([0, 100], [0, 400], 25);
    expect(r.value).toBe(100);
  });

  it('interpolates across multiple segments', () => {
    // Sling LSA climb: ROC vs pressure altitude
    const xs = [0, 3000, 6000, 9000];
    const ys = [800, 600, 500, 400];

    // At 1500 ft → midpoint between 0 and 3000 → (800+600)/2 = 700
    const r = interpolate1D(xs, ys, 1500);
    expect(r.value).toBe(700);

    // At 4500 ft → midpoint between 3000 and 6000 → (600+500)/2 = 550
    const r2 = interpolate1D(xs, ys, 4500);
    expect(r2.value).toBe(550);
  });

  it('clamps below minimum', () => {
    const r = interpolate1D([0, 10], [100, 200], -5);
    expect(r.value).toBe(100);
    expect(r.clamped).toBe(true);
    expect(r.clampedTo).toBe('min');
  });

  it('clamps above maximum', () => {
    const r = interpolate1D([0, 10], [100, 200], 15);
    expect(r.value).toBe(200);
    expect(r.clamped).toBe(true);
    expect(r.clampedTo).toBe('max');
  });

  it('extrapolates below minimum when enabled', () => {
    const r = interpolate1D([0, 10], [100, 200], -5, { extrapolate: true });
    expect(r.value).toBe(50); // 100 + (-5/10) * 100 = 50
    expect(r.clamped).toBe(false);
    expect(r.extrapolated).toBe(true);
  });

  it('extrapolates above maximum when enabled', () => {
    const r = interpolate1D([0, 10], [100, 200], 15, { extrapolate: true });
    expect(r.value).toBe(250); // 100 + (15/10) * 100 = 250
    expect(r.extrapolated).toBe(true);
  });

  it('handles duplicate x values', () => {
    const r = interpolate1D([5, 5], [100, 200], 5);
    // x1 === x0, should return y0
    expect(r.value).toBe(100);
  });

  it('handles decreasing y values', () => {
    // ROC decreases with altitude
    const r = interpolate1D([0, 9000], [800, 400], 4500);
    expect(r.value).toBe(600);
  });
});

// ─── interpolateFromTable ───────────────────────────────────────────────────

describe('interpolateFromTable', () => {
  const climbData = [
    { pressureAltitude: { value: 0, unit: 'ft' }, rateOfClimb: { value: 800, unit: 'fpm' }, bestClimbSpeed: { value: 72, unit: 'kias' } },
    { pressureAltitude: { value: 3000, unit: 'ft' }, rateOfClimb: { value: 600, unit: 'fpm' }, bestClimbSpeed: { value: 72, unit: 'kias' } },
    { pressureAltitude: { value: 6000, unit: 'ft' }, rateOfClimb: { value: 500, unit: 'fpm' }, bestClimbSpeed: { value: 72, unit: 'kias' } },
    { pressureAltitude: { value: 9000, unit: 'ft' }, rateOfClimb: { value: 400, unit: 'fpm' }, bestClimbSpeed: { value: 72, unit: 'kias' } },
  ];

  it('returns exact value at a data point (Sling ROC at sea level = 800 fpm)', () => {
    const r = interpolateFromTable(climbData, 'pressureAltitude', 'rateOfClimb', 0);
    expect(r.value).toBe(800);
  });

  it('returns exact value at max data point (ROC at 9000 ft = 400 fpm)', () => {
    const r = interpolateFromTable(climbData, 'pressureAltitude', 'rateOfClimb', 9000);
    expect(r.value).toBe(400);
  });

  it('interpolates between data points (ROC at 1500 ft = 700 fpm)', () => {
    const r = interpolateFromTable(climbData, 'pressureAltitude', 'rateOfClimb', 1500);
    expect(r.value).toBe(700);
  });

  it('handles unsorted data by sorting first', () => {
    const shuffled = [climbData[2], climbData[0], climbData[3], climbData[1]];
    const r = interpolateFromTable(shuffled, 'pressureAltitude', 'rateOfClimb', 1500);
    expect(r.value).toBe(700);
  });

  it('accepts a custom accessor', () => {
    const plainData = [
      { alt: 0, roc: 800 },
      { alt: 9000, roc: 400 },
    ];
    const accessor = (obj) => obj;
    const r = interpolateFromTable(plainData, 'alt', 'roc', 4500, accessor);
    expect(r.value).toBe(600);
  });

  it('clamps below table range', () => {
    const r = interpolateFromTable(climbData, 'pressureAltitude', 'rateOfClimb', -1000);
    expect(r.value).toBe(800);
    expect(r.clamped).toBe(true);
  });

  it('extrapolates above table range when enabled', () => {
    const r = interpolateFromTable(
      climbData, 'pressureAltitude', 'rateOfClimb', 12000,
      null, { extrapolate: true },
    );
    // Between 6000→500 and 9000→400: slope = -100/3000 = -1/30 per ft
    // At 12000: 400 + (12000-9000) * (-100/3000) = 400 - 100 = 300
    expect(r.value).toBeCloseTo(300, 0);
    expect(r.extrapolated).toBe(true);
  });
});

// ─── interpolate2D ──────────────────────────────────────────────────────────

describe('interpolate2D', () => {
  // Sling LSA cruise table subset
  const cruiseData = [
    { pressureAltitude: { value: 100, unit: 'ft' }, rpm: 4500, ktas: 82 },
    { pressureAltitude: { value: 100, unit: 'ft' }, rpm: 5000, ktas: 102 },
    { pressureAltitude: { value: 100, unit: 'ft' }, rpm: 5500, ktas: 114 },
    { pressureAltitude: { value: 3000, unit: 'ft' }, rpm: 4500, ktas: 76 },
    { pressureAltitude: { value: 3000, unit: 'ft' }, rpm: 5000, ktas: 104 },
    { pressureAltitude: { value: 3000, unit: 'ft' }, rpm: 5500, ktas: 114 },
    { pressureAltitude: { value: 6000, unit: 'ft' }, rpm: 4500, ktas: 73 },
    { pressureAltitude: { value: 6000, unit: 'ft' }, rpm: 5000, ktas: 100 },
    { pressureAltitude: { value: 6000, unit: 'ft' }, rpm: 5500, ktas: 115 },
  ];

  it('returns exact value at a grid point (3000 ft, 5000 RPM → 104 kt)', () => {
    const r = interpolate2D(cruiseData, 'pressureAltitude', 'rpm', 'ktas', 3000, 5000);
    expect(r.value).toBe(104);
  });

  it('returns exact value at corner (100 ft, 4500 RPM → 82 kt)', () => {
    const r = interpolate2D(cruiseData, 'pressureAltitude', 'rpm', 'ktas', 100, 4500);
    expect(r.value).toBe(82);
  });

  it('interpolates along RPM axis at fixed altitude', () => {
    // At 3000 ft, between 4500 RPM (76 kt) and 5000 RPM (104 kt), midpoint = 4750
    const r = interpolate2D(cruiseData, 'pressureAltitude', 'rpm', 'ktas', 3000, 4750);
    expect(r.value).toBe(90); // (76 + 104) / 2
  });

  it('interpolates along altitude axis at fixed RPM', () => {
    // At 5000 RPM, between 100 ft (102 kt) and 3000 ft (104 kt), midpoint = 1550
    const r = interpolate2D(cruiseData, 'pressureAltitude', 'rpm', 'ktas', 1550, 5000);
    expect(r.value).toBe(103); // (102 + 104) / 2
  });

  it('bilinear interpolation at interior point', () => {
    // 1550 ft (midpoint of 100–3000), 4750 RPM (midpoint of 4500–5000)
    // At alt=100: interp(4500→82, 5000→102) at 4750 = 92
    // At alt=3000: interp(4500→76, 5000→104) at 4750 = 90
    // Interp along alt at midpoint: (92 + 90) / 2 = 91
    const r = interpolate2D(cruiseData, 'pressureAltitude', 'rpm', 'ktas', 1550, 4750);
    expect(r.value).toBe(91);
  });

  it('clamps when both axes exceed range', () => {
    const r = interpolate2D(cruiseData, 'pressureAltitude', 'rpm', 'ktas', 10000, 6000);
    // Should clamp to max altitude (6000) and max RPM (5500) → 115
    expect(r.value).toBe(115);
    expect(r.clamped).toBe(true);
  });
});
