import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateTypeProfile } from '@/data/profile-validator.js';
import { mergeProfile } from '@/data/profile-merger.js';
import { calculateClimb } from '@/calc/climb.js';
import { calculateTakeoff } from '@/calc/takeoff.js';
import { calculateCruise } from '@/calc/cruise.js';
import { calculateWeightBalance } from '@/calc/weight-balance.js';

const profilesDir = resolve(import.meta.dirname, '../../profiles');

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ─── Bundled profile validation ──────────────────────────────────────────

describe('Sling LSA type profile', () => {
  const profile = loadJSON(resolve(profilesDir, 'types/sling-lsa.json'));

  it('has correct schemaVersion', () => {
    expect(profile.schemaVersion).toBe('1.0');
  });

  it('passes validation with no errors', () => {
    const result = validateTypeProfile(profile);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('has correct schemaVersion and typeId', () => {
    expect(profile.schemaVersion).toBe('1.0');
    expect(profile.typeId).toBe('sling-lsa');
    expect(profile.source).toBe('bundled');
  });

  it('has referenceEmptyWeight', () => {
    expect(profile.limits.referenceEmptyWeight).toEqual({ value: 370, unit: 'kg' });
    expect(profile.limits.emptyWeight).toBeUndefined();
  });

  it('has referenceEmptyCG', () => {
    expect(profile.limits.referenceEmptyCG).toEqual({ value: 23.2, unit: 'percent_mac' });
    expect(profile.weightBalance.emptyCG).toBeUndefined();
  });

  it('has no usefulLoad (computed at runtime)', () => {
    expect(profile.limits.usefulLoad).toBeUndefined();
  });

  it('has no tailNumber (moved to instance)', () => {
    expect(profile.aircraft.tailNumber).toBeUndefined();
  });
});

// ─── Merged profile compatibility with calc modules ─────────────────────────

describe('Sling LSA merged profile — calc module compatibility', () => {
  const typeProfile = loadJSON(resolve(profilesDir, 'types/sling-lsa.json'));
  const instance = {
    instanceId: 'test-inst',
    typeId: 'sling-lsa',
    registration: 'N246LT',
    emptyWeight: { value: 384, unit: 'kg' },
    emptyCG: { value: 23.6, unit: 'percent_mac' },
  };

  const merged = mergeProfile(typeProfile, instance);

  it('merged profile has tailNumber', () => {
    expect(merged.aircraft.tailNumber).toBe('N246LT');
  });

  it('merged profile has limits.emptyWeight (for W&B calc)', () => {
    expect(merged.limits.emptyWeight.value).toBe(384);
    expect(merged.limits.emptyWeight.unit).toBe('kg');
  });

  it('merged profile has weightBalance.emptyCG (for W&B calc)', () => {
    expect(merged.weightBalance.emptyCG.value).toBe(23.6);
    expect(merged.weightBalance.emptyCG.unit).toBe('percent_mac');
  });

  it('merged profile has usefulLoad', () => {
    expect(merged.limits.usefulLoad.value).toBe(216); // 600 - 384 (instance weight)
    expect(merged.limits.usefulLoad.unit).toBe('kg');
  });

  it('takeoff calculator produces correct POH values', () => {
    const result = calculateTakeoff(merged, { surface: 'concrete_asphalt' });
    expect(result.groundRoll.raw).toBe(120);
    expect(result.totalOverObstacle.raw).toBe(230);
  });

  it('climb calculator produces correct POH values', () => {
    const result = calculateClimb(merged, { pressureAltitude: 0 });
    expect(result.rateOfClimb).toBe(800);
    expect(result.bestClimbSpeed).toBe(72);
  });

  it('cruise calculator produces correct POH values', () => {
    const result = calculateCruise(merged, {
      fieldElevation: 3000,
      altimeter: 29.92,
      rpm: 5000,
    });
    expect(result.kias).toBe(98);
    expect(result.ktas).toBe(104);
  });

  it('W&B calculator works with merged profile', () => {
    const result = calculateWeightBalance(merged, {
      stationWeights: { pilot: 80, passenger: 70, baggage_front: 5, baggage_rear: 5 },
      fuelQuantity: 20,
      displayWeightUnit: 'kg',
      displayFuelUnit: 'us_gal',
    });
    expect(result.emptyWeight).toBe(384);
    expect(result.totalWeight).toBeGreaterThan(384);
    expect(result.cgPercent).not.toBeNull();
    expect(result.withinAny).toBe(true);
    expect(result.overweight).toBe(false);
  });
});

// ─── Merged profile without instance (type defaults only) ───────────────────

describe('Sling LSA merged profile — no instance', () => {
  const typeProfile = loadJSON(resolve(profilesDir, 'types/sling-lsa.json'));
  const merged = mergeProfile(typeProfile, null);

  it('uses referenceEmptyWeight as emptyWeight', () => {
    expect(merged.limits.emptyWeight.value).toBe(370);
  });

  it('emptyCG falls back to referenceEmptyCG', () => {
    expect(merged.weightBalance.emptyCG.value).toBe(23.2);
  });

  it('usefulLoad computed from POH reference weight', () => {
    expect(merged.limits.usefulLoad.value).toBe(230); // 600 - 370
  });

  it('calculators still work with type defaults', () => {
    const result = calculateClimb(merged, { pressureAltitude: 3000 });
    expect(result.rateOfClimb).toBe(600);
  });
});
