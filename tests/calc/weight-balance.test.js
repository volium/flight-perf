import { describe, it, expect } from 'vitest';
import { calculateWeightBalance } from '@/calc/weight-balance.js';

// Sling LSA profile subset — %MAC-based CG
const slingProfile = {
  limits: {
    maxTakeoffWeight: { value: 600, unit: 'kg', valueLbs: 1320 },
    emptyWeight: { value: 384, unit: 'kg' },
    baggageMaxWeight: { value: 15, unit: 'kg' },
  },
  fuel: {
    type: '100LL',
    inputUnit: 'us_gal',
    capacity: { value: 150, unit: 'L' },
    usableCapacity: { value: 146, unit: 'L' },
  },
  weightBalance: {
    cgReference: 'percent_mac',
    cgUnit: '%',
    weightUnit: 'kg',
    armUnit: 'mm',
    macLeadingEdge: { value: 1366, unit: 'mm' },
    macLength: { value: 1339, unit: 'mm' },
    emptyCG: { value: 23.6, unit: 'percent_mac' },
    stations: [
      { id: 'pilot', name: 'Pilot', arm: { value: 1959, unit: 'mm' }, maxWeight: null },
      { id: 'passenger', name: 'Passenger', arm: { value: 1959, unit: 'mm' }, maxWeight: null },
      {
        id: 'fuel', name: 'Fuel', arm: { value: 1511, unit: 'mm' },
        maxWeight: { value: 108, unit: 'kg' },
        fuelStation: true,
      },
      {
        id: 'baggage_front', name: 'Baggage (Front)', arm: { value: 2508, unit: 'mm' },
        maxWeight: { value: 15, unit: 'kg' },
      },
      {
        id: 'baggage_rear', name: 'Baggage (Rear)', arm: { value: 2896, unit: 'mm' },
        maxWeight: { value: 15, unit: 'kg' },
      },
    ],
    baggageConstraints: [
      {
        description: 'Combined front + rear baggage must not exceed 15 kg',
        stationIds: ['baggage_front', 'baggage_rear'],
        maxCombinedWeight: { value: 15, unit: 'kg' },
      },
    ],
    envelopes: [
      {
        id: 'normal',
        name: 'Normal Category',
        color: '#22c55e',
        points: [
          { weight: 384, cg: 20.0 },
          { weight: 384, cg: 33.0 },
          { weight: 600, cg: 33.0 },
          { weight: 600, cg: 20.0 },
        ],
      },
    ],
  },
};

describe('calculateWeightBalance', () => {
  it('calculates normal loading within envelope (kg)', () => {
    const r = calculateWeightBalance(slingProfile, {
      stationWeights: { pilot: 80, passenger: 70, baggage_front: 5, baggage_rear: 5 },
      fuelQuantity: 20, // 20 US gal
      displayWeightUnit: 'kg',
      displayFuelUnit: 'us_gal',
    });

    expect(r.emptyWeight).toBe(384);
    expect(r.totalWeight).toBeGreaterThan(384);
    expect(r.cgArm).toBeGreaterThan(0);
    expect(r.cgPercent).not.toBeNull();
    expect(r.cgReference).toBe('percent_mac');
    expect(r.withinAny).toBe(true);
    expect(r.overweight).toBe(false);
  });

  it('detects overweight condition', () => {
    const r = calculateWeightBalance(slingProfile, {
      stationWeights: { pilot: 100, passenger: 100, baggage_front: 10, baggage_rear: 5 },
      fuelQuantity: 39, // near full fuel
      displayWeightUnit: 'kg',
      displayFuelUnit: 'us_gal',
    });

    expect(r.overweight).toBe(true);
    expect(r.weightRemaining).toBeLessThan(0);
  });

  it('detects baggage constraint violation', () => {
    const r = calculateWeightBalance(slingProfile, {
      stationWeights: { pilot: 80, passenger: 0, baggage_front: 10, baggage_rear: 10 },
      fuelQuantity: 10,
      displayWeightUnit: 'kg',
      displayFuelUnit: 'us_gal',
    });

    // Combined baggage = 20 kg > 15 kg limit
    expect(r.constraintWarnings.length).toBeGreaterThan(0);
    expect(r.constraintWarnings[0].combined).toBe(20);
    expect(r.constraintWarnings[0].max).toBe(15);
  });

  it('no baggage warning when within limit', () => {
    const r = calculateWeightBalance(slingProfile, {
      stationWeights: { pilot: 80, passenger: 0, baggage_front: 5, baggage_rear: 5 },
      fuelQuantity: 10,
      displayWeightUnit: 'kg',
      displayFuelUnit: 'us_gal',
    });

    expect(r.constraintWarnings.length).toBe(0);
  });

  it('computes %MAC CG correctly', () => {
    // Empty CG at 23.6% MAC → arm = 1366 + (23.6/100) * 1339 = 1366 + 316.0 = 1682.0 mm
    const r = calculateWeightBalance(slingProfile, {
      stationWeights: { pilot: 0, passenger: 0, baggage_front: 0, baggage_rear: 0 },
      fuelQuantity: 0,
      displayWeightUnit: 'kg',
      displayFuelUnit: 'us_gal',
    });

    // Empty aircraft: CG should be at empty CG position
    expect(r.cgPercent).toBeCloseTo(23.6, 0);
    expect(r.totalWeight).toBe(384);
  });

  it('handles fuel weight resolution from US gallons', () => {
    const r = calculateWeightBalance(slingProfile, {
      stationWeights: { pilot: 80, passenger: 0, baggage_front: 0, baggage_rear: 0 },
      fuelQuantity: 10, // 10 US gal × 6.02 lbs/gal → ~60.2 lbs → ~27.3 kg
      displayWeightUnit: 'kg',
      displayFuelUnit: 'us_gal',
    });

    // 10 gal × 6.02 lbs/gal = 60.2 lbs → 27.3 kg
    expect(r.fuelWeight).toBeCloseTo(27.3, 0);
  });

  it('handles fuel weight resolution from litres', () => {
    const r = calculateWeightBalance(slingProfile, {
      stationWeights: { pilot: 80, passenger: 0, baggage_front: 0, baggage_rear: 0 },
      fuelQuantity: 50, // 50 L × 0.721 kg/L = 36.05 kg
      displayWeightUnit: 'kg',
      displayFuelUnit: 'L',
    });

    expect(r.fuelWeight).toBeCloseTo(36.1, 0);
  });

  it('converts to lbs when displayWeightUnit is lbs', () => {
    const r = calculateWeightBalance(slingProfile, {
      stationWeights: { pilot: 176, passenger: 154, baggage_front: 0, baggage_rear: 0 },
      fuelQuantity: 20,
      displayWeightUnit: 'lbs',
      displayFuelUnit: 'us_gal',
    });

    // Empty weight should be converted from 384 kg
    expect(r.emptyWeight).toBeCloseTo(847, -1);
    expect(r.weightUnit).toBe('lbs');
    // Max weight 600 kg → ~1323 lbs
    expect(r.maxWeight).toBeCloseTo(1323, -1);
  });

  it('returns zero fuel weight for zero quantity', () => {
    const r = calculateWeightBalance(slingProfile, {
      stationWeights: { pilot: 80, passenger: 0, baggage_front: 0, baggage_rear: 0 },
      fuelQuantity: 0,
      displayWeightUnit: 'kg',
      displayFuelUnit: 'us_gal',
    });

    expect(r.fuelWeight).toBe(0);
  });

  it('returns error when no W&B data', () => {
    const r = calculateWeightBalance({}, {
      stationWeights: {},
      fuelQuantity: 0,
      displayWeightUnit: 'kg',
      displayFuelUnit: 'us_gal',
    });

    expect(r.error).toBeDefined();
  });

  it('envelopes are returned with converted points', () => {
    const r = calculateWeightBalance(slingProfile, {
      stationWeights: { pilot: 80, passenger: 0, baggage_front: 0, baggage_rear: 0 },
      fuelQuantity: 10,
      displayWeightUnit: 'kg',
      displayFuelUnit: 'us_gal',
    });

    expect(r.envelopes.length).toBe(1);
    expect(r.envelopes[0].id).toBe('normal');
    expect(r.envelopes[0].points.length).toBe(4);
    // Points should be in kg (same as profile weight unit)
    expect(r.envelopes[0].points[0].weight).toBe(384);
    expect(r.envelopes[0].points[2].weight).toBe(600);
  });
});
