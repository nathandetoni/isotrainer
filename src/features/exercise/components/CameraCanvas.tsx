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
 */

import { useEffect, useRef, useCallback, memo, type RefObject } from "react";
import type { LandmarkSet, PoseStatus } from "../../../types/protocol";

// ── Color palette (matches CSS design tokens) ────────────────────────────────

const COLOR: Record<PoseStatus, string> = {
  on_target:      "#00e5a0",
  above:          "#ffb700",
  below:          "#ffb700",
  no_pose:        "#5a7a8a",
  low_visibility: "#5a7a8a",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface CameraCanvasProps {
  videoRef:   RefObject<HTMLVideoElement | null>;
  landmarks:  LandmarkSet | null;
  status:     PoseStatus;
  angle:      number | null;
  tolerance:  number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CameraCanvas = memo(function CameraCanvas({
  videoRef,
  landmarks,
  status,
  angle,
  tolerance,
}: CameraCanvasProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const landmarksRef = useRef<LandmarkSet | null>(landmarks);
  const statusRef    = useRef<PoseStatus>(status);
  const angleRef     = useRef<number | null>(angle);
  const toleranceRef = useRef<number>(tolerance);

  // Keep refs in sync so the RAF loop always has fresh values without re-subscribing
  useEffect(() => { landmarksRef.current = landmarks; }, [landmarks]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { angleRef.current = angle; }, [angle]);
  useEffect(() => { toleranceRef.current = tolerance; }, [tolerance]);

  // ── RAF render loop ───────────────────────────────────────────────────────

  const rafRef = useRef<number>(0);

  const renderLoop = useCallback(() => {
    rafRef.current = requestAnimationFrame(renderLoop);

    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;

    const W = video.videoWidth;
    const H = video.videoHeight;
    if (W === 0 || H === 0) return;

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width  = W;
      canvas.height = H;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    const lm = landmarksRef.current;
    if (lm) {
      drawPoseOverlay(ctx, lm, statusRef.current, angleRef.current, toleranceRef.current, W, H);
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
          width:     "100%",
          height:    "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",   // mirror horizontally
          display:   "block",
        }}
        playsInline
        muted
      />
      {/* Pose overlay canvas — sits on top of the video.
           No scaleX(-1) here: landmarks are already pre-mirrored
           (x: 1 - rawX) in usePoseDetector, so they match the
           CSS-mirrored video without any extra transform. */}
      <canvas
        ref={canvasRef}
        style={{
          position:  "absolute",
          top:       0,
          left:      0,
          width:     "100%",
          height:    "100%",
        }}
      />
    </div>
  );
});

// ── Overlay drawing helpers ───────────────────────────────────────────────────

function drawPoseOverlay(
  ctx:       CanvasRenderingContext2D,
  lm:        LandmarkSet,
  status:    PoseStatus,
  angle:     number | null,
  tolerance: number,
  W:         number,
  H:         number,
): void {
  const color = COLOR[status];
  const px    = (x: number) => x * W;
  const py    = (y: number) => y * H;

  const hip   = { x: px(lm.hip.x),   y: py(lm.hip.y)   };
  const knee  = { x: px(lm.knee.x),  y: py(lm.knee.y)  };
  const ankle = { x: px(lm.ankle.x), y: py(lm.ankle.y) };

  // ── Hip → Knee → Ankle segment ──────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(knee.x, knee.y);
  ctx.lineTo(ankle.x, ankle.y);
  ctx.strokeStyle = color;
  ctx.lineWidth   = 4;
  ctx.lineJoin    = "round";
  ctx.stroke();

  // ── Angle arc at knee ───────────────────────────────────────────────────
  drawAngleArc(ctx, hip, knee, ankle, color);

  // ── Vertical arrow at knee (professor's desenharSetaVertical) ───────────
  drawVerticalArrow(ctx, knee, ankle, tolerance);

  // ── Landmark circles ────────────────────────────────────────────────────
  for (const { p, r } of [{ p: hip, r: 7 }, { p: knee, r: 11 }, { p: ankle, r: 7 }]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle   = color + "cc";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth   = 2;
    ctx.stroke();
  }

  // ── A / B / C labels ────────────────────────────────────────────────────
  ctx.font         = "bold 14px Barlow, sans-serif";
  ctx.fillStyle    = "#ffffff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("A", hip.x,   hip.y   - 12);
  ctx.fillText("B", knee.x,  knee.y  - 14);
  ctx.fillText("C", ankle.x, ankle.y - 12);

  // ── Large angle overlay near the knee ───────────────────────────────────
  if (angle !== null) {
    drawAngleOverlay(ctx, knee, angle, color, W);
  }
}

// ── Angle arc ─────────────────────────────────────────────────────────────────

function drawAngleArc(
  ctx:   CanvasRenderingContext2D,
  A:     { x: number; y: number },
  B:     { x: number; y: number },
  C:     { x: number; y: number },
  color: string,
): void {
  const ARC_RADIUS = 38;
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
  ctx.lineWidth   = 2;
  ctx.stroke();
}

// ── Vertical arrow (from professor's desenharSetaVertical) ────────────────────

function drawVerticalArrow(
  ctx:       CanvasRenderingContext2D,
  knee:      { x: number; y: number },
  ankle:     { x: number; y: number },
  tolerance: number,
): void {
  const BCx = ankle.x - knee.x;
  const BCy = ankle.y - knee.y;
  const magBC = Math.hypot(BCx, BCy);
  if (magBC === 0) return;

  // Angle between knee→ankle vector and vertical-down (0, -1) in canvas coords
  const cosDeviation = Math.max(-1, Math.min(1, (-BCy) / magBC));
  const deviationDeg = Math.round(Math.acos(cosDeviation) * 180 / Math.PI);
  const isVertical = deviationDeg <= tolerance;

  // Arrow from knee pointing straight up, height proportional to shin length
  const arrowHeight = magBC * 0.9;
  const xArrow = knee.x;
  const yBase  = knee.y;
  const yTop   = knee.y - arrowHeight;
  const arrowColor = "#1db954";

  // Shaft
  ctx.beginPath();
  ctx.moveTo(xArrow, yBase);
  ctx.lineTo(xArrow, yTop);
  ctx.strokeStyle = arrowColor;
  ctx.lineWidth   = isVertical ? 5 : 3;
  ctx.setLineDash(isVertical ? [] : [8, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead triangle
  const tw = isVertical ? 14 : 10;
  ctx.beginPath();
  ctx.moveTo(xArrow, yTop - 10);
  ctx.lineTo(xArrow - tw, yTop + 6);
  ctx.lineTo(xArrow + tw, yTop + 6);
  ctx.closePath();

  if (isVertical) {
    ctx.fillStyle = arrowColor;
    ctx.fill();
  } else {
    ctx.strokeStyle = arrowColor;
    ctx.lineWidth   = 2.5;
    ctx.stroke();
  }
}

// ── Large angle text overlay ──────────────────────────────────────────────────

function drawAngleOverlay(
  ctx:   CanvasRenderingContext2D,
  knee:  { x: number; y: number },
  angle: number,
  color: string,
  W:     number,
): void {
  const text = `${angle}°`;
  // Scale font size relative to canvas width for readability
  const fontSize = Math.max(36, Math.min(72, W * 0.06));

  // Position: to the right and above the knee
  const xPos = knee.x + 60;
  const yPos = knee.y - 30;

  // Semi-transparent background pill
  ctx.font = `bold ${fontSize}px "Share Tech Mono", monospace`;
  const metrics = ctx.measureText(text);
  const padX = 16;
  const padY = 8;
  const bgW = metrics.width + padX * 2;
  const bgH = fontSize + padY * 2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  roundRect(ctx, xPos - padX, yPos - fontSize - padY + 4, bgW, bgH, 10);
  ctx.fill();

  // Text
  ctx.fillStyle    = color;
  ctx.textAlign    = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(text, xPos, yPos + 4);
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

