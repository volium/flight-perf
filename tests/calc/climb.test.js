import { describe, it, expect } from 'vitest';
import { calculateClimb, calculateClimbPlan } from '@/calc/climb.js';

// Sling LSA profile subset
const slingProfile = {
  performance: {
    climb: {
      method: 'table_interpolation',
      description: 'Rate of climb at max continuous power (5500 RPM), MTOW, ISA conditions',
      variables: ['pressureAltitude'],
      results: ['bestClimbSpeed', 'rateOfClimb'],
      referenceConditions: {
        weight: { value: 600, unit: 'kg' },
        power: 'max continuous (5500 RPM)',
        atmosphere: 'ISA',
      },
      data: [
        { pressureAltitude: { value: 0, unit: 'ft' }, bestClimbSpeed: { value: 72, unit: 'kias' }, rateOfClimb: { value: 800, unit: 'fpm' } },
        { pressureAltitude: { value: 3000, unit: 'ft' }, bestClimbSpeed: { value: 72, unit: 'kias' }, rateOfClimb: { value: 600, unit: 'fpm' } },
        { pressureAltitude: { value: 6000, unit: 'ft' }, bestClimbSpeed: { value: 72, unit: 'kias' }, rateOfClimb: { value: 500, unit: 'fpm' } },
        { pressureAltitude: { value: 9000, unit: 'ft' }, bestClimbSpeed: { value: 72, unit: 'kias' }, rateOfClimb: { value: 400, unit: 'fpm' } },
      ],
    },
  },
  speeds: {
    vy: { value: 72, unit: 'kias' },
    vh: { value: 118, unit: 'kias' },
  },
};

// ─── calculateClimb (single altitude) ───────────────────────────────────────

describe('calculateClimb', () => {
  it('returns ROC at sea level (800 fpm from POH)', () => {
    const r = calculateClimb(slingProfile, { pressureAltitude: 0 });
    expect(r.rateOfClimb).toBe(800);
    expect(r.bestClimbSpeed).toBe(72);
  });

  it('returns ROC at 9000 ft (400 fpm from POH)', () => {
    const r = calculateClimb(slingProfile, { pressureAltitude: 9000 });
    expect(r.rateOfClimb).toBe(400);
  });

  it('interpolates ROC at 1500 ft (midpoint → 700 fpm)', () => {
    const r = calculateClimb(slingProfile, { pressureAltitude: 1500 });
    expect(r.rateOfClimb).toBe(700);
  });

  it('interpolates ROC at 4500 ft (550 fpm)', () => {
    const r = calculateClimb(slingProfile, { pressureAltitude: 4500 });
    expect(r.rateOfClimb).toBe(550);
  });

  it('includes reference conditions', () => {
    const r = calculateClimb(slingProfile, { pressureAltitude: 0 });
    expect(r.referenceConditions.atmosphere).toBe('ISA');
  });

  it('returns error when no climb data', () => {
    const r = calculateClimb({}, { pressureAltitude: 0 });
    expect(r.error).toBeDefined();
  });

  it('returns error for unsupported method', () => {
    const badProfile = {
      performance: { climb: { method: 'formula', data: [] } },
    };
    const r = calculateClimb(badProfile, { pressureAltitude: 0 });
    expect(r.error).toContain('Unsupported');
  });
});

// ─── calculateClimbPlan (full climb planner) ────────────────────────────────

describe('calculateClimbPlan', () => {
  it('computes climb from sea level to 6000 ft at standard pressure', () => {
    const r = calculateClimbPlan(slingProfile, {
      departureElevation: 0,
      targetElevation: 6000,
      altimeter: 29.92,
    });
    expect(r.departurePa).toBe(0);
    expect(r.targetPa).toBe(6000);
    expect(r.altitudeToClimb).toBe(6000);
    expect(r.rocAtDeparture).toBe(800);
    expect(r.rocAtTarget).toBe(500);
    expect(r.timeToClimb).toBeGreaterThan(0);
    expect(r.averageRoc).toBeGreaterThan(0);
    expect(r.ceilingReached).toBe(false);
  });

  it('adjusts pressure altitude for non-standard altimeter', () => {
    const r = calculateClimbPlan(slingProfile, {
      departureElevation: 0,
      targetElevation: 6000,
      altimeter: 29.42, // 500 ft higher PA
    });
    expect(r.departurePa).toBe(500);
    expect(r.targetPa).toBe(6500);
  });

  it('returns error when target is below departure', () => {
    const r = calculateClimbPlan(slingProfile, {
      departureElevation: 5000,
      targetElevation: 3000,
      altimeter: 29.92,
    });
    expect(r.error).toContain('Target altitude');
  });

  it('handles cruise climb transition', () => {
    const r = calculateClimbPlan(slingProfile, {
      departureElevation: 0,
      targetElevation: 6000,
      altimeter: 29.92,
      transitionElevation: 3000,
      cruiseClimbSpeed: 90,
    });
    expect(r.transitionPa).toBe(3000);
    expect(r.cruiseClimbFactor).toBeLessThan(1);
    expect(r.cruiseClimbFactor).toBeGreaterThan(0);
    // Time should be longer with cruise climb (lower ROC above transition)
    const fullVy = calculateClimbPlan(slingProfile, {
      departureElevation: 0,
      targetElevation: 6000,
      altimeter: 29.92,
    });
    expect(r.timeToClimb).toBeGreaterThan(fullVy.timeToClimb);
  });

  it('cruise climb factor is 1.0 when speed <= Vy', () => {
    const r = calculateClimbPlan(slingProfile, {
      departureElevation: 0,
      targetElevation: 3000,
      altimeter: 29.92,
      transitionElevation: 1000,
      cruiseClimbSpeed: 72, // exactly Vy
    });
    expect(r.cruiseClimbFactor).toBe(1.0);
  });

  it('cruise climb factor is 1.0 when speed is null', () => {
    const r = calculateClimbPlan(slingProfile, {
      departureElevation: 0,
      targetElevation: 3000,
      altimeter: 29.92,
    });
    expect(r.cruiseClimbFactor).toBe(1.0);
  });

  it('returns error when no climb data', () => {
    const r = calculateClimbPlan({}, {
      departureElevation: 0,
      targetElevation: 3000,
      altimeter: 29.92,
    });
    expect(r.error).toBeDefined();
  });
});
