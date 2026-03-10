import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { closeDB, putType, putInstance } from '@/data/db.js';
import {
  resolveProfile,
  resolveDefaultProfile,
  seedTypesFromData,
  autoCreateDefaultInstance,
  validateProfile,
} from '@/data/profile-loader.js';

// ─── Test fixtures ──────────────────────────────────────────────────────────

function slingV2Type() {
  return {
    schemaVersion: '2.0',
    typeId: 'sling-lsa',
    source: 'bundled',
    aircraft: { id: 'sling-lsa', name: 'Sling LSA', manufacturer: 'Sling Aircraft' },
    limits: {
      maxTakeoffWeight: { value: 600, unit: 'kg' },
      maxLandingWeight: { value: 600, unit: 'kg' },
      referenceEmptyWeight: { value: 384, unit: 'kg' },
      referenceEmptyCG: { value: 23.6, unit: 'percent_mac' },
    },
    fuel: { type: '100LL', inputUnit: 'us_gal', capacity: { value: 150, unit: 'L' } },
    speeds: { vne: { value: 135, unit: 'kias' }, vs0: { value: 40, unit: 'kias' } },
    weightBalance: {
      cgReference: 'percent_mac',
      cgUnit: '%',
      weightUnit: 'kg',
      macLeadingEdge: { value: 1366, unit: 'mm' },
      macLength: { value: 1339, unit: 'mm' },
      stations: [
        { id: 'pilot', name: 'Pilot', arm: { value: 1959, unit: 'mm' } },
        { id: 'fuel', name: 'Fuel', arm: { value: 1511, unit: 'mm' }, fuelStation: true },
      ],
      envelopes: [{
        id: 'normal', name: 'Normal', color: '#22c55e',
        points: [{ weight: 384, cg: 20 }, { weight: 384, cg: 33 }, { weight: 600, cg: 33 }, { weight: 600, cg: 20 }],
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

function slingInstance() {
  return {
    instanceId: 'inst-sling-001',
    typeId: 'sling-lsa',
    registration: 'N246LT',
    displayName: 'N246LT',
    emptyWeight: { value: 386, unit: 'kg' },
    emptyCG: { value: 24.1, unit: 'percent_mac' },
    createdAt: '2026-03-10T00:00:00Z',
    updatedAt: '2026-03-10T00:00:00Z',
  };
}

// ─── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  closeDB();
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('flightperf');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

afterEach(() => {
  closeDB();
});

// ─── resolveProfile ─────────────────────────────────────────────────────────

describe('resolveProfile', () => {
  it('returns merged profile for valid instance + type', async () => {
    await putType(slingV2Type());
    await putInstance(slingInstance());

    const profile = await resolveProfile('inst-sling-001');
    expect(profile).not.toBeNull();
    expect(profile.aircraft.tailNumber).toBe('N246LT');
    expect(profile.limits.emptyWeight.value).toBe(386);
    expect(profile.weightBalance.emptyCG.value).toBe(24.1);
    expect(profile.limits.usefulLoad.value).toBe(214); // 600 - 386
  });

  it('returns null for nonexistent instance', async () => {
    const profile = await resolveProfile('nonexistent');
    expect(profile).toBeNull();
  });

  it('returns null when instance references missing type', async () => {
    await putInstance(slingInstance());
    // type not seeded
    const profile = await resolveProfile('inst-sling-001');
    expect(profile).toBeNull();
  });
});

// ─── resolveDefaultProfile ──────────────────────────────────────────────────

describe('resolveDefaultProfile', () => {
  it('returns merged profile using first bundled type defaults', async () => {
    await putType(slingV2Type());

    const profile = await resolveDefaultProfile();
    expect(profile).not.toBeNull();
    expect(profile.aircraft.tailNumber).toBeNull();
    expect(profile.limits.emptyWeight.value).toBe(384); // type reference
    expect(profile.aircraft.name).toBe('Sling LSA');
  });

  it('returns null when no types exist', async () => {
    const profile = await resolveDefaultProfile();
    expect(profile).toBeNull();
  });

  it('prefers bundled type over custom', async () => {
    const custom = { ...slingV2Type(), typeId: 'custom-1', source: 'custom', aircraft: { ...slingV2Type().aircraft, id: 'custom-1', name: 'Custom' } };
    const bundled = slingV2Type();
    await putType(custom);
    await putType(bundled);

    const profile = await resolveDefaultProfile();
    expect(profile.aircraft.name).toBe('Sling LSA');
  });
});

// ─── seedTypesFromData ──────────────────────────────────────────────────────

describe('seedTypesFromData', () => {
  it('seeds types into IDB from pre-loaded objects', async () => {
    await seedTypesFromData([slingV2Type()]);

    const profile = await resolveDefaultProfile();
    expect(profile).not.toBeNull();
    expect(profile.aircraft.name).toBe('Sling LSA');
  });

  it('skips profiles without typeId or aircraft.id', async () => {
    await seedTypesFromData([{ schemaVersion: '2.0' }]);
    const profile = await resolveDefaultProfile();
    expect(profile).toBeNull();
  });

  it('derives typeId from aircraft.id when typeId missing', async () => {
    const type = slingV2Type();
    delete type.typeId;
    await seedTypesFromData([type]);

    const profile = await resolveDefaultProfile();
    expect(profile).not.toBeNull();
  });
});

// ─── autoCreateDefaultInstance ──────────────────────────────────────────────

describe('autoCreateDefaultInstance', () => {
  it('creates instance from first bundled type', async () => {
    await putType(slingV2Type());

    const instance = await autoCreateDefaultInstance();
    expect(instance).not.toBeNull();
    expect(instance.typeId).toBe('sling-lsa');
    expect(instance.instanceId).toBeTruthy();
    expect(instance.emptyWeight.value).toBe(384);
    expect(instance.emptyCG.value).toBe(23.6);
  });

  it('creates instance from specific type', async () => {
    await putType(slingV2Type());

    const instance = await autoCreateDefaultInstance('sling-lsa');
    expect(instance.typeId).toBe('sling-lsa');
  });

  it('returns null when no types exist', async () => {
    const instance = await autoCreateDefaultInstance();
    expect(instance).toBeNull();
  });

  it('created instance can be resolved', async () => {
    await putType(slingV2Type());
    const instance = await autoCreateDefaultInstance();

    const profile = await resolveProfile(instance.instanceId);
    expect(profile).not.toBeNull();
    expect(profile.limits.emptyWeight.value).toBe(384);
  });
});

// ─── validateProfile (legacy compat) ────────────────────────────────────────

describe('validateProfile (legacy)', () => {
  it('validates v2 profile using new validator', () => {
    const result = validateProfile(slingV2Type());
    expect(result.valid).toBe(true);
  });

  it('validates v1 profile using legacy validator', () => {
    const v1 = {
      profileVersion: '1.0',
      aircraft: { id: 'test', name: 'Test' },
      limits: { maxTakeoffWeight: { value: 1000, unit: 'lbs' }, emptyWeight: { value: 600, unit: 'lbs' } },
    };
    const result = validateProfile(v1);
    expect(result.valid).toBe(true);
  });

  it('rejects v1 profile missing required fields', () => {
    const result = validateProfile({ profileVersion: '1.0' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
