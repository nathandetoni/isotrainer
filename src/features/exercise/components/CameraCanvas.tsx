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
      drawPoseOverlay(ctx, lm, statusRef.current, angleRef.current, toleranceRef.current, W, H);
    }

    // Countdown overlay — drawn on top of pose, centered on screen
    if (phaseRef.current === "countdown") {
      drawCountdownOverlay(ctx, secondsRef.current, W, H);
    }

    // Always draw the target angle badge (even when no pose detected)
    drawTargetBadge(ctx, targetRef.current, phaseRef.current, W);
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
  angle: number | null,
  tolerance: number,
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
  drawVerticalArrow(ctx, knee, ankle, tolerance, W);

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

  // ── Large angle overlay near the knee ───────────────────────────────────
  if (angle !== null) {
    drawAngleOverlay(ctx, knee, angle, color, W);
  }
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

function drawVerticalArrow(
  ctx: CanvasRenderingContext2D,
  knee: { x: number; y: number },
  ankle: { x: number; y: number },
  tolerance: number,
  W: number,
): void {
  const BCx = ankle.x - knee.x;
  const BCy = ankle.y - knee.y;
  const magBC = Math.hypot(BCx, BCy);
  if (magBC === 0) return;

  const cosDeviation = Math.max(-1, Math.min(1, (-BCy) / magBC));
  const deviationDeg = Math.round(Math.acos(cosDeviation) * 180 / Math.PI);
  const isVertical = deviationDeg <= tolerance;

  const arrowHeight = magBC * 0.9;
  const xArrow = knee.x;
  const yBase = knee.y;
  const yTop = knee.y - arrowHeight;
  const arrowColor = "#1db954";

  // Scale arrow width relative to canvas width for mobile
  const shaftWidth = Math.max(4, W * 0.005);
  const tw = Math.max(12, W * 0.018);   // arrowhead width

  ctx.beginPath();
  ctx.moveTo(xArrow, yBase);
  ctx.lineTo(xArrow, yTop);
  ctx.strokeStyle = arrowColor;
  ctx.lineWidth = isVertical ? shaftWidth + 2 : shaftWidth;
  ctx.setLineDash(isVertical ? [] : [10, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(xArrow, yTop - 12);
  ctx.lineTo(xArrow - tw, yTop + 8);
  ctx.lineTo(xArrow + tw, yTop + 8);
  ctx.closePath();

  if (isVertical) {
    ctx.fillStyle = arrowColor;
    ctx.fill();
  } else {
    ctx.strokeStyle = arrowColor;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

// ── Large angle text overlay ──────────────────────────────────────────────────

function drawAngleOverlay(
  ctx: CanvasRenderingContext2D,
  knee: { x: number; y: number },
  angle: number,
  color: string,
  W: number,
): void {
  const text = `${angle}°`;
  // Bigger font: min 48px, max 96px (was 36..72)
  const fontSize = Math.max(48, Math.min(96, W * 0.09));

  const xPos = knee.x + 70;
  const yPos = knee.y - 30;

  ctx.font = `bold ${fontSize}px "Share Tech Mono", monospace`;
  const metrics = ctx.measureText(text);
  const padX = 18;
  const padY = 10;
  const bgW = metrics.width + padX * 2;
  const bgH = fontSize + padY * 2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.50)";
  roundRect(ctx, xPos - padX, yPos - fontSize - padY + 4, bgW, bgH, 12);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(text, xPos, yPos + 4);
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

// ── Target angle badge (top-right corner) ─────────────────────────────────────

function drawTargetBadge(
  ctx: CanvasRenderingContext2D,
  targetAngle: number,
  phase: TimerPhase,
  W: number,
): void {
  if (phase === "idle") return;

  const color = PHASE_COLOR[phase];
  const fontSize = Math.max(24, Math.min(46, W * 0.038));

  const label = "ALVO";
  const value = `${targetAngle}°`;
  const padding = Math.max(14, W * 0.018);
  const margin = Math.max(14, W * 0.016);
  const radius = 12;

  // Measure texts for box sizing
  ctx.font = `700 ${fontSize * 0.55}px Barlow, sans-serif`;
  const labelW = ctx.measureText(label).width;

  ctx.font = `bold ${fontSize * 1.55}px "Share Tech Mono", monospace`;
  const valueW = ctx.measureText(value).width;

  const boxW = Math.max(labelW, valueW) + padding * 2;
  const boxH = fontSize * 3.6;
  const x = W - boxW - margin;   // top-right
  const y = margin;

  // ── Glow halo ──
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;

  // Frosted-glass background
  ctx.fillStyle = "rgba(4, 12, 22, 0.72)";
  roundRect(ctx, x, y, boxW, boxH, radius);
  ctx.fill();
  ctx.restore();

  // ── Border ──
  ctx.strokeStyle = color + "bb";
  ctx.lineWidth = 2.5;
  roundRect(ctx, x, y, boxW, boxH, radius);
  ctx.stroke();

  // ── Top accent bar (phase color) ──
  const barH = Math.max(3, fontSize * 0.08);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + boxW - radius, y);
  ctx.arcTo(x + boxW, y, x + boxW, y + radius, radius);
  ctx.lineTo(x + boxW, y + barH);
  ctx.lineTo(x, y + barH);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fill();

  // ── Label ──
  ctx.font = `700 ${fontSize * 0.55}px Barlow, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + boxW / 2, y + barH + padding * 0.55);

  // ── Value with glow ──
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.font = `bold ${fontSize * 1.55}px "Share Tech Mono", monospace`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  ctx.fillText(value, x + boxW / 2, y + barH + padding * 0.55 + fontSize * 0.72);
  ctx.restore();
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
