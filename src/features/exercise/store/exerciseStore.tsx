/**
 * features/exercise/store/exerciseStore.tsx
 * ─────────────────────────────────────────
 * Global state for the exercise session using React Context + useReducer.
 *
 * Updated for the training protocol system (v7):
 *   - Protocols define ordered phases with individual target angles
 *   - Timer cycles through phases, updating the target angle per phase
 *   - phaseIndex tracks the current position within the protocol
 *   - targetCycles / completedCycles track protocol completion
 */

import React, { createContext, useContext, useReducer, type ReactNode } from "react";
import type { PoseStatus, LandmarkSet, CameraDevice, DetectorStatus } from "../../../types/protocol";
import type { TrainingProtocol } from "./protocolStore";

// ── State shape ───────────────────────────────────────────────────────────────

export interface ExerciseConfig {
  targetAngle:      number;  // degrees (updated dynamically per phase)
  tolerance:        number;  // ± degrees
  exerciseDuration: number;  // seconds (default, overridden by protocol)
  restDuration:     number;  // seconds (default, overridden by protocol)
  cameraIndex:      string;  // deviceId (empty string = default/first)
}

export interface LivePoseData {
  angle:     number | null;
  status:    PoseStatus;
  landmarks: LandmarkSet | null;
}

export type TimerPhase = "idle" | "countdown" | "exercise" | "rest";

export interface ExerciseState {
  config:           ExerciseConfig;
  pose:             LivePoseData;
  phase:            TimerPhase;
  seconds:          number;
  cycles:           number;
  cameras:          CameraDevice[];
  detectorStatus:   DetectorStatus;
  // Protocol support
  activeProtocol:   TrainingProtocol | null;
  phaseIndex:       number;         // index within protocol.fases[]
  targetCycles:     number;         // protocol.ciclos
  completed:        boolean;        // true when all cycles finished
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
  config:           DEFAULT_CONFIG,
  pose:             DEFAULT_POSE,
  phase:            "idle",
  seconds:          DEFAULT_CONFIG.restDuration,
  cycles:           0,
  cameras:          [],
  detectorStatus:   "idle",
  activeProtocol:   null,
  phaseIndex:       0,
  targetCycles:     10,
  completed:        false,
};

// ── Actions ───────────────────────────────────────────────────────────────────

export type ExerciseAction =
  | { type: "SET_CONFIG";          payload: Partial<ExerciseConfig> }
  | { type: "SET_POSE";            payload: LivePoseData }
  | { type: "SET_POSE_LANDMARKS"; payload: { status: PoseStatus; landmarks: LandmarkSet | null } }
  | { type: "SET_CAMERAS";         payload: CameraDevice[] }
  | { type: "SET_DETECTOR_STATUS"; payload: DetectorStatus }
  | { type: "SET_PHASE";           payload: TimerPhase }
  | { type: "SET_SECONDS";         payload: number }
  | { type: "INCREMENT_CYCLES" }
  | { type: "RESET_TIMER" }
  | { type: "SET_ACTIVE_PROTOCOL"; payload: TrainingProtocol | null }
  | { type: "ADVANCE_PHASE" }
  | { type: "SET_COMPLETED";       payload: boolean };

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: ExerciseState, action: ExerciseAction): ExerciseState {
  switch (action.type) {
    case "SET_CONFIG":
      return { ...state, config: { ...state.config, ...action.payload } };
    case "SET_POSE":
      return { ...state, pose: action.payload };
    case "SET_POSE_LANDMARKS":
      // Update landmarks+status every frame but keep angle frozen (throttled to 1s)
      return { ...state, pose: { ...state.pose, status: action.payload.status, landmarks: action.payload.landmarks } };
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
        phase:      "idle",
        seconds:    getFirstPhaseDuration(state),
        cycles:     0,
        phaseIndex: 0,
        completed:  false,
      };
    case "SET_ACTIVE_PROTOCOL": {
      const proto = action.payload;
      if (!proto) {
        return {
          ...state,
          activeProtocol: null,
          targetCycles: 10,
          phaseIndex: 0,
        };
      }
      const firstPhase = proto.fases[0];
      return {
        ...state,
        activeProtocol: proto,
        targetCycles: proto.ciclos,
        phaseIndex: 0,
        config: {
          ...state.config,
          targetAngle: firstPhase?.angulo ?? 90,
        },
        seconds: firstPhase?.tempo ?? 120,
      };
    }
    case "ADVANCE_PHASE": {
      const proto = state.activeProtocol;
      if (!proto || proto.fases.length === 0) return state;
      const nextIdx = state.phaseIndex + 1;
      const totalFases = proto.fases.length;

      // Check if we completed a full cycle
      let newCycles = state.cycles;
      if (nextIdx % totalFases === 0) {
        newCycles = state.cycles + 1;
      }

      // Check if all cycles completed
      if (newCycles >= state.targetCycles) {
        return {
          ...state,
          cycles: newCycles,
          completed: true,
          phase: "idle",
        };
      }

      const nextPhase = proto.fases[nextIdx % totalFases];
      return {
        ...state,
        phaseIndex: nextIdx,
        cycles: newCycles,
        phase: nextPhase.descanso ? "rest" : "exercise",
        seconds: nextPhase.tempo,
        config: {
          ...state.config,
          targetAngle: nextPhase.angulo,
        },
      };
    }
    case "SET_COMPLETED":
      return { ...state, completed: action.payload };
    default:
      return state;
  }
}

/** Helper: get first phase duration for reset. */
function getFirstPhaseDuration(state: ExerciseState): number {
  if (state.activeProtocol?.fases?.[0]) {
    return state.activeProtocol.fases[0].tempo;
  }
  return state.config.restDuration;
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
