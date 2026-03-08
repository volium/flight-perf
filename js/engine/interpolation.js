/**
 * Interpolation engine.
 *
 * Provides 1D linear interpolation with clamping at boundaries.
 */

/**
 * 1D linear interpolation from a sorted array of data points.
 *
 * @param {number[]} xs – Sorted array of x values (independent variable)
 * @param {number[]} ys – Corresponding y values (dependent variable)
 * @param {number} x    – The x value to interpolate at
 * @returns {{ value: number, clamped: boolean, clampedTo: string|null }}
 */
export function interpolate1D(xs, ys, x) {
  if (xs.length !== ys.length || xs.length === 0) {
    return { value: NaN, clamped: false, clampedTo: null };
  }

  if (xs.length === 1) {
    return { value: ys[0], clamped: false, clampedTo: null };
  }

  if (x <= xs[0]) {
    return { value: ys[0], clamped: x < xs[0], clampedTo: x < xs[0] ? 'min' : null };
  }

  if (x >= xs[xs.length - 1]) {
    return {
      value: ys[ys.length - 1],
      clamped: x > xs[xs.length - 1],
      clampedTo: x > xs[xs.length - 1] ? 'max' : null,
    };
  }

  // Find the bracketing interval
  let i = 0;
  while (i < xs.length - 1 && xs[i + 1] < x) {
    i++;
  }

  const x0 = xs[i], x1 = xs[i + 1];
  const y0 = ys[i], y1 = ys[i + 1];
  const t = (x - x0) / (x1 - x0);
  const value = y0 + t * (y1 - y0);

  return { value, clamped: false, clampedTo: null };
}

/**
 * Interpolate a single result field from a table of data points
 * using one independent variable.
 *
 * @param {object[]} data          – Array of data point objects
 * @param {string} variableKey     – Key for the independent variable (e.g., "pressureAltitude")
 * @param {string} resultKey       – Key for the dependent variable (e.g., "rateOfClimb")
 * @param {number} variableValue   – Value to interpolate at
 * @param {function} [getVal]      – Optional accessor for nested values; defaults to (obj) => obj.value ?? obj
 * @returns {{ value: number, clamped: boolean, clampedTo: string|null }}
 */
export function interpolateFromTable(data, variableKey, resultKey, variableValue, getVal) {
  const accessor = getVal || ((obj) => (obj != null && typeof obj === 'object' && 'value' in obj) ? obj.value : obj);

  const sorted = [...data].sort((a, b) => accessor(a[variableKey]) - accessor(b[variableKey]));

  const xs = sorted.map((d) => accessor(d[variableKey]));
  const ys = sorted.map((d) => accessor(d[resultKey]));

  return interpolate1D(xs, ys, variableValue);
}
