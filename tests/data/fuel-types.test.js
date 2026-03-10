import { describe, it, expect } from 'vitest';
import { getFuelType, getAllFuelTypes, fuelVolumeToWeight } from '@/data/fuel-types.js';

// ─── getFuelType ────────────────────────────────────────────────────────────

describe('getFuelType', () => {
  it('returns 100LL with correct densities', () => {
    const f = getFuelType('100LL');
    expect(f).not.toBeNull();
    expect(f.id).toBe('100LL');
    expect(f.densityKgPerL).toBe(0.721);
    expect(f.densityLbsPerGal).toBe(6.02);
  });

  it('returns MOGAS with correct densities', () => {
    const f = getFuelType('MOGAS');
    expect(f.densityKgPerL).toBe(0.74);
    expect(f.densityLbsPerGal).toBe(6.18);
  });

  it('returns JET_A with correct densities', () => {
    const f = getFuelType('JET_A');
    expect(f.densityKgPerL).toBe(0.804);
    expect(f.densityLbsPerGal).toBe(6.71);
  });

  it('returns null for unknown fuel type', () => {
    expect(getFuelType('UNKNOWN')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getFuelType('')).toBeNull();
  });
});

// ─── getAllFuelTypes ─────────────────────────────────────────────────────────

describe('getAllFuelTypes', () => {
  it('returns all 6 built-in fuel types', () => {
    const all = getAllFuelTypes();
    expect(all.length).toBe(6);
  });

  it('includes 100LL in the list', () => {
    const all = getAllFuelTypes();
    expect(all.some((f) => f.id === '100LL')).toBe(true);
  });
});

// ─── fuelVolumeToWeight ─────────────────────────────────────────────────────

describe('fuelVolumeToWeight', () => {
  it('converts litres to kg (100LL: 10L × 0.721 = 7.21 kg)', () => {
    const r = fuelVolumeToWeight(10, 'L', '100LL');
    expect(r.value).toBeCloseTo(7.21, 2);
    expect(r.unit).toBe('kg');
  });

  it('converts US gallons to lbs (100LL: 10 gal × 6.02 = 60.2 lbs)', () => {
    const r = fuelVolumeToWeight(10, 'us_gal', '100LL');
    expect(r.value).toBeCloseTo(60.2, 1);
    expect(r.unit).toBe('lbs');
  });

  it('passes through kg directly', () => {
    const r = fuelVolumeToWeight(50, 'kg', '100LL');
    expect(r.value).toBe(50);
    expect(r.unit).toBe('kg');
  });

  it('passes through lbs directly', () => {
    const r = fuelVolumeToWeight(100, 'lbs', '100LL');
    expect(r.value).toBe(100);
    expect(r.unit).toBe('lbs');
  });

  it('uses override density when provided', () => {
    const r = fuelVolumeToWeight(10, 'L', '100LL', { kgPerL: 0.75 });
    expect(r.value).toBeCloseTo(7.5, 2);
  });

  it('returns null for unknown fuel type without override', () => {
    const r = fuelVolumeToWeight(10, 'L', 'UNKNOWN');
    expect(r).toBeNull();
  });

  it('returns null for unsupported unit', () => {
    const r = fuelVolumeToWeight(10, 'imp_gal', '100LL');
    expect(r).toBeNull();
  });
});
