import { describe, it, expect } from 'vitest';
import { mergeProfile } from '@/data/profile-merger.js';

// ─── Test fixtures ──────────────────────────────────────────────────────────

/** Type profile (Sling LSA style — %MAC CG) */
function slingType() {
  return {
    schemaVersion: '1.0',
    aircraft: {
      id: 'sling-lsa',
      name: 'Sling LSA',
      manufacturer: 'Sling Aircraft',
      type: 'single-engine-land',
      category: 'light-sport',
    },
    limits: {
      maxTakeoffWeight: { value: 600, unit: 'kg' },
      maxLandingWeight: { value: 600, unit: 'kg' },
      referenceEmptyWeight: { value: 384, unit: 'kg' },
      referenceEmptyCG: { value: 23.6, unit: 'percent_mac' },
    },
    fuel: {
      type: '100LL',
      inputUnit: 'us_gal',
      capacity: { value: 150, unit: 'L' },
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
      macLeadingEdge: { value: 1366, unit: 'mm' },
      macLength: { value: 1339, unit: 'mm' },
      stations: [
        { id: 'pilot', name: 'Pilot', arm: { value: 1959, unit: 'mm' } },
        { id: 'fuel', name: 'Fuel', arm: { value: 1511, unit: 'mm' }, fuelStation: true },
      ],
      envelopes: [{
        id: 'normal', name: 'Normal', color: '#22c55e',
        points: [
          { weight: 384, cg: 20 }, { weight: 384, cg: 33 },
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

/** Type profile (Cessna style — arm-based CG) */
function cessnaType() {
  return {
    schemaVersion: '1.0',
    aircraft: {
      id: 'cessna-172s',
      name: 'Cessna 172S Skyhawk SP',
      manufacturer: 'Cessna',
    },
    limits: {
      maxTakeoffWeight: { value: 2550, unit: 'lbs' },
      maxLandingWeight: { value: 2550, unit: 'lbs' },
      referenceEmptyWeight: { value: 1663, unit: 'lbs' },
      referenceEmptyCG: { arm: 40.5, unit: 'in' },
    },
    fuel: {
      type: '100LL',
      inputUnit: 'us_gal',
      capacity: { value: 56, unit: 'us_gal' },
    },
    speeds: {
      vne: { value: 163, unit: 'kias' },
      vs0: { value: 40, unit: 'kias' },
    },
    weightBalance: {
      cgReference: 'arm',
      cgUnit: 'in',
      weightUnit: 'lbs',
      stations: [
        { id: 'pilot', name: 'Pilot', arm: { value: 37, unit: 'in' } },
      ],
      envelopes: [{
        id: 'normal', name: 'Normal', color: '#22c55e',
        points: [
          { weight: 1500, cg: 35 }, { weight: 1500, cg: 47.3 },
          { weight: 2550, cg: 47.3 }, { weight: 2550, cg: 41 },
        ],
      }],
    },
  };
}

function slingInstance() {
  return {
    instanceId: 'inst-001',
    typeId: 'sling-lsa',
    registration: 'N246LT',
    emptyWeight: { value: 386, unit: 'kg' },
    emptyCG: { value: 24.1, unit: 'percent_mac' },
    lastWeighed: '2025-11-15',
    notes: 'Annual due 2026',
  };
}

function cessnaInstance() {
  return {
    instanceId: 'inst-002',
    typeId: 'cessna-172s',
    registration: 'N54321',
    emptyWeight: { value: 1680, unit: 'lbs' },
    emptyCG: { arm: 41.2, unit: 'in' },
  };
}

// ─── Core merge behavior ────────────────────────────────────────────────────

describe('mergeProfile — basic merge', () => {
  it('sets aircraft.tailNumber from instance registration', () => {
    const m = mergeProfile(slingType(), slingInstance());
    expect(m.aircraft.tailNumber).toBe('N246LT');
  });

  it('sets limits.emptyWeight from instance override', () => {
    const m = mergeProfile(slingType(), slingInstance());
    expect(m.limits.emptyWeight.value).toBe(386);
    expect(m.limits.emptyWeight.unit).toBe('kg');
  });

  it('sets weightBalance.emptyCG from instance override (%MAC)', () => {
    const m = mergeProfile(slingType(), slingInstance());
    expect(m.weightBalance.emptyCG.value).toBe(24.1);
    expect(m.weightBalance.emptyCG.unit).toBe('percent_mac');
  });

  it('sets weightBalance.emptyCG from instance override (arm)', () => {
    const m = mergeProfile(cessnaType(), cessnaInstance());
    expect(m.weightBalance.emptyCG.arm).toBe(41.2);
    expect(m.weightBalance.emptyCG.unit).toBe('in');
  });

  it('computes usefulLoad from MTOW - emptyWeight', () => {
    const m = mergeProfile(slingType(), slingInstance());
    // 600 - 386 = 214
    expect(m.limits.usefulLoad.value).toBe(214);
    expect(m.limits.usefulLoad.unit).toBe('kg');
  });

  it('computes usefulLoad for Cessna (2550 - 1680 = 870)', () => {
    const m = mergeProfile(cessnaType(), cessnaInstance());
    expect(m.limits.usefulLoad.value).toBe(870);
    expect(m.limits.usefulLoad.unit).toBe('lbs');
  });

  it('preserves all type profile data', () => {
    const m = mergeProfile(slingType(), slingInstance());
    expect(m.schemaVersion).toBe('1.0');
    expect(m.aircraft.name).toBe('Sling LSA');
    expect(m.aircraft.manufacturer).toBe('Sling Aircraft');
    expect(m.fuel.type).toBe('100LL');
    expect(m.speeds.vy.value).toBe(72);
    expect(m.weightBalance.cgReference).toBe('percent_mac');
    expect(m.weightBalance.stations.length).toBe(2);
    expect(m.weightBalance.envelopes.length).toBe(1);
    expect(m.performance.climb.data.length).toBe(2);
  });

  it('attaches instance metadata as _instance', () => {
    const m = mergeProfile(slingType(), slingInstance());
    expect(m._instance).not.toBeNull();
    expect(m._instance.instanceId).toBe('inst-001');
    expect(m._instance.registration).toBe('N246LT');
    expect(m._instance.lastWeighed).toBe('2025-11-15');
    expect(m._instance.notes).toBe('Annual due 2026');
  });
});

// ─── Fallback to type defaults ──────────────────────────────────────────────

describe('mergeProfile — no instance', () => {
  it('uses referenceEmptyWeight when no instance', () => {
    const m = mergeProfile(slingType(), null);
    expect(m.limits.emptyWeight.value).toBe(384);
    expect(m.limits.emptyWeight.unit).toBe('kg');
  });

  it('uses referenceEmptyCG when no instance', () => {
    const m = mergeProfile(slingType(), null);
    expect(m.weightBalance.emptyCG.value).toBe(23.6);
  });

  it('sets tailNumber to null when no instance', () => {
    const m = mergeProfile(slingType(), null);
    expect(m.aircraft.tailNumber).toBeNull();
  });

  it('sets _instance to null', () => {
    const m = mergeProfile(slingType(), null);
    expect(m._instance).toBeNull();
  });

  it('computes usefulLoad from type reference weight', () => {
    const m = mergeProfile(slingType(), null);
    // 600 - 384 = 216
    expect(m.limits.usefulLoad.value).toBe(216);
  });
});

describe('mergeProfile — instance without overrides', () => {
  it('falls back to type referenceEmptyWeight when instance lacks emptyWeight', () => {
    const inst = { instanceId: 'x', typeId: 'sling-lsa', registration: 'N999XX' };
    const m = mergeProfile(slingType(), inst);
    expect(m.limits.emptyWeight.value).toBe(384);
  });

  it('falls back to type referenceEmptyCG when instance lacks emptyCG', () => {
    const inst = { instanceId: 'x', typeId: 'sling-lsa', registration: 'N999XX' };
    const m = mergeProfile(slingType(), inst);
    expect(m.weightBalance.emptyCG.value).toBe(23.6);
  });

  it('still sets tailNumber from instance', () => {
    const inst = { instanceId: 'x', typeId: 'sling-lsa', registration: 'N999XX' };
    const m = mergeProfile(slingType(), inst);
    expect(m.aircraft.tailNumber).toBe('N999XX');
  });
});

// ─── Deep clone isolation ───────────────────────────────────────────────────

describe('mergeProfile — deep clone', () => {
  it('does not mutate the original type profile', () => {
    const type = slingType();
    const inst = slingInstance();
    const m = mergeProfile(type, inst);

    // Merged should have instance values
    expect(m.limits.emptyWeight.value).toBe(386);
    // Original should be untouched
    expect(type.limits.referenceEmptyWeight.value).toBe(384);
    expect(type.aircraft.tailNumber).toBeUndefined();
  });

  it('does not mutate the instance', () => {
    const type = slingType();
    const inst = slingInstance();
    mergeProfile(type, inst);
    expect(inst.registration).toBe('N246LT');
    expect(inst.emptyWeight.value).toBe(386);
  });

  it('modifying merged profile does not affect type', () => {
    const type = slingType();
    const m = mergeProfile(type, slingInstance());
    m.weightBalance.stations.push({ id: 'extra', name: 'Extra' });
    expect(type.weightBalance.stations.length).toBe(2);
    expect(m.weightBalance.stations.length).toBe(3);
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('mergeProfile — edge cases', () => {
  it('throws when typeProfile is null', () => {
    expect(() => mergeProfile(null, slingInstance())).toThrow('typeProfile is required');
  });

  it('handles type without weightBalance section', () => {
    const type = slingType();
    delete type.weightBalance;
    const m = mergeProfile(type, slingInstance());
    expect(m.weightBalance).toBeUndefined();
    expect(m.limits.emptyWeight.value).toBe(386);
  });

  it('handles type without performance section', () => {
    const type = slingType();
    delete type.performance;
    const m = mergeProfile(type, null);
    expect(m.performance).toBeUndefined();
    expect(m.limits.emptyWeight.value).toBe(384);
  });

  it('uses displayName from instance when provided', () => {
    const inst = { ...slingInstance(), displayName: 'My Sling' };
    const m = mergeProfile(slingType(), inst);
    expect(m._instance.displayName).toBe('My Sling');
  });

  it('defaults displayName to registration', () => {
    const m = mergeProfile(slingType(), slingInstance());
    expect(m._instance.displayName).toBe('N246LT');
  });
});
