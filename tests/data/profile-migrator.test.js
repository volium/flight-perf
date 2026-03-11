import { describe, it, expect } from 'vitest';
import { migrateV1toV2, isV1Profile, isV2Profile } from '@/data/profile-migrator.js';

// ─── v1 profile fixture (mirrors actual sling-lsa.json structure) ───────────

function v1SlingProfile() {
  return {
    profileVersion: '1.0',
    aircraft: {
      id: 'sling-lsa',
      name: 'Sling LSA',
      tailNumber: 'N246LT',
      manufacturer: 'Sling Aircraft',
      type: 'single-engine-land',
      category: 'light-sport',
      engine: 'Rotax 912 iS',
    },
    limits: {
      maxTakeoffWeight: { value: 600, unit: 'kg', valueLbs: 1320 },
      maxLandingWeight: { value: 600, unit: 'kg', valueLbs: 1320 },
      emptyWeight: { value: 370, unit: 'kg' },
      usefulLoad: { value: 230, unit: 'kg' },
      baggageMaxWeight: { value: 15, unit: 'kg' },
      maxCrosswind: { value: 15, unit: 'kt' },
    },
    fuel: {
      type: '100LL',
      inputUnit: 'us_gal',
      capacity: { value: 150, unit: 'L' },
      usableCapacity: { value: 146, unit: 'L' },
    },
    speeds: {
      vne: { value: 135, unit: 'kias' },
      vs0: { value: 40, unit: 'kias' },
      vy: { value: 72, unit: 'kias' },
    },
    weightBalance: {
      cgReference: 'percent_mac',
      cgUnit: '%',
      weightUnit: 'kg',
      armUnit: 'mm',
      macLeadingEdge: { value: 1366, unit: 'mm' },
      macLength: { value: 1339, unit: 'mm' },
      emptyCG: { value: 23.2, unit: 'percent_mac' },
      stations: [
        { id: 'pilot', name: 'Pilot', arm: { value: 1959, unit: 'mm' } },
        { id: 'fuel', name: 'Fuel', arm: { value: 1511, unit: 'mm' }, fuelStation: true },
      ],
      envelopes: [{
        id: 'normal', name: 'Normal', color: '#22c55e',
        points: [
          { weight: 350, cg: 20 }, { weight: 350, cg: 33 },
          { weight: 600, cg: 33 }, { weight: 600, cg: 20 },
        ],
      }],
    },
    performance: {
      climb: {
        method: 'table_interpolation',
        data: [
          { pressureAltitude: { value: 0, unit: 'ft' }, rateOfClimb: { value: 800, unit: 'fpm' } },
          { pressureAltitude: { value: 9000, unit: 'ft' }, rateOfClimb: { value: 400, unit: 'fpm' } },
        ],
      },
    },
  };
}

// ─── isV1Profile / isV2Profile ──────────────────────────────────────────────

describe('isV1Profile', () => {
  it('returns true for v1 profile', () => {
    expect(isV1Profile(v1SlingProfile())).toBe(true);
  });

  it('returns false for v2 profile', () => {
    expect(isV1Profile({ schemaVersion: '2.0' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isV1Profile(null)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isV1Profile('string')).toBe(false);
  });

  it('returns false when both profileVersion and schemaVersion present', () => {
    expect(isV1Profile({ profileVersion: '1.0', schemaVersion: '2.0' })).toBe(false);
  });
});

describe('isV2Profile', () => {
  it('returns true for v2 profile', () => {
    expect(isV2Profile({ schemaVersion: '2.0' })).toBe(true);
  });

  it('returns false for v1 profile', () => {
    expect(isV2Profile(v1SlingProfile())).toBe(false);
  });

  it('returns false for null', () => {
    expect(isV2Profile(null)).toBe(false);
  });
});

// ─── migrateV1toV2 — type profile output ───────────────────────────────────

describe('migrateV1toV2 — type profile', () => {
  it('sets schemaVersion to 2.0 and removes profileVersion', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.schemaVersion).toBe('2.0');
    expect(type.profileVersion).toBeUndefined();
  });

  it('sets typeId from aircraft.id', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.typeId).toBe('sling-lsa');
  });

  it('sets source to "custom" by default', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.source).toBe('custom');
  });

  it('sets source from options', () => {
    const { type } = migrateV1toV2(v1SlingProfile(), { source: 'bundled' });
    expect(type.source).toBe('bundled');
  });

  it('removes tailNumber from aircraft', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.aircraft.tailNumber).toBeUndefined();
  });

  it('preserves aircraft name and manufacturer', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.aircraft.name).toBe('Sling LSA');
    expect(type.aircraft.manufacturer).toBe('Sling Aircraft');
  });

  it('renames limits.emptyWeight to limits.referenceEmptyWeight', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.limits.referenceEmptyWeight).toEqual({ value: 370, unit: 'kg' });
    expect(type.limits.emptyWeight).toBeUndefined();
  });

  it('removes limits.usefulLoad', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.limits.usefulLoad).toBeUndefined();
  });

  it('moves weightBalance.emptyCG to limits.referenceEmptyCG', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.limits.referenceEmptyCG).toEqual({ value: 23.2, unit: 'percent_mac' });
    expect(type.weightBalance.emptyCG).toBeUndefined();
  });

  it('preserves all other limits fields', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.limits.maxTakeoffWeight.value).toBe(600);
    expect(type.limits.maxLandingWeight.value).toBe(600);
    expect(type.limits.baggageMaxWeight.value).toBe(15);
    expect(type.limits.maxCrosswind.value).toBe(15);
  });

  it('preserves fuel section unchanged', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.fuel.type).toBe('100LL');
    expect(type.fuel.capacity.value).toBe(150);
  });

  it('preserves speeds section unchanged', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.speeds.vne.value).toBe(135);
    expect(type.speeds.vy.value).toBe(72);
  });

  it('preserves weightBalance structure (minus emptyCG)', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.weightBalance.cgReference).toBe('percent_mac');
    expect(type.weightBalance.macLeadingEdge.value).toBe(1366);
    expect(type.weightBalance.stations.length).toBe(2);
    expect(type.weightBalance.envelopes.length).toBe(1);
  });

  it('preserves performance section unchanged', () => {
    const { type } = migrateV1toV2(v1SlingProfile());
    expect(type.performance.climb.method).toBe('table_interpolation');
    expect(type.performance.climb.data.length).toBe(2);
  });
});

// ─── migrateV1toV2 — instance output ───────────────────────────────────────

describe('migrateV1toV2 — instance', () => {
  it('creates instance with registration from tailNumber', () => {
    const { instance } = migrateV1toV2(v1SlingProfile());
    expect(instance).not.toBeNull();
    expect(instance.registration).toBe('N246LT');
  });

  it('sets instanceId (non-empty string)', () => {
    const { instance } = migrateV1toV2(v1SlingProfile());
    expect(typeof instance.instanceId).toBe('string');
    expect(instance.instanceId.length).toBeGreaterThan(0);
  });

  it('sets typeId matching type profile', () => {
    const { type, instance } = migrateV1toV2(v1SlingProfile());
    expect(instance.typeId).toBe(type.typeId);
    expect(instance.typeId).toBe('sling-lsa');
  });

  it('sets displayName to registration', () => {
    const { instance } = migrateV1toV2(v1SlingProfile());
    expect(instance.displayName).toBe('N246LT');
  });

  it('copies emptyWeight from type referenceEmptyWeight', () => {
    const { instance } = migrateV1toV2(v1SlingProfile());
    expect(instance.emptyWeight).toEqual({ value: 370, unit: 'kg' });
  });

  it('copies emptyCG from type referenceEmptyCG', () => {
    const { instance } = migrateV1toV2(v1SlingProfile());
    expect(instance.emptyCG).toEqual({ value: 23.2, unit: 'percent_mac' });
  });

  it('sets migration note', () => {
    const { instance } = migrateV1toV2(v1SlingProfile());
    expect(instance.notes).toContain('Migrated');
  });

  it('sets timestamps', () => {
    const { instance } = migrateV1toV2(v1SlingProfile());
    expect(instance.createdAt).toBeDefined();
    expect(instance.updatedAt).toBeDefined();
  });

  it('returns null instance when v1 profile has no tailNumber', () => {
    const v1 = v1SlingProfile();
    delete v1.aircraft.tailNumber;
    const { instance } = migrateV1toV2(v1);
    expect(instance).toBeNull();
  });
});

// ─── Deep clone isolation ───────────────────────────────────────────────────

describe('migrateV1toV2 — isolation', () => {
  it('does not mutate the original v1 profile', () => {
    const v1 = v1SlingProfile();
    migrateV1toV2(v1);
    expect(v1.profileVersion).toBe('1.0');
    expect(v1.aircraft.tailNumber).toBe('N246LT');
    expect(v1.limits.emptyWeight).toBeDefined();
    expect(v1.limits.usefulLoad).toBeDefined();
    expect(v1.weightBalance.emptyCG).toBeDefined();
  });

  it('generates unique instanceIds', () => {
    const { instance: i1 } = migrateV1toV2(v1SlingProfile());
    const { instance: i2 } = migrateV1toV2(v1SlingProfile());
    expect(i1.instanceId).not.toBe(i2.instanceId);
  });
});

// ─── Error handling ─────────────────────────────────────────────────────────

describe('migrateV1toV2 — errors', () => {
  it('throws on null input', () => {
    expect(() => migrateV1toV2(null)).toThrow();
  });

  it('throws on non-object input', () => {
    expect(() => migrateV1toV2('string')).toThrow();
  });

  it('handles profile without weightBalance gracefully', () => {
    const v1 = v1SlingProfile();
    delete v1.weightBalance;
    const { type } = migrateV1toV2(v1);
    expect(type.schemaVersion).toBe('2.0');
    expect(type.limits.referenceEmptyCG).toBeUndefined();
  });

  it('handles profile without limits gracefully', () => {
    const v1 = v1SlingProfile();
    delete v1.limits;
    const { type, instance } = migrateV1toV2(v1);
    expect(type.schemaVersion).toBe('2.0');
    expect(instance.emptyWeight).toBeNull();
  });
});
