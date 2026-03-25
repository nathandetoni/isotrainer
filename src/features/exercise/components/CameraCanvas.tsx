/**
 * features/exercise/components/CameraCanvas.tsx
 * ───────────────────────────────────────────────
 * Renders the live camera feed (via a <video> element) with a <canvas>
 * overlay for pose landmarks, drawn at monitor refresh rate via RAF.
 *
 * Key changes from the Python-sidecar version:
 *   - Accepts `videoRef` instead of `imageData: string` (no more base64 JPEG).
 *   - The <video> element does the heavy lifting; canvas only draws the overlay.
 *   - RAF loop still runs independently of React renders (same perf pattern).
 *   - drawPoseOverlay / drawAngleArc are unchanged.
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
  videoRef:  RefObject<HTMLVideoElement | null>;
  landmarks: LandmarkSet | null;
  status:    PoseStatus;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CameraCanvas = memo(function CameraCanvas({
  videoRef,
  landmarks,
  status,
}: CameraCanvasProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const landmarksRef = useRef<LandmarkSet | null>(landmarks);
  const statusRef    = useRef<PoseStatus>(status);

  // Keep refs in sync so the RAF loop always has fresh values without re-subscribing
  useEffect(() => { landmarksRef.current = landmarks; }, [landmarks]);
  useEffect(() => { statusRef.current = status; }, [status]);

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
      drawPoseOverlay(ctx, lm, statusRef.current, W, H);
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
      {/* Pose overlay canvas — sits on top of the video */}
      <canvas
        ref={canvasRef}
        style={{
          position:  "absolute",
          top:       0,
          left:      0,
          width:     "100%",
          height:    "100%",
          transform: "scaleX(-1)",   // mirror to match video
        }}
      />
    </div>
  );
});

// ── Overlay drawing helpers (unchanged from original) ─────────────────────────

function drawPoseOverlay(
  ctx:    CanvasRenderingContext2D,
  lm:     LandmarkSet,
  status: PoseStatus,
  W:      number,
  H:      number,
): void {
  const color = COLOR[status];
  const px    = (x: number) => x * W;
  const py    = (y: number) => y * H;

  const hip   = { x: px(lm.hip.x),   y: py(lm.hip.y)   };
  const knee  = { x: px(lm.knee.x),  y: py(lm.knee.y)  };
  const ankle = { x: px(lm.ankle.x), y: py(lm.ankle.y) };

  // Hip → Knee → Ankle segment
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(knee.x, knee.y);
  ctx.lineTo(ankle.x, ankle.y);
  ctx.strokeStyle = color;
  ctx.lineWidth   = 4;
  ctx.lineJoin    = "round";
  ctx.stroke();

  // Angle arc at knee
  drawAngleArc(ctx, hip, knee, ankle, color);

  // Landmark circles
  for (const { p, r } of [{ p: hip, r: 7 }, { p: knee, r: 11 }, { p: ankle, r: 7 }]) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle   = color + "cc";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth   = 2;
    ctx.stroke();
  }
}

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
