import { describe, it, expect } from 'vitest';
import { validateTypeProfile, validateInstance } from '@/data/profile-validator.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Minimal valid v2 type profile — all required sections, nothing optional */
function minimalValidProfile() {
  return {
    schemaVersion: '2.0',
    aircraft: {
      id: 'test-aircraft',
      name: 'Test Aircraft',
      manufacturer: 'Test Mfg',
      type: 'single-engine-land',
      category: 'normal',
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
  };
}

function hasError(result, pathSubstr) {
  return result.errors.some((e) => e.path.includes(pathSubstr));
}

function hasWarning(result, pathSubstr) {
  return result.warnings.some((w) => w.path.includes(pathSubstr));
}

// ─── Valid profiles ─────────────────────────────────────────────────────────

describe('validateTypeProfile — valid profiles', () => {
  it('accepts minimal valid profile', () => {
    const r = validateTypeProfile(minimalValidProfile());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('returns completeness warnings for minimal profile (no performance)', () => {
    const r = validateTypeProfile(minimalValidProfile());
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(hasWarning(r, 'performance')).toBe(true);
  });

  it('accepts profile with all optional sections', () => {
    const p = minimalValidProfile();
    p.weightBalance = {
      cgReference: 'arm',
      cgUnit: 'in',
      weightUnit: 'lbs',
      stations: [
        { id: 'pilot', name: 'Pilot', arm: { value: 37, unit: 'in' } },
        { id: 'fuel', name: 'Fuel', arm: { value: 48, unit: 'in' }, fuelStation: true },
      ],
      envelopes: [{
        id: 'normal', name: 'Normal', color: '#22c55e',
        points: [
          { weight: 1500, cg: 35 }, { weight: 1500, cg: 47 },
          { weight: 2550, cg: 47 }, { weight: 2550, cg: 35 },
        ],
      }],
    };
    p.performance = {
      climb: {
        method: 'table_interpolation',
        units: { pressureAltitude: 'ft', rateOfClimb: 'fpm' },
        data: [
          { pressureAltitude: 0, rateOfClimb: 730 },
          { pressureAltitude: 4000, rateOfClimb: 500 },
        ],
      },
    };
    const r = validateTypeProfile(p);
    expect(r.valid).toBe(true);
  });
});

// ─── Null/invalid input ─────────────────────────────────────────────────────

describe('validateTypeProfile — null/invalid input', () => {
  it('rejects null', () => {
    const r = validateTypeProfile(null);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBe(1);
  });

  it('rejects undefined', () => {
    const r = validateTypeProfile(undefined);
    expect(r.valid).toBe(false);
  });

  it('rejects non-object', () => {
    const r = validateTypeProfile('not an object');
    expect(r.valid).toBe(false);
  });
});

// ─── schemaVersion ──────────────────────────────────────────────────────────

describe('validateTypeProfile — schemaVersion', () => {
  it('errors when schemaVersion is missing', () => {
    const p = minimalValidProfile();
    delete p.schemaVersion;
    const r = validateTypeProfile(p);
    expect(hasError(r, 'schemaVersion')).toBe(true);
  });

  it('errors when schemaVersion is wrong value', () => {
    const p = minimalValidProfile();
    p.schemaVersion = '1.0';
    const r = validateTypeProfile(p);
    expect(hasError(r, 'schemaVersion')).toBe(true);
  });

  it('tolerates v1 profile with profileVersion (for migration)', () => {
    const p = minimalValidProfile();
    delete p.schemaVersion;
    p.profileVersion = '1.0';
    const r = validateTypeProfile(p);
    expect(hasError(r, 'schemaVersion')).toBe(false);
  });
});

// ─── aircraft section ───────────────────────────────────────────────────────

describe('validateTypeProfile — aircraft', () => {
  it('errors when aircraft section is missing', () => {
    const p = minimalValidProfile();
    delete p.aircraft;
    const r = validateTypeProfile(p);
    expect(hasError(r, 'aircraft')).toBe(true);
  });

  it('errors when aircraft.id is missing', () => {
    const p = minimalValidProfile();
    delete p.aircraft.id;
    const r = validateTypeProfile(p);
    expect(hasError(r, 'aircraft.id')).toBe(true);
  });

  it('errors when aircraft.name is empty string', () => {
    const p = minimalValidProfile();
    p.aircraft.name = '';
    const r = validateTypeProfile(p);
    expect(hasError(r, 'aircraft.name')).toBe(true);
  });

  it('warns on unknown aircraft.type', () => {
    const p = minimalValidProfile();
    p.aircraft.type = 'spaceship';
    const r = validateTypeProfile(p);
    expect(r.valid).toBe(true); // warning, not error
    expect(hasWarning(r, 'aircraft.type')).toBe(true);
  });

  it('warns on unknown aircraft.category', () => {
    const p = minimalValidProfile();
    p.aircraft.category = 'ultralight';
    const r = validateTypeProfile(p);
    expect(hasWarning(r, 'aircraft.category')).toBe(true);
  });
});

// ─── limits section ─────────────────────────────────────────────────────────

describe('validateTypeProfile — limits', () => {
  it('errors when limits section is missing', () => {
    const p = minimalValidProfile();
    delete p.limits;
    const r = validateTypeProfile(p);
    expect(hasError(r, 'limits')).toBe(true);
  });

  it('errors when maxTakeoffWeight is missing', () => {
    const p = minimalValidProfile();
    delete p.limits.maxTakeoffWeight;
    const r = validateTypeProfile(p);
    expect(hasError(r, 'maxTakeoffWeight')).toBe(true);
  });

  it('errors when referenceEmptyWeight is missing (and no v1 emptyWeight)', () => {
    const p = minimalValidProfile();
    delete p.limits.referenceEmptyWeight;
    const r = validateTypeProfile(p);
    expect(hasError(r, 'referenceEmptyWeight')).toBe(true);
  });

  it('accepts v1 emptyWeight field as fallback', () => {
    const p = minimalValidProfile();
    delete p.limits.referenceEmptyWeight;
    p.limits.emptyWeight = { value: 1663, unit: 'lbs' };
    const r = validateTypeProfile(p);
    expect(hasError(r, 'referenceEmptyWeight')).toBe(false);
  });

  it('errors when MTOW <= empty weight', () => {
    const p = minimalValidProfile();
    p.limits.maxTakeoffWeight = { value: 1000, unit: 'lbs' };
    p.limits.referenceEmptyWeight = { value: 1500, unit: 'lbs' };
    const r = validateTypeProfile(p);
    expect(hasError(r, 'limits')).toBe(true);
    expect(r.errors.some((e) => e.message.includes('must be greater'))).toBe(true);
  });

  it('warns when maxLandingWeight exceeds MTOW', () => {
    const p = minimalValidProfile();
    p.limits.maxLandingWeight = { value: 3000, unit: 'lbs' };
    const r = validateTypeProfile(p);
    expect(hasWarning(r, 'limits')).toBe(true);
  });
});

// ─── fuel section ───────────────────────────────────────────────────────────

describe('validateTypeProfile — fuel', () => {
  it('errors when fuel section is missing', () => {
    const p = minimalValidProfile();
    delete p.fuel;
    const r = validateTypeProfile(p);
    expect(hasError(r, 'fuel')).toBe(true);
  });

  it('errors when fuel.capacity is missing', () => {
    const p = minimalValidProfile();
    delete p.fuel.capacity;
    const r = validateTypeProfile(p);
    expect(hasError(r, 'fuel.capacity')).toBe(true);
  });

  it('errors when usableCapacity exceeds capacity', () => {
    const p = minimalValidProfile();
    p.fuel.usableCapacity = { value: 100, unit: 'us_gal' };
    const r = validateTypeProfile(p);
    expect(hasError(r, 'fuel')).toBe(true);
    expect(r.errors.some((e) => e.message.includes('exceeds capacity'))).toBe(true);
  });

  it('warns on unknown fuel type', () => {
    const p = minimalValidProfile();
    p.fuel.type = 'ROCKET_FUEL';
    const r = validateTypeProfile(p);
    expect(hasWarning(r, 'fuel.type')).toBe(true);
  });

  it('errors on invalid inputUnit', () => {
    const p = minimalValidProfile();
    p.fuel.inputUnit = 'imp_gal';
    const r = validateTypeProfile(p);
    expect(hasError(r, 'fuel.inputUnit')).toBe(true);
  });

  it('warns when tank capacities do not sum to total', () => {
    const p = minimalValidProfile();
    p.fuel.tanks = [
      { name: 'Left', capacity: { value: 20, unit: 'us_gal' } },
      { name: 'Right', capacity: { value: 20, unit: 'us_gal' } },
    ];
    // total = 56, tanks sum = 40
    const r = validateTypeProfile(p);
    expect(hasWarning(r, 'fuel.tanks')).toBe(true);
  });

  it('no tank warning when tanks sum matches', () => {
    const p = minimalValidProfile();
    p.fuel.tanks = [
      { name: 'Left', capacity: { value: 28, unit: 'us_gal' } },
      { name: 'Right', capacity: { value: 28, unit: 'us_gal' } },
    ];
    const r = validateTypeProfile(p);
    expect(hasWarning(r, 'fuel.tanks')).toBe(false);
  });
});

// ─── speeds section ─────────────────────────────────────────────────────────

describe('validateTypeProfile — speeds', () => {
  it('errors when speeds section is missing', () => {
    const p = minimalValidProfile();
    delete p.speeds;
    const r = validateTypeProfile(p);
    expect(hasError(r, 'speeds')).toBe(true);
  });

  it('errors when vne is missing', () => {
    const p = minimalValidProfile();
    delete p.speeds.vne;
    const r = validateTypeProfile(p);
    expect(hasError(r, 'speeds.vne')).toBe(true);
  });

  it('errors when vs0 is missing', () => {
    const p = minimalValidProfile();
    delete p.speeds.vs0;
    const r = validateTypeProfile(p);
    expect(hasError(r, 'speeds.vs0')).toBe(true);
  });

  it('errors when vs0 >= vne', () => {
    const p = minimalValidProfile();
    p.speeds.vs0 = { value: 200, unit: 'kias' };
    p.speeds.vne = { value: 163, unit: 'kias' };
    const r = validateTypeProfile(p);
    expect(hasError(r, 'speeds')).toBe(true);
  });

  it('warns when vy <= vs0', () => {
    const p = minimalValidProfile();
    p.speeds.vy = { value: 35, unit: 'kias' };
    const r = validateTypeProfile(p);
    expect(hasWarning(r, 'speeds')).toBe(true);
  });

  it('warns when vno >= vne', () => {
    const p = minimalValidProfile();
    p.speeds.vno = { value: 163, unit: 'kias' };
    const r = validateTypeProfile(p);
    expect(hasWarning(r, 'speeds')).toBe(true);
  });
});

// ─── weightBalance section ──────────────────────────────────────────────────

describe('validateTypeProfile — weightBalance', () => {
  function withWB(overrides = {}) {
    const p = minimalValidProfile();
    p.weightBalance = {
      cgReference: 'arm',
      cgUnit: 'in',
      weightUnit: 'lbs',
      stations: [
        { id: 'pilot', name: 'Pilot', arm: { value: 37, unit: 'in' } },
        { id: 'fuel', name: 'Fuel', arm: { value: 48, unit: 'in' }, fuelStation: true },
      ],
      envelopes: [{
        id: 'normal', name: 'Normal', color: '#22c55e',
        points: [
          { weight: 1500, cg: 35 }, { weight: 1500, cg: 47 },
          { weight: 2550, cg: 47 }, { weight: 2550, cg: 35 },
        ],
      }],
      ...overrides,
    };
    return p;
  }

  it('valid when absent (optional section)', () => {
    const r = validateTypeProfile(minimalValidProfile());
    expect(r.valid).toBe(true);
  });

  it('valid with complete W&B section', () => {
    const r = validateTypeProfile(withWB());
    expect(r.valid).toBe(true);
  });

  it('errors on invalid cgReference', () => {
    const r = validateTypeProfile(withWB({ cgReference: 'other' }));
    expect(hasError(r, 'cgReference')).toBe(true);
  });

  it('errors when %MAC without macLeadingEdge', () => {
    const r = validateTypeProfile(withWB({
      cgReference: 'percent_mac',
      macLength: { value: 58.4, unit: 'in' },
    }));
    expect(hasError(r, 'macLeadingEdge')).toBe(true);
  });

  it('errors when %MAC without macLength', () => {
    const r = validateTypeProfile(withWB({
      cgReference: 'percent_mac',
      macLeadingEdge: { value: 38.7, unit: 'in' },
    }));
    expect(hasError(r, 'macLength')).toBe(true);
  });

  it('errors when stations is empty', () => {
    const r = validateTypeProfile(withWB({ stations: [] }));
    expect(hasError(r, 'stations')).toBe(true);
  });

  it('errors on duplicate station ids', () => {
    const r = validateTypeProfile(withWB({
      stations: [
        { id: 'pilot', name: 'Pilot', arm: { value: 37, unit: 'in' } },
        { id: 'pilot', name: 'Copilot', arm: { value: 37, unit: 'in' } },
      ],
    }));
    expect(hasError(r, 'stations')).toBe(true);
    expect(r.errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
  });

  it('warns when no fuel station defined', () => {
    const r = validateTypeProfile(withWB({
      stations: [
        { id: 'pilot', name: 'Pilot', arm: { value: 37, unit: 'in' } },
      ],
    }));
    expect(hasWarning(r, 'stations')).toBe(true);
  });

  it('errors when envelopes is empty', () => {
    const r = validateTypeProfile(withWB({ envelopes: [] }));
    expect(hasError(r, 'envelopes')).toBe(true);
  });

  it('errors when envelope has < 3 points', () => {
    const r = validateTypeProfile(withWB({
      envelopes: [{
        id: 'normal', name: 'Normal', color: '#22c55e',
        points: [{ weight: 1500, cg: 35 }, { weight: 2550, cg: 47 }],
      }],
    }));
    expect(hasError(r, 'points')).toBe(true);
  });

  it('warns on baggage constraint referencing unknown station', () => {
    const p = withWB();
    p.weightBalance.baggageConstraints = [{
      description: 'Test',
      stationIds: ['nonexistent'],
      maxCombinedWeight: { value: 50, unit: 'lbs' },
    }];
    const r = validateTypeProfile(p);
    expect(hasWarning(r, 'baggageConstraints')).toBe(true);
  });
});

// ─── performance section ────────────────────────────────────────────────────

describe('validateTypeProfile — performance', () => {
  it('warns when performance section is absent', () => {
    const r = validateTypeProfile(minimalValidProfile());
    expect(hasWarning(r, 'performance')).toBe(true);
  });

  it('warns when performance is present but empty', () => {
    const p = minimalValidProfile();
    p.performance = {};
    const r = validateTypeProfile(p);
    expect(hasWarning(r, 'performance')).toBe(true);
  });

  it('errors when method is missing', () => {
    const p = minimalValidProfile();
    p.performance = { climb: { data: [{ a: 1 }, { b: 2 }] } };
    const r = validateTypeProfile(p);
    expect(hasError(r, 'method')).toBe(true);
  });

  it('errors when method is unknown', () => {
    const p = minimalValidProfile();
    p.performance = { climb: { method: 'magic', data: [{ a: 1 }] } };
    const r = validateTypeProfile(p);
    expect(hasError(r, 'method')).toBe(true);
  });

  it('errors when data is missing', () => {
    const p = minimalValidProfile();
    p.performance = { climb: { method: 'table_interpolation' } };
    const r = validateTypeProfile(p);
    expect(hasError(r, 'data')).toBe(true);
  });

  it('errors when data is empty', () => {
    const p = minimalValidProfile();
    p.performance = { climb: { method: 'table_interpolation', data: [] } };
    const r = validateTypeProfile(p);
    expect(hasError(r, 'data')).toBe(true);
  });

  it('errors when table_interpolation has only 1 data point', () => {
    const p = minimalValidProfile();
    p.performance = {
      climb: {
        method: 'table_interpolation',
        data: [{ pressureAltitude: { value: 0, unit: 'ft' }, rateOfClimb: { value: 800, unit: 'fpm' } }],
      },
    };
    const r = validateTypeProfile(p);
    expect(hasError(r, 'data')).toBe(true);
  });

  it('valid with reference_table and 1 data point', () => {
    const p = minimalValidProfile();
    p.performance = {
      takeoff: {
        method: 'reference_table',
        data: [{
          surface: 'paved', surfaceLabel: 'Paved',
          groundRoll: { value: 960, unit: 'ft' },
          totalOverObstacle: { value: 1685, unit: 'ft' },
        }],
      },
    };
    const r = validateTypeProfile(p);
    expect(hasError(r, 'performance.takeoff')).toBe(false);
  });

  it('validates each performance sub-section independently', () => {
    const p = minimalValidProfile();
    p.performance = {
      climb: {
        method: 'table_interpolation',
        units: { pressureAltitude: 'ft', rateOfClimb: 'fpm' },
        data: [
          { pressureAltitude: 0, rateOfClimb: 800 },
          { pressureAltitude: 4000, rateOfClimb: 500 },
        ],
      },
      cruise: { method: 'table_interpolation', data: [] }, // invalid — missing units and data
    };
    const r = validateTypeProfile(p);
    expect(hasError(r, 'performance.cruise')).toBe(true);
    expect(hasError(r, 'performance.climb')).toBe(false);
  });
});

// ─── validateInstance ───────────────────────────────────────────────────────

describe('validateInstance', () => {
  it('accepts a valid instance', () => {
    const r = validateInstance({
      instanceId: 'uuid-001',
      typeId: 'cessna-172s',
      registration: 'N54321',
      emptyWeight: { value: 1680, unit: 'lbs' },
    });
    expect(r.valid).toBe(true);
  });

  it('accepts instance without optional emptyWeight', () => {
    const r = validateInstance({
      instanceId: 'uuid-001',
      typeId: 'cessna-172s',
      registration: 'N54321',
    });
    expect(r.valid).toBe(true);
  });

  it('errors when instanceId is missing', () => {
    const r = validateInstance({ typeId: 'x', registration: 'N1' });
    expect(r.valid).toBe(false);
    expect(hasError(r, 'instanceId')).toBe(true);
  });

  it('errors when typeId is missing', () => {
    const r = validateInstance({ instanceId: 'x', registration: 'N1' });
    expect(r.valid).toBe(false);
    expect(hasError(r, 'typeId')).toBe(true);
  });

  it('errors when registration is missing', () => {
    const r = validateInstance({ instanceId: 'x', typeId: 'y' });
    expect(r.valid).toBe(false);
    expect(hasError(r, 'registration')).toBe(true);
  });

  it('rejects null input', () => {
    const r = validateInstance(null);
    expect(r.valid).toBe(false);
  });

  it('validates emptyWeight format when provided', () => {
    const r = validateInstance({
      instanceId: 'uuid-001',
      typeId: 'cessna-172s',
      registration: 'N54321',
      emptyWeight: { value: 'not a number', unit: 'lbs' },
    });
    expect(r.valid).toBe(false);
    expect(hasError(r, 'emptyWeight')).toBe(true);
  });
});
