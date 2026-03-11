import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateTypeProfile } from '@/data/profile-validator.js';
import { mergeProfile } from '@/data/profile-merger.js';
import { calculateTakeoff } from '@/calc/takeoff.js';
import { calculateLanding } from '@/calc/landing.js';
import { calculateClimb } from '@/calc/climb.js';
import { calculateCruise } from '@/calc/cruise.js';
import { calculateWeightBalance } from '@/calc/weight-balance.js';

const profilesDir = resolve(import.meta.dirname, '../../profiles');

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ─── Profile validation ─────────────────────────────────────────────────────

describe('Cessna 172S type profile', () => {
  const profile = loadJSON(resolve(profilesDir, 'types/cessna-172s.json'));

  it('has correct schemaVersion', () => {
    expect(profile.schemaVersion).toBe('1.0');
  });

  it('passes validation with no errors', () => {
    const result = validateTypeProfile(profile);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('has correct aircraft identification', () => {
    expect(profile.typeId).toBe('cessna-172s');
    expect(profile.aircraft.icaoType).toBe('C172');
    expect(profile.source).toBe('bundled');
  });

  it('has all performance sections', () => {
    expect(profile.performance.takeoff).toBeDefined();
    expect(profile.performance.landing).toBeDefined();
    expect(profile.performance.climb).toBeDefined();
    expect(profile.performance.cruise).toBeDefined();
  });

  it('has dual W&B envelopes (Normal + Utility)', () => {
    expect(profile.weightBalance.envelopes.length).toBe(2);
    expect(profile.weightBalance.envelopes[0].id).toBe('normal');
    expect(profile.weightBalance.envelopes[1].id).toBe('utility');
  });

  it('has arm-based CG reference', () => {
    expect(profile.weightBalance.cgReference).toBe('arm');
    expect(profile.weightBalance.cgUnit).toBe('in');
  });

  it('has correct data point counts', () => {
    expect(profile.performance.takeoff.data.length).toBe(135);
    expect(profile.performance.landing.data.length).toBe(45);
    expect(profile.performance.climb.data.length).toBe(27);
    expect(profile.performance.cruise.data.length).toBeGreaterThan(100);
  });
});

// ─── Takeoff calculator (3D: weight × altitude × temperature) ───────────────

describe('Cessna 172S takeoff — table_interpolation', () => {
  const typeProfile = loadJSON(resolve(profilesDir, 'types/cessna-172s.json'));
  const profile = mergeProfile(typeProfile, null);

  it('returns exact POH value at grid point (2550 lbs, SL, 20°C)', () => {
    const r = calculateTakeoff(profile, {
      pressureAltitude: 0,
      temperature: 20,
      weight: 2550,
    });
    expect(r.groundRoll.raw).toBe(995);
    expect(r.totalOverObstacle.raw).toBe(1690);
    expect(r.method).toBe('table_interpolation');
  });

  it('returns exact POH value at 2200 lbs, 4000 ft, 0°C', () => {
    const r = calculateTakeoff(profile, {
      pressureAltitude: 4000,
      temperature: 0,
      weight: 2200,
    });
    expect(r.groundRoll.raw).toBe(870);
    expect(r.totalOverObstacle.raw).toBe(1490);
  });

  it('returns exact POH value at 2400 lbs, 8000 ft, 40°C', () => {
    const r = calculateTakeoff(profile, {
      pressureAltitude: 8000,
      temperature: 40,
      weight: 2400,
    });
    expect(r.groundRoll.raw).toBe(2095);
    expect(r.totalOverObstacle.raw).toBe(3790);
  });

  it('interpolates between weight tables', () => {
    const r = calculateTakeoff(profile, {
      pressureAltitude: 0,
      temperature: 0,
      weight: 2475, // midpoint of 2400 and 2550
    });
    // 2400→745, 2550→860, midpoint → (745+860)/2 = 802.5 → 803
    expect(r.groundRoll.raw).toBeCloseTo(803, 0);
  });

  it('defaults to MTOW when weight not specified', () => {
    const r = calculateTakeoff(profile, {
      pressureAltitude: 0,
      temperature: 20,
    });
    // Should use 2550 lbs (MTOW)
    expect(r.groundRoll.raw).toBe(995);
  });

  it('applies margins', () => {
    const r = calculateTakeoff(profile, {
      pressureAltitude: 0,
      temperature: 20,
      weight: 2550,
      margins: {
        groundRoll: { percentage: 43, roundUp: 100 },
        totalOverObstacle: { percentage: 43, roundUp: 100 },
      },
    });
    expect(r.groundRoll.adjusted).toBeGreaterThan(r.groundRoll.raw);
    expect(r.totalOverObstacle.adjusted).toBeGreaterThan(r.totalOverObstacle.raw);
  });

  it('includes obstacle label for 50 ft', () => {
    const r = calculateTakeoff(profile, {
      pressureAltitude: 0,
      temperature: 20,
      weight: 2550,
    });
    expect(r.obstacleLabel).toContain('50');
  });
});

// ─── Landing calculator (2D: altitude × temperature) ────────────────────────

describe('Cessna 172S landing — table_interpolation', () => {
  const typeProfile = loadJSON(resolve(profilesDir, 'types/cessna-172s.json'));
  const profile = mergeProfile(typeProfile, null);

  it('returns exact POH value at grid point (SL, 20°C)', () => {
    const r = calculateLanding(profile, {
      pressureAltitude: 0,
      temperature: 20,
    });
    expect(r.groundRoll.raw).toBe(585);
    expect(r.totalOverObstacle.raw).toBe(1350);
    expect(r.method).toBe('table_interpolation');
  });

  it('returns exact POH value at 4000 ft, 0°C', () => {
    const r = calculateLanding(profile, {
      pressureAltitude: 4000,
      temperature: 0,
    });
    expect(r.groundRoll.raw).toBe(630);
    expect(r.totalOverObstacle.raw).toBe(1425);
  });

  it('returns exact POH value at 8000 ft, 40°C', () => {
    const r = calculateLanding(profile, {
      pressureAltitude: 8000,
      temperature: 40,
    });
    expect(r.groundRoll.raw).toBe(840);
    expect(r.totalOverObstacle.raw).toBe(1755);
  });

  it('interpolates between grid points', () => {
    const r = calculateLanding(profile, {
      pressureAltitude: 2000,
      temperature: 15,
    });
    // Between (2000,10)→610/1385 and (2000,20)→630/1420
    expect(r.groundRoll.raw).toBe(620); // midpoint
    expect(r.totalOverObstacle.raw).toBeCloseTo(1403, 0); // midpoint
  });
});

// ─── Climb calculator (2D: altitude × temperature) ──────────────────────────

describe('Cessna 172S climb — 2D table_interpolation', () => {
  const typeProfile = loadJSON(resolve(profilesDir, 'types/cessna-172s.json'));
  const profile = mergeProfile(typeProfile, null);

  it('returns exact POH value at grid point (SL, 20°C)', () => {
    const r = calculateClimb(profile, {
      pressureAltitude: 0,
      temperature: 20,
    });
    expect(r.rateOfClimb).toBe(710);
    expect(r.bestClimbSpeed).toBe(74);
  });

  it('returns exact POH value at 8000 ft, 0°C', () => {
    const r = calculateClimb(profile, {
      pressureAltitude: 8000,
      temperature: 0,
    });
    expect(r.rateOfClimb).toBe(405);
    expect(r.bestClimbSpeed).toBe(72);
  });

  it('interpolates between temperature columns', () => {
    const r = calculateClimb(profile, {
      pressureAltitude: 0,
      temperature: 10,
    });
    // Between 0°C (785) and 20°C (710), midpoint → (785+710)/2 = 747.5 → 748
    expect(r.rateOfClimb).toBeCloseTo(748, 0);
  });

  it('includes temperature in result', () => {
    const r = calculateClimb(profile, {
      pressureAltitude: 4000,
      temperature: 20,
    });
    expect(r.temperature).toBe(20);
  });
});

// ─── W&B calculator (arm-based, dual envelopes) ─────────────────────────────

describe('Cessna 172S W&B — arm-based CG', () => {
  const typeProfile = loadJSON(resolve(profilesDir, 'types/cessna-172s.json'));
  const instance = {
    instanceId: 'test-c172',
    typeId: 'cessna-172s',
    registration: 'N54321',
    emptyWeight: { value: 1663, unit: 'lbs' },
    emptyCG: { arm: 40.5, unit: 'in' },
  };
  const profile = mergeProfile(typeProfile, instance);

  it('uses arm-based CG (not %MAC)', () => {
    const r = calculateWeightBalance(profile, {
      stationWeights: { front_seats: 340, rear_seats: 0, baggage_a: 0, baggage_b: 0 },
      fuelQuantity: 40,
      displayWeightUnit: 'lbs',
      displayFuelUnit: 'us_gal',
    });

    expect(r.cgPercent).toBeNull();
    expect(r.cgArm).toBeGreaterThan(35);
    expect(r.cgArm).toBeLessThan(47.3);
    expect(r.weightUnit).toBe('lbs');
  });

  it('detects normal category', () => {
    const r = calculateWeightBalance(profile, {
      stationWeights: { front_seats: 340, rear_seats: 0, baggage_a: 0, baggage_b: 0 },
      fuelQuantity: 40,
      displayWeightUnit: 'lbs',
      displayFuelUnit: 'us_gal',
    });

    expect(r.withinAny).toBe(true);
    expect(r.envelopes.some((e) => e.id === 'normal' && e.within)).toBe(true);
  });

  it('detects overweight', () => {
    const r = calculateWeightBalance(profile, {
      stationWeights: { front_seats: 400, rear_seats: 400, baggage_a: 100, baggage_b: 0 },
      fuelQuantity: 53,
      displayWeightUnit: 'lbs',
      displayFuelUnit: 'us_gal',
    });

    expect(r.overweight).toBe(true);
  });

  it('detects baggage constraint violation', () => {
    const r = calculateWeightBalance(profile, {
      stationWeights: { front_seats: 170, rear_seats: 0, baggage_a: 100, baggage_b: 50 },
      fuelQuantity: 20,
      displayWeightUnit: 'lbs',
      displayFuelUnit: 'us_gal',
    });

    // Combined baggage = 150 lbs > 120 lbs limit
    expect(r.constraintWarnings.length).toBeGreaterThan(0);
  });
});
