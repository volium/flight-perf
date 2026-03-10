import { describe, it, expect } from 'vitest';
import { calcReferenceTable, getDistanceValue, formatObstacleLabel } from '@/engine/perf-common.js';

// ─── Sling LSA takeoff performance section (from profile) ───────────────────

const slingTakeoff = {
  method: 'reference_table',
  description: 'Takeoff distances at ISA, MTOW (600 kg), max power',
  obstacleHeight: { value: 15, unit: 'm', valueFt: 49.2 },
  referenceConditions: {
    weight: { value: 600, unit: 'kg' },
    atmosphere: 'ISA',
    power: 'max (5500 RPM)',
  },
  data: [
    {
      surface: 'concrete_asphalt',
      surfaceLabel: 'Concrete / Asphalt',
      groundRoll: { value: 120, unit: 'm', valueFt: 395 },
      totalOverObstacle: { value: 230, unit: 'm', valueFt: 755 },
    },
    {
      surface: 'grass',
      surfaceLabel: 'Grass',
      groundRoll: { value: 140, unit: 'm', valueFt: 460 },
      totalOverObstacle: { value: 250, unit: 'm', valueFt: 820 },
    },
  ],
  corrections: [],
};

// ─── getDistanceValue ───────────────────────────────────────────────────────

describe('getDistanceValue', () => {
  it('returns native value when no preferred unit specified', () => {
    const dist = { value: 120, unit: 'm', valueFt: 395 };
    expect(getDistanceValue(dist)).toBe(120);
  });

  it('returns native value when preferred unit matches', () => {
    const dist = { value: 120, unit: 'm', valueFt: 395 };
    expect(getDistanceValue(dist, 'm')).toBe(120);
  });

  it('returns pre-computed ft value when converting m→ft with valueFt present', () => {
    const dist = { value: 120, unit: 'm', valueFt: 395 };
    expect(getDistanceValue(dist, 'ft')).toBe(395);
  });

  it('computes ft value when converting m→ft without valueFt', () => {
    const dist = { value: 120, unit: 'm' };
    expect(getDistanceValue(dist, 'ft')).toBe(394); // Math.round(120 * 3.28084)
  });

  it('computes m value when converting ft→m', () => {
    const dist = { value: 395, unit: 'ft' };
    expect(getDistanceValue(dist, 'm')).toBe(120); // Math.round(395 * 0.3048)
  });
});

// ─── formatObstacleLabel ────────────────────────────────────────────────────

describe('formatObstacleLabel', () => {
  it('returns fallback for null obstacle', () => {
    expect(formatObstacleLabel(null)).toBe('over obstacle');
  });

  it('returns fallback for undefined obstacle', () => {
    expect(formatObstacleLabel(undefined)).toBe('over obstacle');
  });

  it('formats metric obstacle with ft equivalent (Sling: 15 m / 49 ft)', () => {
    const label = formatObstacleLabel({ value: 15, unit: 'm', valueFt: 49.2 });
    expect(label).toBe('over 15 m (49.2 ft)');
  });

  it('formats metric obstacle without valueFt (computed)', () => {
    const label = formatObstacleLabel({ value: 15, unit: 'm' });
    expect(label).toBe('over 15 m (49 ft)');
  });

  it('formats imperial obstacle', () => {
    const label = formatObstacleLabel({ value: 50, unit: 'ft' });
    expect(label).toBe('over 50 ft');
  });
});

// ─── calcReferenceTable ─────────────────────────────────────────────────────

describe('calcReferenceTable', () => {
  it('returns correct distances for concrete surface (Sling POH: GR=120m, TO=230m)', () => {
    const r = calcReferenceTable(slingTakeoff, { surface: 'concrete_asphalt' });
    expect(r.groundRoll.raw).toBe(120);
    expect(r.totalOverObstacle.raw).toBe(230);
    expect(r.surface).toBe('Concrete / Asphalt');
    expect(r.method).toBe('reference_table');
  });

  it('returns correct distances for grass surface (Sling POH: GR=140m, TO=250m)', () => {
    const r = calcReferenceTable(slingTakeoff, { surface: 'grass' });
    expect(r.groundRoll.raw).toBe(140);
    expect(r.totalOverObstacle.raw).toBe(250);
  });

  it('applies safety margins to distances', () => {
    const margins = {
      groundRoll: { percentage: 25, roundUp: 50 },
      totalOverObstacle: { percentage: 43, roundUp: 100 },
    };
    const r = calcReferenceTable(slingTakeoff, { surface: 'concrete_asphalt', margins });
    // GR: 120 + 25% = 150 → ↑50 → 150
    expect(r.groundRoll.adjusted).toBe(150);
    // TO: 230 + 43% = 328.9 → ↑100 → 400
    expect(r.totalOverObstacle.adjusted).toBe(400);
  });

  it('converts distances to ft when distanceUnit is ft', () => {
    const r = calcReferenceTable(slingTakeoff, {
      surface: 'concrete_asphalt',
      distanceUnit: 'ft',
    });
    expect(r.groundRoll.raw).toBe(395); // from valueFt
    expect(r.totalOverObstacle.raw).toBe(755);
    expect(r.distanceUnit).toBe('ft');
  });

  it('returns error for unknown surface type', () => {
    const r = calcReferenceTable(slingTakeoff, { surface: 'gravel' });
    expect(r.error).toContain('gravel');
  });

  it('includes obstacle label', () => {
    const r = calcReferenceTable(slingTakeoff, { surface: 'concrete_asphalt' });
    expect(r.obstacleLabel).toContain('15 m');
  });
});
