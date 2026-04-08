/**
 * features/exercise/store/exerciseStore.tsx
 * ─────────────────────────────────────────
 * Global state for the exercise session using React Context + useReducer.
 *
 * Updated for the TypeScript-native MediaPipe migration:
 *   - wsStatus removed → detectorStatus ("idle" | "loading" | "running" | "error")
 *   - LivePoseData.imageData removed (video renders natively via <video> element)
 *   - ExerciseConfig.cameraIndex: number → cameraIndex: string (deviceId)
 *   - CameraDevice now uses { deviceId, name } instead of { index, name }
 */

import React, { createContext, useContext, useReducer, type ReactNode } from "react";
import type { PoseStatus, LandmarkSet, CameraDevice, DetectorStatus } from "../../../types/protocol";

// ── State shape ───────────────────────────────────────────────────────────────

export interface ExerciseConfig {
  targetAngle:      number;  // degrees
  tolerance:        number;  // ± degrees
  exerciseDuration: number;  // seconds
  restDuration:     number;  // seconds
  cameraIndex:      string;  // deviceId (empty string = default/first)
}

export interface LivePoseData {
  angle:     number | null;
  status:    PoseStatus;
  landmarks: LandmarkSet | null;
}

export type TimerPhase = "idle" | "exercise" | "rest";

export interface ExerciseState {
  config:         ExerciseConfig;
  pose:           LivePoseData;
  phase:          TimerPhase;
  seconds:        number;
  cycles:         number;
  cameras:        CameraDevice[];
  detectorStatus: DetectorStatus;
}

// ── Default values ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ExerciseConfig = {
  targetAngle:      90,
  tolerance:        3,
  exerciseDuration: 120,
  restDuration:     120,
  cameraIndex:      "",
};

const DEFAULT_POSE: LivePoseData = {
  angle:     null,
  status:    "no_pose",
  landmarks: null,
};

export const INITIAL_STATE: ExerciseState = {
  config:         DEFAULT_CONFIG,
  pose:           DEFAULT_POSE,
  phase:          "idle",
  seconds:        DEFAULT_CONFIG.restDuration,
  cycles:         0,
  cameras:        [],
  detectorStatus: "idle",
};

// ── Actions ───────────────────────────────────────────────────────────────────

export type ExerciseAction =
  | { type: "SET_CONFIG";          payload: Partial<ExerciseConfig> }
  | { type: "SET_POSE";            payload: LivePoseData }
  | { type: "SET_CAMERAS";         payload: CameraDevice[] }
  | { type: "SET_DETECTOR_STATUS"; payload: DetectorStatus }
  | { type: "SET_PHASE";           payload: TimerPhase }
  | { type: "SET_SECONDS";         payload: number }
  | { type: "INCREMENT_CYCLES" }
  | { type: "RESET_TIMER" };

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: ExerciseState, action: ExerciseAction): ExerciseState {
  switch (action.type) {
    case "SET_CONFIG":
      return { ...state, config: { ...state.config, ...action.payload } };
    case "SET_POSE":
      return { ...state, pose: action.payload };
    case "SET_CAMERAS":
      return { ...state, cameras: action.payload };
    case "SET_DETECTOR_STATUS":
      return { ...state, detectorStatus: action.payload };
    case "SET_PHASE":
      return { ...state, phase: action.payload };
    case "SET_SECONDS":
      return { ...state, seconds: action.payload };
    case "INCREMENT_CYCLES":
      return { ...state, cycles: state.cycles + 1 };
    case "RESET_TIMER":
      return {
        ...state,
        phase:   "idle",
        seconds: state.config.restDuration,
        cycles:  0,
      };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface ExerciseContextValue {
  state:    ExerciseState;
  dispatch: React.Dispatch<ExerciseAction>;
}

const ExerciseContext = createContext<ExerciseContextValue | null>(null);

export function ExerciseProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  return (
    <ExerciseContext.Provider value={{ state, dispatch }}>
      {children}
    </ExerciseContext.Provider>
  );
}

export function useExerciseStore(): ExerciseContextValue {
  const ctx = useContext(ExerciseContext);
  if (!ctx) {
    throw new Error("useExerciseStore must be used inside <ExerciseProvider>");
  }
  return ctx;
}
