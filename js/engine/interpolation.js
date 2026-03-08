/**
 * Interpolation engine.
 *
 * Provides 1D linear interpolation with clamping or extrapolation
 * at boundaries.
 */

/**
 * 1D linear interpolation from a sorted array of data points.
 *
 * @param {number[]} xs – Sorted array of x values (independent variable)
 * @param {number[]} ys – Corresponding y values (dependent variable)
 * @param {number} x    – The x value to interpolate at
 * @param {object}  [opts]
 * @param {boolean} [opts.extrapolate=false] – If true, linearly extrapolate
 *        beyond the data range instead of clamping.
 * @returns {{ value: number, clamped: boolean, clampedTo: string|null,
 *             extrapolated: boolean }}
 */
export function interpolate1D(xs, ys, x, opts = {}) {
  if (xs.length !== ys.length || xs.length === 0) {
    return { value: NaN, clamped: false, clampedTo: null };
  }

  if (xs.length === 1) {
    return { value: ys[0], clamped: false, clampedTo: null, extrapolated: false };
  }

  if (x <= xs[0]) {
    if (x < xs[0] && opts.extrapolate) {
      const x0 = xs[0], x1 = xs[1];
      const y0 = ys[0], y1 = ys[1];
      const t = (x - x0) / (x1 - x0);
      return { value: y0 + t * (y1 - y0), clamped: false, clampedTo: null, extrapolated: true };
    }
    return { value: ys[0], clamped: x < xs[0], clampedTo: x < xs[0] ? 'min' : null, extrapolated: false };
  }

  if (x >= xs[xs.length - 1]) {
    if (x > xs[xs.length - 1] && opts.extrapolate) {
      const n = xs.length;
      const x0 = xs[n - 2], x1 = xs[n - 1];
      const y0 = ys[n - 2], y1 = ys[n - 1];
      const t = (x - x0) / (x1 - x0);
      return { value: y0 + t * (y1 - y0), clamped: false, clampedTo: null, extrapolated: true };
    }
    return {
      value: ys[ys.length - 1],
      clamped: x > xs[xs.length - 1],
      clampedTo: x > xs[xs.length - 1] ? 'max' : null,
      extrapolated: false,
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

  return { value, clamped: false, clampedTo: null, extrapolated: false };
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
 * @param {object}   [opts]        – Options passed through to interpolate1D
 * @param {boolean}  [opts.extrapolate=false] – Extrapolate beyond data range
 * @returns {{ value: number, clamped: boolean, clampedTo: string|null,
 *             extrapolated: boolean }}
 */
export function interpolateFromTable(data, variableKey, resultKey, variableValue, getVal, opts) {
  const accessor = getVal || ((obj) => (obj != null && typeof obj === 'object' && 'value' in obj) ? obj.value : obj);

  const sorted = [...data].sort((a, b) => accessor(a[variableKey]) - accessor(b[variableKey]));

  const xs = sorted.map((d) => accessor(d[variableKey]));
  const ys = sorted.map((d) => accessor(d[resultKey]));

  return interpolate1D(xs, ys, variableValue, opts);
}
