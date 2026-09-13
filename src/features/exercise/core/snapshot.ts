/**
 * features/exercise/core/snapshot.ts
 * ───────────────────────────────────
 * Captures a still image of the exercise for angle validation.
 *
 * The image is a composite of:
 *   1. The raw camera frame, mirrored exactly like the on-screen <video>
 *   2. The pose overlay canvas (segments, angle arc, vertical arrow, HUD)
 *   3. A caption strip below the frame (phase, cycle, target angle, date/time)
 *
 * The overlay canvas is sized to videoWidth × videoHeight and its landmarks are
 * pre-mirrored, so drawing it 1:1 over the mirrored frame reproduces the screen.
 */

export interface Snapshot {
  id:       string;
  url:      string;   // object URL — must be revoked when discarded
  blob:     Blob;
  fileName: string;
  caption:  string;
}

const JPEG_QUALITY = 0.92;

export async function captureSnapshot(
  video:    HTMLVideoElement,
  overlay:  HTMLCanvasElement | null,
  caption:  string,
  fileName: string,
): Promise<Snapshot | null> {
  const W = video.videoWidth;
  const H = video.videoHeight;
  if (video.readyState < 2 || W === 0 || H === 0) return null;

  const fontSize = Math.max(14, Math.round(W * 0.018));
  const stripH   = Math.round(fontSize * 2.2);

  const canvas  = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H + stripH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 1. Mirrored camera frame
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, W, H);
  ctx.restore();

  // 2. Pose overlay (already mirrored)
  if (overlay && overlay.width === W && overlay.height === H) {
    ctx.drawImage(overlay, 0, 0);
  }

  // 3. Caption strip
  ctx.fillStyle = "#050c16";
  ctx.fillRect(0, H, W, stripH);
  ctx.font         = `600 ${fontSize}px Barlow, sans-serif`;
  ctx.fillStyle    = "#ffffff";
  ctx.textAlign    = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(caption, fontSize, H + stripH / 2, W - fontSize * 2);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return null;

  return {
    id:  `${Date.now()}-${fileName}`,
    url: URL.createObjectURL(blob),
    blob,
    fileName,
    caption,
  };
}

/** Trigger a browser download for a snapshot (same mechanism as the CSV export). */
export function downloadSnapshot(snapshot: Snapshot): void {
  const a    = document.createElement("a");
  a.href     = snapshot.url;
  a.download = snapshot.fileName;
  a.click();
}

export function revokeSnapshots(snapshots: readonly Snapshot[]): void {
  snapshots.forEach((s) => URL.revokeObjectURL(s.url));
}
