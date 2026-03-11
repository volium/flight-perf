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
    return { value: NaN, clamped: false, clampedTo: null, extrapolated: false };
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
  if (x1 === x0) return { value: y0, clamped: false, clampedTo: null, extrapolated: false };
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

/**
 * 2D bilinear interpolation from a flat table of data points
 * using two independent variables.
 *
 * The data is a flat array where each row has both independent variables
 * and the result. This function groups by the first variable, interpolates
 * along the second variable within each group, then interpolates the
 * intermediate results along the first variable.
 *
 * @param {object[]} data  – Flat array of data point objects
 * @param {string} var1Key – Key for the first independent variable (outer, e.g., "pressureAltitude")
 * @param {string} var2Key – Key for the second independent variable (inner, e.g., "rpm")
 * @param {string} resultKey – Key for the dependent variable (e.g., "ktas")
 * @param {number} var1Value – Value for the first variable
 * @param {number} var2Value – Value for the second variable
 * @param {function} [getVal] – Optional accessor for nested values
 * @param {object}   [opts]   – Options passed through to interpolate1D
 * @returns {{ value: number, clamped: boolean, clampedTo: string|null, extrapolated: boolean }}
 */
export function interpolate2D(data, var1Key, var2Key, resultKey, var1Value, var2Value, getVal, opts) {
  const accessor = getVal || ((obj) => (obj != null && typeof obj === 'object' && 'value' in obj) ? obj.value : obj);

  // Get unique sorted values for var1
  const var1Set = [...new Set(data.map((d) => accessor(d[var1Key])))].sort((a, b) => a - b);

  // For each var1 level, interpolate along var2 to get the result at var2Value
  const intermediateXs = [];
  const intermediateYs = [];

  for (const v1 of var1Set) {
    const subset = data.filter((d) => accessor(d[var1Key]) === v1);
    const xs = subset.map((d) => accessor(d[var2Key])).sort((a, b) => a - b);
    const ys = xs.map((x) => {
      const row = subset.find((d) => accessor(d[var2Key]) === x);
      return accessor(row[resultKey]);
    });

    const interp = interpolate1D(xs, ys, var2Value, opts);
    intermediateXs.push(v1);
    intermediateYs.push(interp.value);
  }

  // Now interpolate the intermediate results along var1
  return interpolate1D(intermediateXs, intermediateYs, var1Value, opts);
}

/**
 * 3D trilinear interpolation from a flat table of data points
 * using three independent variables.
 *
 * Groups by the first variable, performs 2D interpolation (var2 × var3)
 * within each group, then interpolates the intermediate results along var1.
 *
 * @param {object[]} data    – Flat array of data point objects
 * @param {string} var1Key   – Key for the first variable (outer, e.g., "weight")
 * @param {string} var2Key   – Key for the second variable (middle, e.g., "pressureAltitude")
 * @param {string} var3Key   – Key for the third variable (inner, e.g., "temperature")
 * @param {string} resultKey – Key for the dependent variable (e.g., "groundRoll")
 * @param {number} var1Value – Value for the first variable
 * @param {number} var2Value – Value for the second variable
 * @param {number} var3Value – Value for the third variable
 * @param {function} [getVal] – Optional accessor for nested values
 * @param {object}   [opts]   – Options passed through to interpolate1D
 * @returns {{ value: number, clamped: boolean, clampedTo: string|null, extrapolated: boolean }}
 */
export function interpolate3D(data, var1Key, var2Key, var3Key, resultKey, var1Value, var2Value, var3Value, getVal, opts) {
  const accessor = getVal || ((obj) => (obj != null && typeof obj === 'object' && 'value' in obj) ? obj.value : obj);

  // Get unique sorted values for var1 (outermost variable)
  const var1Set = [...new Set(data.map((d) => accessor(d[var1Key])))].sort((a, b) => a - b);

  // For each var1 level, perform 2D interpolation on var2 × var3
  const intermediateXs = [];
  const intermediateYs = [];

  for (const v1 of var1Set) {
    const subset = data.filter((d) => accessor(d[var1Key]) === v1);
    const interp2d = interpolate2D(subset, var2Key, var3Key, resultKey, var2Value, var3Value, getVal, opts);
    intermediateXs.push(v1);
    intermediateYs.push(interp2d.value);
  }

  // Interpolate the intermediate results along var1
  return interpolate1D(intermediateXs, intermediateYs, var1Value, opts);
}
