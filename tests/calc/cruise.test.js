import { describe, it, expect } from 'vitest';
import { calculateCruise } from '@/calc/cruise.js';

// Sling LSA profile subset
const slingProfile = {
  performance: {
    cruise: {
      method: 'table_interpolation',
      description: 'Cruise speeds at various altitudes and RPM settings',
      variables: ['pressureAltitude', 'rpm'],
      results: ['kias', 'ktas'],
      data: [
        { pressureAltitude: 100,  rpm: 4500, kias: 81,  ktas: 82 },
        { pressureAltitude: 100,  rpm: 4800, kias: 95,  ktas: 96 },
        { pressureAltitude: 100,  rpm: 5000, kias: 101, ktas: 102 },
        { pressureAltitude: 100,  rpm: 5300, kias: 106, ktas: 108 },
        { pressureAltitude: 100,  rpm: 5500, kias: 112, ktas: 114 },

        { pressureAltitude: 3000, rpm: 4500, kias: 72,  ktas: 76 },
        { pressureAltitude: 3000, rpm: 4800, kias: 87,  ktas: 91 },
        { pressureAltitude: 3000, rpm: 5000, kias: 98,  ktas: 104 },
        { pressureAltitude: 3000, rpm: 5300, kias: 104, ktas: 109 },
        { pressureAltitude: 3000, rpm: 5500, kias: 108, ktas: 114 },

        { pressureAltitude: 6000, rpm: 4500, kias: 65,  ktas: 73 },
        { pressureAltitude: 6000, rpm: 4800, kias: 80,  ktas: 89 },
        { pressureAltitude: 6000, rpm: 5000, kias: 90,  ktas: 100 },
        { pressureAltitude: 6000, rpm: 5300, kias: 98,  ktas: 108 },
        { pressureAltitude: 6000, rpm: 5500, kias: 101, ktas: 115 },

        { pressureAltitude: 9000, rpm: 4500, kias: 63,  ktas: 73 },
        { pressureAltitude: 9000, rpm: 4800, kias: 74,  ktas: 88 },
        { pressureAltitude: 9000, rpm: 5000, kias: 87,  ktas: 99 },
        { pressureAltitude: 9000, rpm: 5300, kias: 91,  ktas: 105 },
        { pressureAltitude: 9000, rpm: 5500, kias: 94,  ktas: 108 }
      ],
    },
    fuelConsumption: {
      method: 'table_interpolation',
      variables: ['rpm'],
      results: ['fuelFlowLph', 'fuelFlowGph'],
      referenceConditions: {
        altitude: { value: 3000, unit: 'ft' },
        atmosphere: 'ISA',
        fuelQuantity: { value: 150, unit: 'L', valueUSGal: 39.6 },
      },
      data: [
        { rpm: 4500, fuelFlowLph: 14, fuelFlowGph: 3.7 },
        { rpm: 4800, fuelFlowLph: 16, fuelFlowGph: 4.2 },
        { rpm: 5000, fuelFlowLph: 18, fuelFlowGph: 4.8 },
        { rpm: 5300, fuelFlowLph: 20, fuelFlowGph: 5.3 },
        { rpm: 5500, fuelFlowLph: 21, fuelFlowGph: 5.6 },
      ],
    },
  },
  fuel: {
    type: '100LL',
    inputUnit: 'us_gal',
    capacity: { value: 150, unit: 'L', valueUSGal: 39.6 },
    usableCapacity: { value: 146, unit: 'L', valueUSGal: 38.6 },
  },
};

describe('calculateCruise', () => {
  it('returns exact POH values at grid point (3000 ft, 5000 RPM)', () => {
    const r = calculateCruise(slingProfile, {
      fieldElevation: 3000,
      altimeter: 29.92,
      rpm: 5000,
    });
    expect(r.pressureAltitude).toBe(3000);
    expect(r.kias).toBe(98);
    expect(r.ktas).toBe(104);
  });

  it('interpolates between RPM settings at fixed altitude', () => {
    // At 3000 ft, between 4500 RPM (KTAS 76) and 4800 RPM (KTAS 91)
    // Midpoint 4650 → KTAS = (76+91)/2 = 83.5 → Math.round = 84
    const r = calculateCruise(slingProfile, {
      fieldElevation: 3000,
      altimeter: 29.92,
      rpm: 4650,
    });
    expect(r.ktas).toBe(84); // 83.5 rounds to 84
  });

  it('includes fuel flow data', () => {
    const r = calculateCruise(slingProfile, {
      fieldElevation: 3000,
      altimeter: 29.92,
      rpm: 5000,
    });
    expect(r.fuelFlow).not.toBeNull();
    expect(r.fuelFlow.lph).toBeGreaterThan(0);
    expect(r.fuelFlow.gph).toBeGreaterThan(0);
  });

  it('fuel flow at reference altitude matches POH (no density correction)', () => {
    const r = calculateCruise(slingProfile, {
      fieldElevation: 3000,
      altimeter: 29.92,
      rpm: 5000,
    });
    // At reference altitude (3000 ft), correction should be ~1.0
    expect(r.fuelFlow.correctionFactor).toBeCloseTo(1.0, 2);
    expect(r.fuelFlow.lph).toBeCloseTo(18, 0);
    expect(r.fuelFlow.gph).toBeCloseTo(4.8, 0);
  });

  it('fuel flow decreases at higher altitude (density correction)', () => {
    const atRef = calculateCruise(slingProfile, {
      fieldElevation: 3000,
      altimeter: 29.92,
      rpm: 5000,
    });
    const atHigh = calculateCruise(slingProfile, {
      fieldElevation: 9000,
      altimeter: 29.92,
      rpm: 5000,
    });
    expect(atHigh.fuelFlow.lph).toBeLessThan(atRef.fuelFlow.lph);
    expect(atHigh.fuelFlow.densityCorrected).toBe(true);
  });

  it('calculates endurance and range', () => {
    const r = calculateCruise(slingProfile, {
      fieldElevation: 3000,
      altimeter: 29.92,
      rpm: 5000,
    });
    expect(r.endurance).not.toBeNull();
    expect(r.endurance.hours).toBeGreaterThanOrEqual(0);
    expect(r.endurance.minutes).toBeGreaterThanOrEqual(0);
    expect(r.range).toBeGreaterThan(0);
  });

  it('includes RPM and altitude ranges', () => {
    const r = calculateCruise(slingProfile, {
      fieldElevation: 3000,
      altimeter: 29.92,
      rpm: 5000,
    });
    expect(r.rpmRange.min).toBe(4500);
    expect(r.rpmRange.max).toBe(5500);
    expect(r.altRange.min).toBe(100);
    expect(r.altRange.max).toBe(9000);
  });

  it('returns error when no cruise data', () => {
    const r = calculateCruise({}, {
      fieldElevation: 3000,
      altimeter: 29.92,
      rpm: 5000,
    });
    expect(r.error).toBeDefined();
  });
});
