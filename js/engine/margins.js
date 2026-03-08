/**
 * Safety margin engine.
 *
 * Margins are applied AFTER all performance corrections.
 * Order when combined: factor → percentage → fixed value → rounding.
 */

/**
 * Apply safety margins to a raw performance value.
 *
 * @param {number} raw       – Raw calculated value (e.g., 685 ft)
 * @param {object} [margin]  – Margin configuration
 * @param {number} [margin.factor]     – Multiply by this (e.g., 1.43)
 * @param {number} [margin.percentage] – Add this % (e.g., 25 → +25%)
 * @param {number} [margin.fixed]      – Add this absolute value (e.g., 500)
 * @param {number} [margin.roundUp]    – Round up to nearest N (e.g., 100)
 * @returns {{ raw: number, adjusted: number, marginApplied: boolean, description: string }}
 */
export function applyMargin(raw, margin) {
  if (!margin || !hasActiveMargin(margin)) {
    return { raw, adjusted: raw, marginApplied: false, description: '' };
  }

  let value = raw;
  const parts = [];

  if (margin.factor != null) {
    value = value * margin.factor;
    parts.push(`×${margin.factor}`);
  }

  if (margin.percentage != null) {
    value = value + (raw * margin.percentage) / 100;
    parts.push(`+${margin.percentage}%`);
  }

  if (margin.fixed != null) {
    value = value + margin.fixed;
    parts.push(`+${margin.fixed}`);
  }

  if (margin.roundUp != null && margin.roundUp > 0) {
    value = Math.ceil(value / margin.roundUp) * margin.roundUp;
    parts.push(`↑${margin.roundUp}`);
  }

  return {
    raw,
    adjusted: value,
    marginApplied: true,
    description: parts.join(', '),
  };
}

/**
 * Check whether a margin config has any active values.
 */
export function hasActiveMargin(margin) {
  if (!margin) return false;
  return (
    (margin.factor != null && margin.factor !== 1) ||
    margin.percentage != null ||
    margin.fixed != null ||
    margin.roundUp != null
  );
}

/**
 * Build an empty margin config (no margins applied).
 */
export function emptyMargins() {
  return {
    groundRoll: {},
    totalOverObstacle: {},
  };
}
