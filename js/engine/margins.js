/**
 * Safety margin engine.
 *
 * Margins are applied AFTER all performance corrections.
 * Order when combined: percentage → fixed value → rounding.
 */

/**
 * Apply safety margins to a raw performance value.
 *
 * @param {number} raw       – Raw calculated value (e.g., 685 ft)
 * @param {object} [margin]  – Margin configuration
 * @param {number} [margin.percentage] – Add this % (e.g., 25 → +25%)
 * @param {number} [margin.fixed]      – Add this absolute value (e.g., 500)
 * @param {number} [margin.roundUp]    – Round up to nearest N (e.g., 100)
 * @returns {{ raw: number, adjusted: number, marginApplied: boolean, description: string }}
 */
export function applyMargin(raw, margin) {
  if (!margin) return noMargin(raw);

  const hasPct = margin.percentage != null;
  const hasFixed = margin.fixed != null;
  const hasRound = margin.roundUp != null && margin.roundUp > 0;

  if (!hasPct && !hasFixed && !hasRound) return noMargin(raw);

  let value = raw;
  const parts = [];

  if (hasPct) {
    value = value + (raw * margin.percentage) / 100;
    parts.push(`+${margin.percentage}%`);
  }

  if (hasFixed) {
    value = value + margin.fixed;
    parts.push(`+${margin.fixed}`);
  }

  if (hasRound) {
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

function noMargin(raw) {
  return { raw, adjusted: raw, marginApplied: false, description: '' };
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
