/**
 * features/exercise/hooks/usePoseDetector.ts
 * ─────────────────────────────────────────────
 * Replaces the Python sidecar + usePoseSocket entirely.
 *
 * Responsibilities:
 *   - Camera enumeration via navigator.mediaDevices.enumerateDevices()
 *   - Camera stream via getUserMedia
 *   - MediaPipe PoseLandmarker (tasks-vision) running in VIDEO mode
 *   - Per-frame detection loop via requestAnimationFrame
 *   - Side selection heuristic (left vs right knee visibility)
 *   - Angle calculation and classification via core/angle.ts
 *   - Dispatches SET_POSE / SET_POSE_LANDMARKS to exerciseStore
 *
 * BUG FIX (D): targetAngle and tolerance are now read from refs that sync
 * directly with the store — no more window.__isoTrainerConfig global.
 * This ensures that when ADVANCE_PHASE changes the target angle, the very
 * next frame immediately uses the new value for status classification.
 *
 * Public API: { videoRef, start(deviceId), stop(), listCameras() }
 */

import { useEffect, useRef, useCallback, type RefObject } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { useExerciseStore } from "../store/exerciseStore";
import { calculateAngle, classifyAngle, AngleStatus } from "../core/angle";
import type { LandmarkSet } from "../../../types/protocol";

// ── MediaPipe landmark indices ────────────────────────────────────────────────

const LM = {
  LEFT_HIP:   23,
  LEFT_KNEE:  25,
  LEFT_ANKLE: 27,
  RIGHT_HIP:  24,
  RIGHT_KNEE: 26,
  RIGHT_ANKLE: 28,
} as const;

const VISIBILITY_THRESHOLD = 0.5;

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface PoseDetectorAPI {
  videoRef:    RefObject<HTMLVideoElement | null>;
  start:       (deviceId: string) => Promise<void>;
  stop:        () => void;
  listCameras: () => Promise<void>;
}

export function usePoseDetector(): PoseDetectorAPI {
  const { state, dispatch } = useExerciseStore();

  const videoRef      = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef        = useRef<number>(0);
  const streamRef     = useRef<MediaStream | null>(null);
  const isRunningRef  = useRef(false);

  // Throttle: update displayed angle at most once per second
  const lastAngleDispatchRef = useRef<number>(0);
  const ANGLE_THROTTLE_MS    = 1000;

  // ── FIX D: config refs — always up-to-date, no window global needed ────────
  // These refs are kept in sync with the store and read directly inside
  // processFrame, so phase transitions (ADVANCE_PHASE) take effect on the
  // very next animation frame without any closure staleness.
  const targetAngleRef = useRef(state.config.targetAngle);
  const toleranceRef   = useRef(state.config.tolerance);

  useEffect(() => { targetAngleRef.current = state.config.targetAngle; }, [state.config.targetAngle]);
  useEffect(() => { toleranceRef.current   = state.config.tolerance;   }, [state.config.tolerance]);

  // ── MediaPipe model ───────────────────────────────────────────────────────

  const MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";

  const POSE_OPTIONS = {
    runningMode:                "VIDEO" as const,
    numPoses:                   1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence:  0.5,
    minTrackingConfidence:      0.5,
  };

  // ── Load model (GPU → CPU fallback) ──────────────────────────────────────

  const ensureLandmarker = useCallback(async (): Promise<PoseLandmarker> => {
    if (landmarkerRef.current) return landmarkerRef.current;

    dispatch({ type: "SET_DETECTOR_STATUS", payload: "loading" });

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );

    let landmarker: PoseLandmarker;

    try {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        ...POSE_OPTIONS,
      });
      console.info("[PoseDetector] Using GPU delegate");
    } catch (gpuError) {
      console.warn("[PoseDetector] GPU failed, falling back to CPU:", gpuError);
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        ...POSE_OPTIONS,
      });
      console.info("[PoseDetector] Using CPU delegate (fallback)");
    }

    landmarkerRef.current = landmarker;
    return landmarker;
  }, [dispatch]);

  // ── Camera enumeration ────────────────────────────────────────────────────

  const listCameras = useCallback(async () => {
    try {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach((t) => t.stop());
      } catch {
        console.warn("[PoseDetector] getUserMedia for permissions failed — continuing with enumeration");
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          name:     d.label || `Camera ${i}`,
        }));

      dispatch({ type: "SET_CAMERAS", payload: cameras });
    } catch (err) {
      console.error("[PoseDetector] Camera enumeration failed:", err);
      dispatch({
        type:    "SET_CAMERAS",
        payload: [{ deviceId: "", name: "Câmera padrão" }],
      });
    }
  }, [dispatch]);

  // ── Frame detection loop ──────────────────────────────────────────────────
  // No longer accepts targetAngle/tolerance as parameters — reads from refs
  // so the latest values are always used without re-creating the callback.

  const processFrame = useCallback((landmarker: PoseLandmarker) => {
    const video = videoRef.current;
    if (!video || !isRunningRef.current) return;

    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(() => processFrame(landmarker));
      return;
    }

    const nowMs = performance.now();
    let result: PoseLandmarkerResult;
    try {
      result = landmarker.detectForVideo(video, nowMs);
    } catch {
      rafRef.current = requestAnimationFrame(() => processFrame(landmarker));
      return;
    }

    const pose = result.landmarks?.[0];

    if (!pose || pose.length === 0) {
      dispatch({ type: "SET_POSE", payload: { angle: null, status: AngleStatus.NO_POSE, landmarks: null } });
      rafRef.current = requestAnimationFrame(() => processFrame(landmarker));
      return;
    }

    // ── Select more-visible leg side ─────────────────────────────────────
    const visLeft  = pose[LM.LEFT_KNEE]?.visibility  ?? 0;
    const visRight = pose[LM.RIGHT_KNEE]?.visibility ?? 0;
    const side     = visLeft >= visRight ? "left" : "right";

    const hipLm   = pose[side === "left" ? LM.LEFT_HIP   : LM.RIGHT_HIP];
    const kneeLm  = pose[side === "left" ? LM.LEFT_KNEE  : LM.RIGHT_KNEE];
    const ankleLm = pose[side === "left" ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE];

    // ── Reject low-confidence landmarks ──────────────────────────────────
    const minVis = Math.min(
      hipLm?.visibility   ?? 0,
      kneeLm?.visibility  ?? 0,
      ankleLm?.visibility ?? 0,
    );
    if (minVis < VISIBILITY_THRESHOLD) {
      dispatch({ type: "SET_POSE", payload: { angle: null, status: AngleStatus.LOW_VISIBILITY, landmarks: null } });
      rafRef.current = requestAnimationFrame(() => processFrame(landmarker));
      return;
    }

    // ── Compute angle ─────────────────────────────────────────────────────
    const angle = calculateAngle(hipLm, kneeLm, ankleLm);
    if (angle === null) {
      dispatch({ type: "SET_POSE", payload: { angle: null, status: AngleStatus.NO_POSE, landmarks: null } });
      rafRef.current = requestAnimationFrame(() => processFrame(landmarker));
      return;
    }

    // Read current config from refs — always fresh, even after ADVANCE_PHASE
    const targetAngle = targetAngleRef.current;
    const tolerance   = toleranceRef.current;
    const status      = classifyAngle(angle, targetAngle, tolerance);

    // ── Mirror X to match flipped video ──────────────────────────────────
    const landmarks: LandmarkSet = {
      hip:   { x: 1 - hipLm.x,   y: hipLm.y   },
      knee:  { x: 1 - kneeLm.x,  y: kneeLm.y  },
      ankle: { x: 1 - ankleLm.x, y: ankleLm.y },
    };

    // ── Throttle displayed angle to 1s; landmarks/status update every frame ─
    const shouldUpdateAngle = nowMs - lastAngleDispatchRef.current >= ANGLE_THROTTLE_MS;
    if (shouldUpdateAngle) {
      lastAngleDispatchRef.current = nowMs;
      dispatch({ type: "SET_POSE", payload: { angle, status, landmarks } });
    } else {
      dispatch({ type: "SET_POSE_LANDMARKS", payload: { status, landmarks } });
    }

    rafRef.current = requestAnimationFrame(() => processFrame(landmarker));
  }, [dispatch]);

  // ── Start ─────────────────────────────────────────────────────────────────

  const start = useCallback(async (deviceId: string) => {
    if (isRunningRef.current) stop();

    try {
      const landmarker = await ensureLandmarker();

      const videoConstraints: MediaTrackConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror      = (e: Event | string) => reject(e);
        video.play().catch(reject);
      });

      isRunningRef.current = true;
      dispatch({ type: "SET_DETECTOR_STATUS", payload: "running" });

      // Start the detection loop — no more window global needed
      processFrame(landmarker);
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
    if (video) video.srcObject = null;

    dispatch({ type: "SET_DETECTOR_STATUS", payload: "idle" });
    dispatch({ type: "SET_POSE", payload: { angle: null, status: "no_pose", landmarks: null } });
  }, [dispatch]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => () => { stop(); }, [stop]);

  return { videoRef, start, stop, listCameras };
}
