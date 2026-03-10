import { describe, it, expect } from 'vitest';
import {
  pressureAltitude,
  isaTemperature,
  densityAltitude,
  isaDeviation,
  densityRatio,
  calculateDensityAltitude,
} from '@/calc/density-altitude.js';

// ─── pressureAltitude ───────────────────────────────────────────────────────

describe('pressureAltitude', () => {
  it('sea level with standard pressure → 0 ft', () => {
    expect(pressureAltitude(0, 29.92)).toBe(0);
  });

  it('sea level with low pressure (29.72) → +200 ft', () => {
    expect(pressureAltitude(0, 29.72)).toBeCloseTo(200, 0);
  });

  it('sea level with high pressure (30.12) → -200 ft', () => {
    expect(pressureAltitude(0, 30.12)).toBeCloseTo(-200, 0);
  });

  it('5000 ft field with standard pressure → 5000 ft', () => {
    expect(pressureAltitude(5000, 29.92)).toBe(5000);
  });

  it('5000 ft field with 29.42 inHg → 5500 ft', () => {
    expect(pressureAltitude(5000, 29.42)).toBeCloseTo(5500, 0);
  });
});

// ─── isaTemperature ─────────────────────────────────────────────────────────

describe('isaTemperature', () => {
  it('sea level ISA = 15°C', () => {
    expect(isaTemperature(0)).toBe(15);
  });

  it('1000 ft ISA = 13°C', () => {
    expect(isaTemperature(1000)).toBe(13);
  });

  it('5000 ft ISA = 5°C', () => {
    expect(isaTemperature(5000)).toBe(5);
  });

  it('10000 ft ISA = -5°C', () => {
    expect(isaTemperature(10000)).toBe(-5);
  });

  it('lapse rate is 2°C per 1000 ft', () => {
    const diff = isaTemperature(0) - isaTemperature(1000);
    expect(diff).toBe(2);
  });
});

// ─── densityAltitude ────────────────────────────────────────────────────────

describe('densityAltitude', () => {
  it('standard conditions at sea level: DA = 0 ft', () => {
    expect(densityAltitude(0, 15)).toBe(0);
  });

  it('standard conditions at 5000 ft: DA = 5000 ft', () => {
    expect(densityAltitude(5000, 5)).toBe(5000); // ISA at 5000 = 5°C
  });

  it('hot day at sea level (30°C): DA > PA', () => {
    // PA=0, OAT=30°C, ISA=15°C, deviation=+15
    // DA = 0 + 120 * 15 = 1800
    const da = densityAltitude(0, 30);
    expect(da).toBe(1800);
    expect(da).toBeGreaterThan(0);
  });

  it('cold day at sea level (0°C): DA < PA', () => {
    // PA=0, OAT=0°C, ISA=15°C, deviation=-15
    // DA = 0 + 120 * (-15) = -1800
    const da = densityAltitude(0, 0);
    expect(da).toBe(-1800);
    expect(da).toBeLessThan(0);
  });

  it('hot day at 5000 ft (25°C): DA well above PA', () => {
    // ISA at 5000 = 5°C, deviation = 20
    // DA = 5000 + 120 * 20 = 7400
    const da = densityAltitude(5000, 25);
    expect(da).toBe(7400);
  });
});

// ─── isaDeviation ───────────────────────────────────────────────────────────

describe('isaDeviation', () => {
  it('standard temperature → 0 deviation', () => {
    expect(isaDeviation(0, 15)).toBe(0);
    expect(isaDeviation(5000, 5)).toBe(0);
  });

  it('+10°C above ISA at sea level', () => {
    expect(isaDeviation(0, 25)).toBe(10);
  });

  it('-5°C below ISA at 5000 ft', () => {
    expect(isaDeviation(5000, 0)).toBe(-5);
  });
});

// ─── densityRatio ───────────────────────────────────────────────────────────

describe('densityRatio', () => {
  it('sea level ISA: σ ≈ 1.0', () => {
    expect(densityRatio(0)).toBeCloseTo(1.0, 2);
  });

  it('σ decreases with altitude', () => {
    const sigma5k = densityRatio(5000);
    const sigma10k = densityRatio(10000);
    expect(sigma5k).toBeLessThan(1.0);
    expect(sigma10k).toBeLessThan(sigma5k);
  });

  it('σ at 5000 ft DA ≈ 0.86', () => {
    expect(densityRatio(5000)).toBeCloseTo(0.8617, 2);
  });
});

// ─── calculateDensityAltitude (full calculation) ────────────────────────────

describe('calculateDensityAltitude', () => {
  it('standard sea level conditions (imperial)', () => {
    const r = calculateDensityAltitude({
      fieldElevation: 0,
      elevUnit: 'ft',
      altimeter: 29.92,
      altimeterUnit: 'inHg',
      oat: 15,
      tempUnit: 'C',
    });
    expect(r.pressureAltitude).toBe(0);
    expect(r.densityAltitude).toBe(0);
    expect(r.isaTemperature).toBe(15);
    expect(r.isaDeviation).toBe(0);
    expect(r.densityRatio).toBeCloseTo(1.0, 2);
  });

  it('metric elevation input (1524 m ≈ 5000 ft)', () => {
    const r = calculateDensityAltitude({
      fieldElevation: 1524,
      elevUnit: 'm',
      altimeter: 29.92,
      altimeterUnit: 'inHg',
      oat: 5,
      tempUnit: 'C',
    });
    expect(r.pressureAltitude).toBeCloseTo(5000, -1);
    expect(r.densityAltitude).toBeCloseTo(5000, -1);
  });

  it('hPa altimeter input (1013.25 hPa = 29.92 inHg)', () => {
    const r = calculateDensityAltitude({
      fieldElevation: 0,
      elevUnit: 'ft',
      altimeter: 1013.25,
      altimeterUnit: 'hPa',
      oat: 15,
      tempUnit: 'C',
    });
    expect(r.pressureAltitude).toBeCloseTo(0, -1);
    expect(r.altimeterInHg).toBeCloseTo(29.92, 1);
  });

  it('Fahrenheit temperature input (59°F = 15°C)', () => {
    const r = calculateDensityAltitude({
      fieldElevation: 0,
      elevUnit: 'ft',
      altimeter: 29.92,
      altimeterUnit: 'inHg',
      oat: 59,
      tempUnit: 'F',
    });
    expect(r.oatC).toBeCloseTo(15, 0);
    expect(r.densityAltitude).toBeCloseTo(0, -1);
  });

  it('includes both °C and °F in output', () => {
    const r = calculateDensityAltitude({
      fieldElevation: 0,
      elevUnit: 'ft',
      altimeter: 29.92,
      altimeterUnit: 'inHg',
      oat: 15,
      tempUnit: 'C',
    });
    expect(r.oatC).toBe(15);
    expect(r.oatF).toBe(59);
  });

  it('includes both inHg and hPa in output', () => {
    const r = calculateDensityAltitude({
      fieldElevation: 0,
      elevUnit: 'ft',
      altimeter: 29.92,
      altimeterUnit: 'inHg',
      oat: 15,
      tempUnit: 'C',
    });
    expect(r.altimeterInHg).toBe(29.92);
    expect(r.altimeterHPa).toBeCloseTo(1013.2, 0);
  });
});
