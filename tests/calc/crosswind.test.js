import { describe, it, expect } from 'vitest';
import { calculateWindComponents, calculateCrosswind } from '@/calc/crosswind.js';

// ─── calculateWindComponents ────────────────────────────────────────────────

describe('calculateWindComponents', () => {
  it('direct headwind: wind aligned with runway → full headwind, zero crosswind', () => {
    // Wind from 360°, runway 36 (360°)
    const r = calculateWindComponents(360, 10, 360);
    expect(r.headwind).toBeCloseTo(10, 0);
    expect(r.crosswind).toBeCloseTo(0, 0);
    expect(r.isHeadwind).toBe(true);
    expect(r.isTailwind).toBe(false);
  });

  it('direct tailwind: wind from opposite direction → negative headwind', () => {
    // Wind from 180°, runway 36 (360°)
    const r = calculateWindComponents(180, 10, 360);
    expect(r.headwind).toBeCloseTo(-10, 0);
    expect(r.tailwind).toBeCloseTo(10, 0);
    expect(r.isTailwind).toBe(true);
  });

  it('pure left crosswind: wind 90° left of runway', () => {
    // Wind from 270°, runway 36 (360°)
    const r = calculateWindComponents(270, 10, 360);
    expect(Math.abs(r.headwind)).toBeLessThan(0.5);
    expect(r.crosswind).toBeCloseTo(10, 0);
    expect(r.crosswindDirection).toBe('left');
  });

  it('pure right crosswind: wind 90° right of runway', () => {
    // Wind from 090°, runway 36 (360°)
    const r = calculateWindComponents(90, 10, 360);
    expect(Math.abs(r.headwind)).toBeLessThan(0.5);
    expect(r.crosswind).toBeCloseTo(10, 0);
    expect(r.crosswindDirection).toBe('right');
  });

  it('45° angle: equal headwind and crosswind components', () => {
    // Wind from 315° (45° left of 360), 10 kt
    const r = calculateWindComponents(315, 10, 360);
    const expected = 10 * Math.cos(Math.PI / 4); // ≈ 7.07
    expect(r.headwind).toBeCloseTo(expected, 0);
    expect(r.crosswind).toBeCloseTo(expected, 0);
  });

  it('calm wind: all components zero', () => {
    const r = calculateWindComponents(0, 0, 360);
    expect(r.headwind).toBe(0);
    expect(r.crosswind).toBe(0);
    expect(r.tailwind).toBe(0);
  });

  it('wraps angles correctly (wind 010°, runway 350°)', () => {
    // 20° offset → mostly headwind
    const r = calculateWindComponents(10, 10, 350);
    expect(r.headwind).toBeCloseTo(10 * Math.cos(20 * Math.PI / 180), 0);
  });

  it('normalizes angle to 0-360 range', () => {
    const r = calculateWindComponents(270, 10, 360);
    expect(r.angleNormalized).toBeGreaterThanOrEqual(0);
    expect(r.angleNormalized).toBeLessThan(360);
  });
});

// ─── calculateCrosswind (full calculation) ──────────────────────────────────

describe('calculateCrosswind', () => {
  it('returns steady wind components', () => {
    const r = calculateCrosswind({
      windDirection: 270,
      windSpeed: 15,
      windSpeedUnit: 'kt',
      runwayHeading: 360,
    });
    expect(r.steady.headwind).toBeDefined();
    expect(r.steady.crosswind).toBeDefined();
    expect(r.windSpeedKt).toBe(15);
  });

  it('returns null gust when no gust provided', () => {
    const r = calculateCrosswind({
      windDirection: 270,
      windSpeed: 15,
      windSpeedUnit: 'kt',
      runwayHeading: 360,
    });
    expect(r.gust).toBeNull();
    expect(r.gustSpeedKt).toBeNull();
  });

  it('includes gust components when gust speed provided', () => {
    const r = calculateCrosswind({
      windDirection: 270,
      windSpeed: 15,
      windSpeedUnit: 'kt',
      runwayHeading: 360,
      gustSpeed: 25,
    });
    expect(r.gust).not.toBeNull();
    expect(r.gustSpeedKt).toBe(25);
    expect(r.gust.crosswind).toBeGreaterThan(r.steady.crosswind);
  });

  it('converts km/h to kt', () => {
    const r = calculateCrosswind({
      windDirection: 270,
      windSpeed: 27.78, // ~15 kt
      windSpeedUnit: 'kmh',
      runwayHeading: 360,
    });
    expect(r.windSpeedKt).toBeCloseTo(15, 0);
  });

  it('computes reciprocal runway heading', () => {
    const r = calculateCrosswind({
      windDirection: 270,
      windSpeed: 15,
      windSpeedUnit: 'kt',
      runwayHeading: 360,
    });
    expect(r.reciprocalHeading).toBe(180);
    expect(r.reciprocal).toBeDefined();
  });

  it('crosswindStatus = "ok" when below limit', () => {
    const r = calculateCrosswind({
      windDirection: 270,
      windSpeed: 10,
      windSpeedUnit: 'kt',
      runwayHeading: 360,
      maxCrosswind: 15, // Sling LSA max crosswind
    });
    expect(r.crosswindStatus).toBe('ok');
  });

  it('crosswindStatus = "caution" when near limit (>80%)', () => {
    // Pure crosswind of 13 kt, limit 15 → 87% → caution
    const r = calculateCrosswind({
      windDirection: 270,
      windSpeed: 13,
      windSpeedUnit: 'kt',
      runwayHeading: 360,
      maxCrosswind: 15,
    });
    expect(r.crosswindStatus).toBe('caution');
  });

  it('crosswindStatus = "exceeds" when above limit', () => {
    const r = calculateCrosswind({
      windDirection: 270,
      windSpeed: 20,
      windSpeedUnit: 'kt',
      runwayHeading: 360,
      maxCrosswind: 15,
    });
    expect(r.crosswindStatus).toBe('exceeds');
  });

  it('uses gust crosswind for status check when gusts present', () => {
    // Steady 10 kt crosswind (ok), gust 20 kt crosswind (exceeds)
    const r = calculateCrosswind({
      windDirection: 270,
      windSpeed: 10,
      windSpeedUnit: 'kt',
      runwayHeading: 360,
      gustSpeed: 20,
      maxCrosswind: 15,
    });
    expect(r.crosswindStatus).toBe('exceeds');
  });
});
