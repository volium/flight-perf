import { describe, it, expect } from 'vitest';
import { applyMargin, emptyMargins } from '@/engine/margins.js';

describe('applyMargin', () => {
  it('returns raw value unchanged when margin is null', () => {
    const r = applyMargin(1000, null);
    expect(r.raw).toBe(1000);
    expect(r.adjusted).toBe(1000);
    expect(r.marginApplied).toBe(false);
    expect(r.description).toBe('');
  });

  it('returns raw value unchanged when margin is undefined', () => {
    const r = applyMargin(1000, undefined);
    expect(r.adjusted).toBe(1000);
    expect(r.marginApplied).toBe(false);
  });

  it('returns raw value unchanged when margin is empty object', () => {
    const r = applyMargin(1000, {});
    expect(r.adjusted).toBe(1000);
    expect(r.marginApplied).toBe(false);
  });

  it('applies percentage only (+25%)', () => {
    const r = applyMargin(1000, { percentage: 25 });
    expect(r.raw).toBe(1000);
    expect(r.adjusted).toBe(1250);
    expect(r.marginApplied).toBe(true);
    expect(r.description).toBe('+25%');
  });

  it('applies fixed value only (+200)', () => {
    const r = applyMargin(1000, { fixed: 200 });
    expect(r.adjusted).toBe(1200);
    expect(r.description).toBe('+200');
  });

  it('applies round-up only (to nearest 100)', () => {
    const r = applyMargin(1237, { roundUp: 100 });
    expect(r.adjusted).toBe(1300);
    expect(r.description).toBe('↑100');
  });

  it('rounds up exact multiples (no change needed)', () => {
    const r = applyMargin(1200, { roundUp: 100 });
    expect(r.adjusted).toBe(1200);
  });

  it('rounds up to nearest 50', () => {
    const r = applyMargin(1237, { roundUp: 50 });
    expect(r.adjusted).toBe(1250);
  });

  it('applies percentage + fixed + roundUp in correct order', () => {
    // Raw: 685
    // +25% → 685 + 171.25 = 856.25
    // +100 → 956.25
    // ↑100 → 1000
    const r = applyMargin(685, { percentage: 25, fixed: 100, roundUp: 100 });
    expect(r.adjusted).toBe(1000);
    expect(r.description).toBe('+25%, +100, ↑100');
  });

  it('FAA AC 91-13C factor simulation: +43% + roundUp 100', () => {
    // Raw: 685 ft ground roll
    // +43% → 685 * 1.43 = 979.55
    // ↑100 → 1000
    const r = applyMargin(685, { percentage: 43, roundUp: 100 });
    expect(r.adjusted).toBe(1000);
  });

  it('handles zero raw value', () => {
    const r = applyMargin(0, { percentage: 25, fixed: 50 });
    expect(r.adjusted).toBe(50); // 0 + 0% + 50
  });

  it('handles roundUp of 0 (no rounding)', () => {
    const r = applyMargin(1237, { roundUp: 0 });
    expect(r.adjusted).toBe(1237);
    expect(r.marginApplied).toBe(false);
  });
});

describe('emptyMargins', () => {
  it('returns object with groundRoll and totalOverObstacle', () => {
    const m = emptyMargins();
    expect(m).toHaveProperty('groundRoll');
    expect(m).toHaveProperty('totalOverObstacle');
    expect(m.groundRoll).toEqual({});
    expect(m.totalOverObstacle).toEqual({});
  });
});
