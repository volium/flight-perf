import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateTypeProfile } from '@/data/profile-validator.js';
import { mergeProfile } from '@/data/profile-merger.js';
import { migrateV1toV2, isV1Profile, isV2Profile } from '@/data/profile-migrator.js';
import { calculateClimb } from '@/calc/climb.js';
import { calculateTakeoff } from '@/calc/takeoff.js';
import { calculateCruise } from '@/calc/cruise.js';
import { calculateWeightBalance } from '@/calc/weight-balance.js';

const profilesDir = resolve(import.meta.dirname, '../../profiles');

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ─── v2 bundled profile validation ──────────────────────────────────────────

describe('Sling LSA v2 type profile', () => {
  const v2Profile = loadJSON(resolve(profilesDir, 'types/sling-lsa.json'));

  it('is detected as v2 format', () => {
    expect(isV2Profile(v2Profile)).toBe(true);
    expect(isV1Profile(v2Profile)).toBe(false);
  });

  it('passes v2 validation with no errors', () => {
    const result = validateTypeProfile(v2Profile);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('has correct schemaVersion and typeId', () => {
    expect(v2Profile.schemaVersion).toBe('2.0');
    expect(v2Profile.typeId).toBe('sling-lsa');
    expect(v2Profile.source).toBe('bundled');
  });

  it('has referenceEmptyWeight (not v1 emptyWeight)', () => {
    expect(v2Profile.limits.referenceEmptyWeight).toEqual({ value: 370, unit: 'kg' });
    expect(v2Profile.limits.emptyWeight).toBeUndefined();
  });

  it('has no referenceEmptyCG (POH does not specify standard CG)', () => {
    expect(v2Profile.limits.referenceEmptyCG).toEqual({ value: 23.2, unit: 'percent_mac' });
    expect(v2Profile.weightBalance.emptyCG).toBeUndefined();
  });

  it('has no usefulLoad (computed at runtime)', () => {
    expect(v2Profile.limits.usefulLoad).toBeUndefined();
  });

  it('has no tailNumber (moved to instance)', () => {
    expect(v2Profile.aircraft.tailNumber).toBeUndefined();
  });
});

// ─── v1 bundled profile migration ───────────────────────────────────────────

describe('Sling LSA v1 → v2 migration', () => {
  const v1Profile = loadJSON(resolve(profilesDir, 'sling-lsa.json'));

  it('v1 profile is detected as v1', () => {
    expect(isV1Profile(v1Profile)).toBe(true);
  });

  it('migrated type passes v2 validation', () => {
    const { type } = migrateV1toV2(v1Profile, { source: 'bundled' });
    const result = validateTypeProfile(type);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('migrated instance has correct registration', () => {
    const { instance } = migrateV1toV2(v1Profile);
    expect(instance.registration).toBe('N246LT');
    expect(instance.typeId).toBe('sling-lsa');
  });
});

// ─── Merged profile compatibility with calc modules ─────────────────────────

describe('Sling LSA v2 merged profile — calc module compatibility', () => {
  const v2Profile = loadJSON(resolve(profilesDir, 'types/sling-lsa.json'));
  const instance = {
    instanceId: 'test-inst',
    typeId: 'sling-lsa',
    registration: 'N246LT',
    emptyWeight: { value: 384, unit: 'kg' },
    emptyCG: { value: 23.6, unit: 'percent_mac' },
  };

  const merged = mergeProfile(v2Profile, instance);

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

describe('Sling LSA v2 merged profile — no instance', () => {
  const v2Profile = loadJSON(resolve(profilesDir, 'types/sling-lsa.json'));
  const merged = mergeProfile(v2Profile, null);

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
