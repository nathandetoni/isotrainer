/**
 * types/protocol.ts
 * ─────────────────
 * Shared data types for the exercise feature.
 * Previously defined WebSocket protocol with Python sidecar — now these are
 * purely in-memory TypeScript interfaces (no network protocol involved).
 */

// ── Landmark types ────────────────────────────────────────────────────────────

/** Normalised landmark position (0–1 of frame dimensions). */
export interface LandmarkPixel {
  x: number;
  y: number;
}

/** The three body landmarks used for seat-exercise angle detection. */
export interface LandmarkSet {
  hip:   LandmarkPixel;
  knee:  LandmarkPixel;
  ankle: LandmarkPixel;
}

/** Camera device available on the host machine. */
export interface CameraDevice {
  deviceId: string;
  name:     string;
}

// ── Angle status ──────────────────────────────────────────────────────────────

export type PoseStatus =
  | "on_target"
  | "above"
  | "below"
  | "no_pose"
  | "low_visibility";

// ── Detector status ───────────────────────────────────────────────────────────

export type DetectorStatus = "idle" | "loading" | "running" | "error";
