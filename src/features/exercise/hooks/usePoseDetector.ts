/**
 * features/exercise/hooks/usePoseDetector.ts
 * ─────────────────────────────────────────────
 * Replaces the Python sidecar + usePoseSocket entirely.
 *
 * Responsibilities (mirrors the Python sidecar):
 *   - Camera enumeration via navigator.mediaDevices.enumerateDevices()
 *   - Camera stream via getUserMedia
 *   - MediaPipe PoseLandmarker (tasks-vision) running in VIDEO mode
 *   - Per-frame detection loop via requestAnimationFrame
 *   - Side selection heuristic (left vs right knee visibility) — same as Python
 *   - Angle calculation and classification via core/angle.ts
 *   - Dispatches SET_POSE and SET_CAMERAS to exerciseStore
 *
 * Public API:
 *   { videoRef, start(deviceId), stop(), listCameras() }
 */

import { useEffect, useRef, useCallback, RefObject } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { useExerciseStore } from "../store/exerciseStore";
import { calculateAngle, classifyAngle, AngleStatus } from "../core/angle";
import type { LandmarkSet } from "../../../types/protocol";

// ── MediaPipe landmark indices ────────────────────────────────────────────────
// Same indices as mp.solutions.pose.PoseLandmark in Python

const LM = {
  LEFT_HIP: 23,
  LEFT_KNEE: 25,
  LEFT_ANKLE: 27,
  RIGHT_HIP: 24,
  RIGHT_KNEE: 26,
  RIGHT_ANKLE: 28,
} as const;

const VISIBILITY_THRESHOLD = 0.5; // mirrors Python _VISIBILITY_THRESHOLD

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface PoseDetectorAPI {
  videoRef: RefObject<HTMLVideoElement | null>;
  start: (deviceId: string) => Promise<void>;
  stop: () => void;
  listCameras: () => Promise<void>;
}

export function usePoseDetector(): PoseDetectorAPI {
  const { dispatch } = useExerciseStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const isRunningRef = useRef(false);

  // ── Load MediaPipe model once ─────────────────────────────────────────────

  const ensureLandmarker = useCallback(async (): Promise<PoseLandmarker> => {
    if (landmarkerRef.current) return landmarkerRef.current;

    dispatch({ type: "SET_DETECTOR_STATUS", payload: "loading" });

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );

    // Tauri's embedded WebKit WebView does not expose GPU/WebGL in a way that
    // MediaPipe WASM can use — using "GPU" causes a silent crash that leaves
    // landmarkerRef null and the camera feed blank. We detect Tauri at runtime
    // so the same build works both as a web app (GPU) and as a native app (CPU).
    const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
        delegate: isTauri ? "CPU" : "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    landmarkerRef.current = landmarker;
    return landmarker;
  }, [dispatch]);

  // ── Camera enumeration ─────────────────────────────────────────────────────

  const listCameras = useCallback(async () => {
    // getUserMedia permission is needed before enumerateDevices gives labels
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore — labels may be empty but we still dispatch what we have
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => ({
        deviceId: d.deviceId,
        name: d.label || `Camera ${i}`,
      }));

    dispatch({ type: "SET_CAMERAS", payload: cameras });
  }, [dispatch]);

  // ── Frame detection loop ───────────────────────────────────────────────────

  const processFrame = useCallback((
    landmarker: PoseLandmarker,
    targetAngle: number,
    tolerance: number,
  ) => {
    const video = videoRef.current;
    if (!video || !isRunningRef.current) return;

    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(() =>
        processFrame(landmarker, targetAngle, tolerance),
      );
      return;
    }

    const nowMs = performance.now();
    let result: PoseLandmarkerResult;
    try {
      result = landmarker.detectForVideo(video, nowMs);
    } catch {
      rafRef.current = requestAnimationFrame(() =>
        processFrame(landmarker, targetAngle, tolerance),
      );
      return;
    }

    const pose = result.landmarks?.[0];

    if (!pose || pose.length === 0) {
      dispatch({
        type: "SET_POSE",
        payload: { angle: null, status: AngleStatus.NO_POSE, landmarks: null },
      });
      rafRef.current = requestAnimationFrame(() =>
        processFrame(landmarker, targetAngle, tolerance),
      );
      return;
    }

    // ── Select more-visible leg side (same heuristic as Python) ─────────────
    const visLeft = pose[LM.LEFT_KNEE]?.visibility ?? 0;
    const visRight = pose[LM.RIGHT_KNEE]?.visibility ?? 0;
    const side = visLeft >= visRight ? "left" : "right";

    const hipLm = pose[side === "left" ? LM.LEFT_HIP : LM.RIGHT_HIP];
    const kneeLm = pose[side === "left" ? LM.LEFT_KNEE : LM.RIGHT_KNEE];
    const ankleLm = pose[side === "left" ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE];

    // ── Reject low-confidence landmarks ──────────────────────────────────────
    const minVis = Math.min(
      hipLm?.visibility ?? 0,
      kneeLm?.visibility ?? 0,
      ankleLm?.visibility ?? 0,
    );
    if (minVis < VISIBILITY_THRESHOLD) {
      dispatch({
        type: "SET_POSE",
        payload: { angle: null, status: AngleStatus.LOW_VISIBILITY, landmarks: null },
      });
      rafRef.current = requestAnimationFrame(() =>
        processFrame(landmarker, targetAngle, tolerance),
      );
      return;
    }

    // ── Compute angle ─────────────────────────────────────────────────────────
    const angle = calculateAngle(hipLm, kneeLm, ankleLm);
    if (angle === null) {
      dispatch({
        type: "SET_POSE",
        payload: { angle: null, status: AngleStatus.NO_POSE, landmarks: null },
      });
      rafRef.current = requestAnimationFrame(() =>
        processFrame(landmarker, targetAngle, tolerance),
      );
      return;
    }

    const status = classifyAngle(angle, targetAngle, tolerance);

    // ── Mirror X to match flipped video (same as Python 1.0 - hip_lm.x) ────
    const landmarks: LandmarkSet = {
      hip: { x: 1 - hipLm.x, y: hipLm.y },
      knee: { x: 1 - kneeLm.x, y: kneeLm.y },
      ankle: { x: 1 - ankleLm.x, y: ankleLm.y },
    };

    dispatch({ type: "SET_POSE", payload: { angle, status, landmarks } });

    rafRef.current = requestAnimationFrame(() =>
      processFrame(landmarker, targetAngle, tolerance),
    );
  }, [dispatch]);

  // ── Start ─────────────────────────────────────────────────────────────────

  const start = useCallback(async (deviceId: string) => {
    if (isRunningRef.current) stop();

    try {
      const landmarker = await ensureLandmarker();

      const videoConstraints: MediaTrackConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: 1280, height: 720 }
        : { width: 1280, height: 720 };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      // Attach srcObject before play() — required by all browsers/WebViews.
      video.srcObject = stream;

      // Wait for the video to have enough data before starting the detection
      // loop. We wrap this as a Promise so we can await it cleanly without
      // relying on the `onloadeddata` property assignment racing with play().
      // In Tauri's WebKit WebView the `onloadeddata` callback fires very
      // quickly after srcObject is set; assigning it AFTER play() means the
      // event can be missed entirely.
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = (e: Event | string) => reject(e);

        // play() triggers media loading; we must call it inside the Promise
        // body so the onloadeddata listener is already registered.
        video.play().catch(reject);
      });

      isRunningRef.current = true;
      dispatch({ type: "SET_DETECTOR_STATUS", payload: "running" });

      // Start the per-frame detection loop. Config is read from the global
      // window ref to avoid stale closure captures.
      const runLoop = () => {
        const store = (window as any).__isoTrainerConfig as
          { targetAngle: number; tolerance: number } | undefined;
        processFrame(
          landmarker,
          store?.targetAngle ?? 90,
          store?.tolerance ?? 3,
        );
      };
      runLoop();
    } catch (err) {
      console.error("[PoseDetector] start error:", err);
      dispatch({ type: "SET_DETECTOR_STATUS", payload: "error" });
    }
  }, [ensureLandmarker, processFrame, dispatch]);

  // ── Stop ──────────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    isRunningRef.current = false;
    cancelAnimationFrame(rafRef.current);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }

    dispatch({ type: "SET_DETECTOR_STATUS", payload: "idle" });
    dispatch({
      type: "SET_POSE",
      payload: { angle: null, status: "no_pose", landmarks: null },
    });
  }, [dispatch]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, start, stop, listCameras };
}
