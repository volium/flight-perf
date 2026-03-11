import { describe, it, expect } from 'vitest';
import { calculateFuelPlan } from '@/calc/fuel.js';

// Sling LSA profile subset
const slingProfile = {
  performance: {
    cruise: {
      method: 'table_interpolation',
      variables: ['pressureAltitude', 'rpm'],
      results: ['kias', 'ktas'],
      data: [
        { pressureAltitude: 100,  rpm: 4500, kias: 81,  ktas: 82 },
        { pressureAltitude: 100,  rpm: 5000, kias: 101, ktas: 102 },
        { pressureAltitude: 100,  rpm: 5500, kias: 112, ktas: 114 },
        { pressureAltitude: 3000, rpm: 4500, kias: 72,  ktas: 76 },
        { pressureAltitude: 3000, rpm: 5000, kias: 98,  ktas: 104 },
        { pressureAltitude: 3000, rpm: 5500, kias: 108, ktas: 114 },
        { pressureAltitude: 6000, rpm: 4500, kias: 65,  ktas: 73 },
        { pressureAltitude: 6000, rpm: 5000, kias: 90,  ktas: 100 },
        { pressureAltitude: 6000, rpm: 5500, kias: 101, ktas: 115 },
        { pressureAltitude: 9000, rpm: 4500, kias: 63,  ktas: 73 },
        { pressureAltitude: 9000, rpm: 5000, kias: 87,  ktas: 99 },
        { pressureAltitude: 9000, rpm: 5500, kias: 94,  ktas: 108 },
      ],
    },
    fuelConsumption: {
      method: 'table_interpolation',
      variables: ['rpm'],
      results: ['fuelFlowLph', 'fuelFlowGph', 'airspeed'],
      referenceConditions: {
        altitude: { value: 3000, unit: 'ft' },
        atmosphere: 'ISA',
        fuelQuantity: { value: 150, unit: 'L' },
      },
      data: [
        { rpm: 4500, fuelFlowLph: 14, fuelFlowGph: 3.7, airspeed: 73 },
        { rpm: 4800, fuelFlowLph: 16, fuelFlowGph: 4.2, airspeed: 91 },
        { rpm: 5000, fuelFlowLph: 18, fuelFlowGph: 4.8, airspeed: 104 },
        { rpm: 5300, fuelFlowLph: 20, fuelFlowGph: 5.3, airspeed: 109 },
        { rpm: 5500, fuelFlowLph: 21, fuelFlowGph: 5.6, airspeed: 114 },
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

describe('calculateFuelPlan', () => {
  it('computes a standard trip at reference altitude', () => {
    const r = calculateFuelPlan(slingProfile, {
      tripDistance: 100,
      cruiseAltitude: 3000,
      altimeter: 29.92,
      rpm: 5000,
      fuelOnBoard: 30, // 30 US gal
      reserveMinutes: 45,
    });

    expect(r.pressureAltitude).toBe(3000);
    expect(r.tasKt).toBeGreaterThan(0);
    expect(r.flowLph).toBeCloseTo(18, 0); // near reference (correction ~1.0)
    expect(r.tripDistance).toBe(100);
    expect(r.timeEnRouteMin).toBeGreaterThan(0);
    expect(r.tripFuelL).toBeGreaterThan(0);
    expect(r.reserveFuelL).toBeGreaterThan(0);
    expect(r.totalRequiredL).toBeGreaterThan(r.tripFuelL);
  });

  it('trip fuel is proportional to distance', () => {
    const short = calculateFuelPlan(slingProfile, {
      tripDistance: 50,
      cruiseAltitude: 3000,
      altimeter: 29.92,
      rpm: 5000,
      fuelOnBoard: 30,
      reserveMinutes: 45,
    });
    const long = calculateFuelPlan(slingProfile, {
      tripDistance: 100,
      cruiseAltitude: 3000,
      altimeter: 29.92,
      rpm: 5000,
      fuelOnBoard: 30,
      reserveMinutes: 45,
    });

    expect(long.tripFuelL).toBeCloseTo(short.tripFuelL * 2, 0);
    expect(long.timeEnRouteMin).toBeCloseTo(short.timeEnRouteMin * 2, 0);
  });

  it('detects insufficient fuel', () => {
    const r = calculateFuelPlan(slingProfile, {
      tripDistance: 500, // long trip
      cruiseAltitude: 3000,
      altimeter: 29.92,
      rpm: 5000,
      fuelOnBoard: 10, // very little fuel
      reserveMinutes: 45,
    });

    expect(r.sufficient).toBe(false);
    expect(r.remainingL).toBeLessThan(0);
  });

  it('detects sufficient fuel', () => {
    const r = calculateFuelPlan(slingProfile, {
      tripDistance: 50, // short trip
      cruiseAltitude: 3000,
      altimeter: 29.92,
      rpm: 5000,
      fuelOnBoard: 30,
      reserveMinutes: 45,
    });

    expect(r.sufficient).toBe(true);
    expect(r.remainingL).toBeGreaterThan(0);
  });

  it('applies density correction at higher altitude', () => {
    const atRef = calculateFuelPlan(slingProfile, {
      tripDistance: 100,
      cruiseAltitude: 3000,
      altimeter: 29.92,
      rpm: 5000,
      fuelOnBoard: 30,
      reserveMinutes: 45,
    });
    const atHigh = calculateFuelPlan(slingProfile, {
      tripDistance: 100,
      cruiseAltitude: 9000,
      altimeter: 29.92,
      rpm: 5000,
      fuelOnBoard: 30,
      reserveMinutes: 45,
    });

    expect(atHigh.flowLph).toBeLessThan(atRef.flowLph);
    expect(atHigh.densityCorrected).toBe(true);
  });

  it('reserve fuel is based on time, not distance', () => {
    const r = calculateFuelPlan(slingProfile, {
      tripDistance: 100,
      cruiseAltitude: 3000,
      altimeter: 29.92,
      rpm: 5000,
      fuelOnBoard: 30,
      reserveMinutes: 45,
    });

    // Reserve = 45 min × flow rate
    const expectedReserveL = r.flowLph * (45 / 60);
    expect(r.reserveFuelL).toBeCloseTo(expectedReserveL, 0);
  });

  it('computes endurance and range', () => {
    const r = calculateFuelPlan(slingProfile, {
      tripDistance: 100,
      cruiseAltitude: 3000,
      altimeter: 29.92,
      rpm: 5000,
      fuelOnBoard: 30,
      reserveMinutes: 45,
    });

    expect(r.enduranceMin).toBeGreaterThan(0);
    expect(r.rangeNm).toBeGreaterThan(0);
    expect(r.enduranceAfterTripMin).toBeGreaterThan(0);
  });

  it('accounts for unusable fuel', () => {
    const r = calculateFuelPlan(slingProfile, {
      tripDistance: 100,
      cruiseAltitude: 3000,
      altimeter: 29.92,
      rpm: 5000,
      fuelOnBoard: 30,
      reserveMinutes: 45,
    });

    // Unusable = 150L - 146L = 4L
    expect(r.unusableL).toBeCloseTo(4, 0);
    expect(r.usableFobL).toBeLessThan(r.fobL);
  });

  it('returns error when no fuel consumption data', () => {
    const r = calculateFuelPlan({}, {
      tripDistance: 100,
      cruiseAltitude: 3000,
      altimeter: 29.92,
      rpm: 5000,
      fuelOnBoard: 30,
      reserveMinutes: 45,
    });

    expect(r.error).toBeDefined();
  });

  it('includes RPM range from fuel data', () => {
    const r = calculateFuelPlan(slingProfile, {
      tripDistance: 100,
      cruiseAltitude: 3000,
      altimeter: 29.92,
      rpm: 5000,
      fuelOnBoard: 30,
      reserveMinutes: 45,
    });

    expect(r.rpmRange.min).toBe(4500);
    expect(r.rpmRange.max).toBe(5500);
  });
});
