/**
 * features/exercise/components/CameraCanvas.tsx
 * ───────────────────────────────────────────────
 * Renders the live camera feed (via a <video> element) with a <canvas>
 * overlay for pose landmarks, drawn at monitor refresh rate via RAF.
 *
 * Visual indicators (matched to professor's version):
 *   - Hip → Knee → Ankle segment coloured by status
 *   - Angle arc at the knee vertex
 *   - Vertical arrow at the knee (solid = vertical OK, dashed = off)
 *   - Large angle readout overlaid near the knee
 *   - A / B / C labels on landmark points
 *   - Target angle badge in the top-right corner
 */

import { useEffect, useRef, useCallback, memo, type RefObject } from "react";
import type { LandmarkSet, PoseStatus } from "../../../types/protocol";
import type { TimerPhase } from "../store/exerciseStore";

// ── Color palette (matches CSS design tokens) ────────────────────────────────

const COLOR: Record<PoseStatus, string> = {
  on_target: "#00e5a0",
  above: "#ffb700",
  below: "#ffb700",
  no_pose: "#5a7a8a",
  low_visibility: "#5a7a8a",
};

const PHASE_COLOR: Record<TimerPhase, string> = {
  idle: "#5a7a8a",
  countdown: "#ffb700",
  exercise: "#00e5a0",
  rest: "#ff4455",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface CameraCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  landmarks: LandmarkSet | null;
  status: PoseStatus;
  angle: number | null;
  tolerance: number;
  targetAngle: number;
  phase: TimerPhase;
  seconds: number;   // used for countdown overlay
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CameraCanvas = memo(function CameraCanvas({
  videoRef,
  landmarks,
  status,
  angle,
  tolerance,
  targetAngle,
  phase,
  seconds,
}: CameraCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarksRef = useRef<LandmarkSet | null>(landmarks);
  const statusRef = useRef<PoseStatus>(status);
  const angleRef = useRef<number | null>(angle);
  const toleranceRef = useRef<number>(tolerance);
  const targetRef = useRef<number>(targetAngle);
  const phaseRef = useRef<TimerPhase>(phase);
  const secondsRef = useRef<number>(seconds);

  useEffect(() => { landmarksRef.current = landmarks; }, [landmarks]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { angleRef.current = angle; }, [angle]);
  useEffect(() => { toleranceRef.current = tolerance; }, [tolerance]);
  useEffect(() => { targetRef.current = targetAngle; }, [targetAngle]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);

  // ── RAF render loop ───────────────────────────────────────────────────────

  const rafRef = useRef<number>(0);

  const renderLoop = useCallback(() => {
    rafRef.current = requestAnimationFrame(renderLoop);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;

    const W = video.videoWidth;
    const H = video.videoHeight;
    if (W === 0 || H === 0) return;

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    const lm = landmarksRef.current;
    if (lm) {
      drawPoseOverlay(ctx, lm, statusRef.current, W, H);
    }

    // Countdown overlay — drawn on top of pose, centered on screen
    if (phaseRef.current === "countdown") {
      drawCountdownOverlay(ctx, secondsRef.current, W, H);
    }

    // Top HUD: timer (left) + angle (right) — always visible during session
    const curPhase = phaseRef.current;
    if (curPhase !== "idle") {
      drawTimerHUD(ctx, secondsRef.current, curPhase, W);
      drawAngleHUD(ctx, angleRef.current, statusRef.current, W);
    }
  }, [videoRef]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderLoop]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Live camera feed — mirrored to match natural self-view */}
      <video
        ref={videoRef}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
          display: "block",
        }}
        playsInline
        muted
      />
      {/* Pose overlay canvas — landmarks are pre-mirrored in usePoseDetector */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
});

// ── Overlay drawing helpers ───────────────────────────────────────────────────

function drawPoseOverlay(
  ctx: CanvasRenderingContext2D,
  lm: LandmarkSet,
  status: PoseStatus,
  W: number,
  H: number,
): void {
  const color = COLOR[status];
  const px = (x: number) => x * W;
  const py = (y: number) => y * H;

  const hip = { x: px(lm.hip.x), y: py(lm.hip.y) };
  const knee = { x: px(lm.knee.x), y: py(lm.knee.y) };
  const ankle = { x: px(lm.ankle.x), y: py(lm.ankle.y) };

  // ── Hip → Knee → Ankle segment ──────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(knee.x, knee.y);
  ctx.lineTo(ankle.x, ankle.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;        // was 4
  ctx.lineJoin = "round";
  ctx.stroke();

  // ── Angle arc at knee ───────────────────────────────────────────────────
  drawAngleArc(ctx, hip, knee, ankle, color);

  // ── Vertical arrow at knee ───────────────────────────────────────────────
  drawVerticalArrow(ctx, knee, ankle, W);

  // ── Landmark circles ────────────────────────────────────────────────────
  for (const { p, r } of [{ p: hip, r: 10 }, { p: knee, r: 15 }, { p: ankle, r: 10 }]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color + "cc";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // ── A / B / C labels ────────────────────────────────────────────────────
  const labelSize = Math.max(16, Math.min(26, W * 0.022));
  ctx.font = `bold ${labelSize}px Barlow, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("A", hip.x, hip.y - 14);
  ctx.fillText("B", knee.x, knee.y - 18);
  ctx.fillText("C", ankle.x, ankle.y - 14);

  // Angle readout moved to top-right HUD — no longer drawn near knee
}

// ── Angle arc ─────────────────────────────────────────────────────────────────

function drawAngleArc(
  ctx: CanvasRenderingContext2D,
  A: { x: number; y: number },
  B: { x: number; y: number },
  C: { x: number; y: number },
  color: string,
): void {
  const ARC_RADIUS = 48;   // was 38
  const a1 = Math.atan2(A.y - B.y, A.x - B.x);
  const a2 = Math.atan2(C.y - B.y, C.x - B.x);

  ctx.beginPath();
  ctx.moveTo(B.x, B.y);
  ctx.arc(B.x, B.y, ARC_RADIUS, a1, a2, false);
  ctx.closePath();
  ctx.fillStyle = color + "28";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(B.x, B.y, ARC_RADIUS, a1, a2, false);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

// ── Vertical arrow ────────────────────────────────────────────────────────────
// Perpendicular-to-ground reference arrow drawn from knee downward.
// RED when the shin (BC) is NOT perpendicular — signals correction needed.
// Turns bright GREEN with glow when BC is properly vertical.

function drawVerticalArrow(
  ctx: CanvasRenderingContext2D,
  knee: { x: number; y: number },
  ankle: { x: number; y: number },
  W: number,
): void {
  const BCx = ankle.x - knee.x;
  const BCy = ankle.y - knee.y;
  const magBC = Math.hypot(BCx, BCy);
  if (magBC === 0) return;

  // Deviation from pure vertical (downward = negative Y in screen coords)
  // Uses a dedicated 12° threshold — the config tolerance (typically 3°) is
  // far too strict for this visual indicator and would never trigger green.
  const VERTICAL_TOLERANCE_DEG = 12;
  const cosDeviation = Math.max(-1, Math.min(1, (-BCy) / magBC));
  const deviationDeg = Math.round(Math.acos(cosDeviation) * 180 / Math.PI);
  const isVertical = deviationDeg <= VERTICAL_TOLERANCE_DEG;

  const arrowHeight = magBC * 0.9;
  const xArrow = knee.x;
  const yBase = knee.y;
  const yTop = knee.y - arrowHeight;

  // RED when off-vertical, GREEN when perpendicular
  const colorSolid = isVertical ? "#00e5a0" : "#ff4455";
  const colorFaded = isVertical ? "rgba(0, 229, 160, 0.85)" : "rgba(255, 68, 85, 0.55)";

  // Much thicker shaft for mobile visibility
  const shaftWidth = Math.max(6, W * 0.009);
  const tw = Math.max(18, W * 0.028);          // arrowhead half-width
  const headLen = Math.max(16, W * 0.022);      // arrowhead length

  // ── Shaft ──
  ctx.save();
  if (isVertical) {
    ctx.shadowColor = "#00e5a0";
    ctx.shadowBlur = 18;
  }
  ctx.beginPath();
  ctx.moveTo(xArrow, yBase);
  ctx.lineTo(xArrow, yTop + headLen * 0.5);
  ctx.strokeStyle = isVertical ? colorSolid : colorFaded;
  ctx.lineWidth = isVertical ? shaftWidth + 4 : shaftWidth;
  ctx.lineCap = "round";
  ctx.setLineDash(isVertical ? [] : [14, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── Arrowhead ──
  ctx.save();
  if (isVertical) {
    ctx.shadowColor = "#00e5a0";
    ctx.shadowBlur = 22;
  }
  ctx.beginPath();
  ctx.moveTo(xArrow, yTop - headLen * 0.5);
  ctx.lineTo(xArrow - tw, yTop + headLen * 0.5);
  ctx.lineTo(xArrow + tw, yTop + headLen * 0.5);
  ctx.closePath();

  if (isVertical) {
    // Solid bright green filled arrowhead with white outline
    ctx.fillStyle = colorSolid;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else {
    // Red hollow arrowhead
    ctx.strokeStyle = colorFaded;
    ctx.lineWidth = Math.max(3, W * 0.005);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Countdown overlay (centered on canvas) ──────────────────────────────────

function drawCountdownOverlay(
  ctx: CanvasRenderingContext2D,
  seconds: number,
  W: number,
  H: number,
): void {
  const cx = W / 2;
  const cy = H / 2;

  // Dim background
  ctx.fillStyle = "rgba(0, 0, 0, 0.40)";
  ctx.fillRect(0, 0, W, H);

  // Outer ring
  const ringR = Math.min(W, H) * 0.18;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 183, 0, 0.55)";
  ctx.lineWidth = Math.max(3, ringR * 0.07);
  ctx.stroke();

  // Inner filled circle
  ctx.beginPath();
  ctx.arc(cx, cy, ringR * 0.82, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fill();

  // Number
  const fontSize = Math.max(48, ringR * 1.1);
  ctx.font = `bold ${fontSize}px "Share Tech Mono", monospace`;
  ctx.fillStyle = "#ffb700";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(seconds), cx, cy);

  // "PREPARE-SE" label
  const labelSize = Math.max(12, W * 0.018);
  ctx.font = `700 ${labelSize}px Barlow, sans-serif`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.70)";
  ctx.textBaseline = "top";
  ctx.fillText("PREPARE-SE", cx, cy + ringR * 0.55);
}

// ── Top HUD: Timer (left) ─────────────────────────────────────────────────────
// Displays remaining time and phase label in the top-left corner of the canvas
// so it's visible on mobile where the side panel scrolls out of view.

function formatHUDTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const PHASE_HUD_LABEL: Record<TimerPhase, string> = {
  idle:      "",
  countdown: "PREPARAR",
  exercise:  "EXERCÍCIO",
  rest:      "DESCANSO",
};

function drawTimerHUD(
  ctx: CanvasRenderingContext2D,
  seconds: number,
  phase: TimerPhase,
  W: number,
): void {
  const color = PHASE_COLOR[phase];
  const isMobile = W < 800;
  const margin = Math.max(14, W * 0.016);
  const padding = Math.max(isMobile ? 16 : 12, W * 0.014);
  const radius = 12;

  // ~120% larger fonts on mobile so the HUD is clearly readable over the camera feed
  const valueFontSize = isMobile ? Math.max(64, W * 0.13) : Math.max(32, Math.min(56, W * 0.05));
  const labelFontSize = isMobile ? Math.max(18, W * 0.035) : Math.max(10, Math.min(16, W * 0.013));

  const timeText = formatHUDTime(seconds);
  const label = PHASE_HUD_LABEL[phase];

  // Measure for box sizing
  ctx.font = `bold ${valueFontSize}px "Share Tech Mono", monospace`;
  const valueW = ctx.measureText(timeText).width;
  ctx.font = `700 ${labelFontSize}px Barlow, sans-serif`;
  const labelW = ctx.measureText(label).width;

  const boxW = Math.max(valueW, labelW) + padding * 2;
  const boxH = labelFontSize + valueFontSize + padding * 2.2;
  const x = margin;
  const y = margin;

  // Frosted background with glow
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(4, 12, 22, 0.72)";
  roundRect(ctx, x, y, boxW, boxH, radius);
  ctx.fill();
  ctx.restore();

  // Border
  ctx.strokeStyle = color + "88";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, boxW, boxH, radius);
  ctx.stroke();

  // Phase label
  ctx.font = `700 ${labelFontSize}px Barlow, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + boxW / 2, y + padding * 0.7);

  // Time value
  ctx.font = `bold ${valueFontSize}px "Share Tech Mono", monospace`;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.fillText(timeText, x + boxW / 2, y + padding * 0.7 + labelFontSize + 4);
}

// ── Top HUD: Angle (right) ────────────────────────────────────────────────────
// Shows the current knee angle as a large number in the top-right corner.
// No glow effects — clean and readable, especially on mobile.

function drawAngleHUD(
  ctx: CanvasRenderingContext2D,
  angle: number | null,
  status: PoseStatus,
  W: number,
): void {
  const color = angle !== null ? COLOR[status] : "#5a7a8a";
  const isMobile = W < 800;
  const margin = Math.max(14, W * 0.016);
  const padding = Math.max(isMobile ? 16 : 12, W * 0.014);
  const radius = 12;

  // ~120% larger fonts on mobile so the angle readout is clearly visible
  const valueFontSize = isMobile ? Math.max(68, W * 0.14) : Math.max(36, Math.min(64, W * 0.055));
  const labelFontSize = isMobile ? Math.max(18, W * 0.035) : Math.max(10, Math.min(16, W * 0.013));

  const angleText = angle !== null ? `${angle}°` : "--°";
  const label = "ÂNGULO";

  // Measure
  ctx.font = `bold ${valueFontSize}px "Share Tech Mono", monospace`;
  const valueW = ctx.measureText(angleText).width;
  ctx.font = `700 ${labelFontSize}px Barlow, sans-serif`;
  const labelW = ctx.measureText(label).width;

  const boxW = Math.max(valueW, labelW) + padding * 2;
  const boxH = labelFontSize + valueFontSize + padding * 2.2;
  const x = W - boxW - margin;
  const y = margin;

  // Background
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = "rgba(4, 12, 22, 0.72)";
  roundRect(ctx, x, y, boxW, boxH, radius);
  ctx.fill();
  ctx.restore();

  // Border
  ctx.strokeStyle = color + "88";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, boxW, boxH, radius);
  ctx.stroke();

  // Label
  ctx.font = `700 ${labelFontSize}px Barlow, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + boxW / 2, y + padding * 0.7);

  // Value
  ctx.font = `bold ${valueFontSize}px "Share Tech Mono", monospace`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  ctx.fillText(angleText, x + boxW / 2, y + padding * 0.7 + labelFontSize + 4);
}

// ── Rounded rectangle helper ──────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
