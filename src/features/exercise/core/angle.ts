/**
 * features/exercise/core/angle.ts
 * ──────────────────────────────────
 * Port of backend/core/angle.py and the AngleStatus constants from
 * backend/core/protocol.py.
 *
 * Pure domain logic — no I/O, no React, no external libraries.
 * The dot-product formula matches the original Python (and the old HTML)
 * so all three platforms produce identical angle readings.
 */

// ── Domain types ──────────────────────────────────────────────────────────────

export interface Point2D {
  x: number;
  y: number;
}

export type PoseStatus =
  | "on_target"
  | "above"
  | "below"
  | "no_pose"
  | "low_visibility";

export const AngleStatus = {
  ON_TARGET:      "on_target"      as const,
  ABOVE:          "above"          as const,
  BELOW:          "below"          as const,
  NO_POSE:        "no_pose"        as const,
  LOW_VISIBILITY: "low_visibility" as const,
};

// ── Core computations ──────────────────────────────────────────────────────────

/**
 * Return the interior angle at vertex B formed by segments B→A and B→C,
 * expressed in degrees (0–180).
 *
 * Formula: cos(θ) = (BA · BC) / (‖BA‖ · ‖BC‖)
 *
 * Returns null when either vector has zero magnitude (degenerate case,
 * e.g. all three landmarks overlap).
 */
export function calculateAngle(a: Point2D, b: Point2D, c: Point2D): number | null {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };

  const dot    = ba.x * bc.x + ba.y * bc.y;
  const magBa  = Math.hypot(ba.x, ba.y);
  const magBc  = Math.hypot(bc.x, bc.y);

  if (magBa === 0 || magBc === 0) return null;

  // Clamp to [-1, 1] to guard against floating-point precision errors
  const cosTheta = Math.max(-1, Math.min(1, dot / (magBa * magBc)));
  return Math.round((Math.acos(cosTheta) * 180) / Math.PI);
}

/**
 * Map a raw angle reading to a semantic PoseStatus string.
 *
 * @param angle     Current measured angle in degrees.
 * @param target    Desired (ideal) angle for the exercise.
 * @param tolerance Acceptable deviation (±) in degrees.
 */
export function classifyAngle(
  angle:     number,
  target:    number,
  tolerance: number,
): PoseStatus {
  const delta = Math.abs(angle - target);
  if (delta <= tolerance) return AngleStatus.ON_TARGET;
  return angle > target ? AngleStatus.ABOVE : AngleStatus.BELOW;
}
