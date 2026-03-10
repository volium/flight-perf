import { describe, it, expect } from 'vitest';
import { calculateTakeoff } from '@/calc/takeoff.js';
import { calculateLanding } from '@/calc/landing.js';

// Sling LSA profile subset for testing
const slingProfile = {
  performance: {
    takeoff: {
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
    },
    landing: {
      method: 'reference_table',
      description: 'Landing distances at ISA, MTOW (600 kg)',
      obstacleHeight: { value: 15, unit: 'm', valueFt: 49.2 },
      referenceConditions: {
        weight: { value: 600, unit: 'kg' },
        atmosphere: 'ISA',
        approachSpeed: { value: 65, unit: 'kias' },
      },
      data: [
        {
          surface: 'concrete_asphalt',
          surfaceLabel: 'Concrete / Asphalt',
          groundRoll: { value: 80, unit: 'm', valueFt: 265 },
          totalOverObstacle: { value: 250, unit: 'm', valueFt: 820 },
        },
        {
          surface: 'grass',
          surfaceLabel: 'Grass',
          groundRoll: { value: 80, unit: 'm', valueFt: 265 },
          totalOverObstacle: { value: 250, unit: 'm', valueFt: 820 },
        },
      ],
      corrections: [],
    },
  },
};

// ─── calculateTakeoff ───────────────────────────────────────────────────────

describe('calculateTakeoff', () => {
  it('returns correct distances for paved surface (Sling POH)', () => {
    const r = calculateTakeoff(slingProfile, { surface: 'concrete_asphalt' });
    expect(r.groundRoll.raw).toBe(120);
    expect(r.totalOverObstacle.raw).toBe(230);
    expect(r.method).toBe('reference_table');
  });

  it('returns correct distances for grass surface (Sling POH)', () => {
    const r = calculateTakeoff(slingProfile, { surface: 'grass' });
    expect(r.groundRoll.raw).toBe(140);
    expect(r.totalOverObstacle.raw).toBe(250);
  });

  it('applies margins', () => {
    const margins = {
      groundRoll: { percentage: 25 },
      totalOverObstacle: { percentage: 43 },
    };
    const r = calculateTakeoff(slingProfile, { surface: 'concrete_asphalt', margins });
    expect(r.groundRoll.adjusted).toBe(150); // 120 * 1.25
    expect(r.totalOverObstacle.adjusted).toBeCloseTo(328.9, 0); // 230 * 1.43
  });

  it('converts to ft when requested', () => {
    const r = calculateTakeoff(slingProfile, {
      surface: 'concrete_asphalt',
      distanceUnit: 'ft',
    });
    expect(r.groundRoll.raw).toBe(395);
    expect(r.totalOverObstacle.raw).toBe(755);
  });

  it('returns error when no takeoff data', () => {
    const r = calculateTakeoff({}, { surface: 'concrete_asphalt' });
    expect(r.error).toBeDefined();
  });

  it('returns error for unsupported method', () => {
    const badProfile = {
      performance: { takeoff: { method: 'graph_points', data: [] } },
    };
    const r = calculateTakeoff(badProfile, { surface: 'concrete_asphalt' });
    expect(r.error).toContain('Unsupported');
  });
});

// ─── calculateLanding ───────────────────────────────────────────────────────

describe('calculateLanding', () => {
  it('returns correct distances for paved surface (Sling POH)', () => {
    const r = calculateLanding(slingProfile, { surface: 'concrete_asphalt' });
    expect(r.groundRoll.raw).toBe(80);
    expect(r.totalOverObstacle.raw).toBe(250);
  });

  it('returns correct distances for grass surface (Sling POH)', () => {
    const r = calculateLanding(slingProfile, { surface: 'grass' });
    expect(r.groundRoll.raw).toBe(80);
    expect(r.totalOverObstacle.raw).toBe(250);
  });

  it('returns error when no landing data', () => {
    const r = calculateLanding({}, { surface: 'concrete_asphalt' });
    expect(r.error).toBeDefined();
  });
});
