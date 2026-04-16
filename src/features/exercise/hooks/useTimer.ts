/**
 * features/exercise/hooks/useTimer.ts
 * ─────────────────────────────────────
 * Manages the exercise/rest interval timer with protocol support.
 *
 * Flow:
 *   START → 10s countdown (amber) → first protocol phase → ... → completed
 *
 * Audio feedback:
 *   - Short beep on the last 3s of each phase
 *   - Triple beep on phase transition
 *   - Long beep ending countdown → session starts
 *   - Quintuple beep when training is complete
 *
 * Angle collection:
 *   - During "exercise" phase only, records { timestampMs, angle, targetAngle }
 *     once per second via the same interval tick
 *   - Exposed as `angleLog` ref for ExportModal to read
 */

import { useEffect, useRef, useCallback } from "react";
import { useExerciseStore } from "../store/exerciseStore";

export interface AngleRecord {
  timestampMs: number;
  elapsed:     string;   // MM:SS from session start
  phase:       string;
  angle:       number | null;
  targetAngle: number;
}

export interface UseTimerReturn {
  start:     () => void;
  stop:      () => void;
  angleLog:  React.MutableRefObject<AngleRecord[]>;
}

// ── Web Audio ─────────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function beep(freq = 880, duration = 0.15, volume = 0.4): void {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch { /* ignore */ }
}

function tripleBeep():    void { beep(); setTimeout(() => beep(), 200); setTimeout(() => beep(), 400); }
function quintupleBeep(): void { [0,200,400,600,800].forEach(d => setTimeout(() => beep(), d)); }
function longBeep():      void { beep(660, 0.4, 0.5); }   // lower tone, longer — countdown done

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const COUNTDOWN_SECONDS = 10;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTimer(): UseTimerReturn {
  const { state, dispatch } = useExerciseStore();
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const angleLog     = useRef<AngleRecord[]>([]);
  const sessionStart = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Refs to avoid stale closures inside the interval
  const secondsRef         = useRef(state.seconds);
  const phaseRef           = useRef(state.phase);
  const angleRef           = useRef(state.pose.angle);
  const targetAngleRef     = useRef(state.config.targetAngle);
  const activeProtocolRef  = useRef(state.activeProtocol);
  const restDurationRef    = useRef(state.config.restDuration);
  const exerciseDurationRef = useRef(state.config.exerciseDuration);

  useEffect(() => { secondsRef.current          = state.seconds;              }, [state.seconds]);
  useEffect(() => { phaseRef.current            = state.phase;                }, [state.phase]);
  useEffect(() => { angleRef.current            = state.pose.angle;           }, [state.pose.angle]);
  useEffect(() => { targetAngleRef.current      = state.config.targetAngle;   }, [state.config.targetAngle]);
  useEffect(() => { activeProtocolRef.current   = state.activeProtocol;       }, [state.activeProtocol]);
  useEffect(() => { restDurationRef.current     = state.config.restDuration;  }, [state.config.restDuration]);
  useEffect(() => { exerciseDurationRef.current = state.config.exerciseDuration; }, [state.config.exerciseDuration]);

  // ── Phase transition ──────────────────────────────────────────────────────

  const advanceFromCountdown = useCallback(() => {
    longBeep();
    const proto = activeProtocolRef.current;
    if (proto && proto.fases.length > 0) {
      const firstPhase = proto.fases[0];
      dispatch({ type: "SET_PHASE",   payload: firstPhase.descanso ? "rest" : "exercise" });
      dispatch({ type: "SET_SECONDS", payload: firstPhase.tempo });
      dispatch({ type: "SET_CONFIG",  payload: { targetAngle: firstPhase.angulo } });
    } else {
      dispatch({ type: "SET_PHASE",   payload: "rest" });
      dispatch({ type: "SET_SECONDS", payload: restDurationRef.current });
    }
  }, [dispatch]);

  const advance = useCallback(() => {
    const proto = activeProtocolRef.current;
    if (proto) {
      tripleBeep();
      dispatch({ type: "ADVANCE_PHASE" });
    } else {
      tripleBeep();
      if (phaseRef.current === "rest") {
        dispatch({ type: "SET_PHASE",   payload: "exercise" });
        dispatch({ type: "SET_SECONDS", payload: exerciseDurationRef.current });
      } else if (phaseRef.current === "exercise") {
        dispatch({ type: "INCREMENT_CYCLES" });
        dispatch({ type: "SET_PHASE",   payload: "rest" });
        dispatch({ type: "SET_SECONDS", payload: restDurationRef.current });
      }
    }
  }, [dispatch]);

  // ── Completion ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.completed) {
      clearTimer();
      quintupleBeep();
    }
  }, [state.completed, clearTimer]);

  // ── Countdown tick ────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== "countdown") return;

    clearTimer();
    intervalRef.current = setInterval(() => {
      const next = secondsRef.current - 1;

      if (next <= 3 && next > 0) beep();

      if (next <= 0) {
        advanceFromCountdown();
      } else {
        dispatch({ type: "SET_SECONDS", payload: next });
      }
    }, 1_000);

    return clearTimer;
  }, [state.phase, advanceFromCountdown, clearTimer, dispatch]);

  // ── Exercise/Rest tick ────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== "exercise" && state.phase !== "rest") return;

    clearTimer();
    intervalRef.current = setInterval(() => {
      const next = secondsRef.current - 1;

      // Record angle every tick during exercise phase only
      if (phaseRef.current === "exercise") {
        const elapsed = Math.floor((Date.now() - sessionStart.current) / 1000);
        angleLog.current.push({
          timestampMs: Date.now(),
          elapsed:     formatTime(elapsed),
          phase:       "exercise",
          angle:       angleRef.current,
          targetAngle: targetAngleRef.current,
        });
      }

      if (next <= 3 && next > 0) beep();

      if (next <= 0) {
        advance();
      } else {
        dispatch({ type: "SET_SECONDS", payload: next });
      }
    }, 1_000);

    return clearTimer;
  }, [state.phase, advance, clearTimer, dispatch]);

  // ── Public API ────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
      catch { /* ignore */ }
    }

    // Reset log and session clock
    angleLog.current  = [];
    sessionStart.current = Date.now();

    dispatch({ type: "SET_COMPLETED", payload: false });

    // Always start with 10s countdown
    dispatch({ type: "SET_PHASE",   payload: "countdown" });
    dispatch({ type: "SET_SECONDS", payload: COUNTDOWN_SECONDS });
  }, [dispatch]);

  const stop = useCallback(() => {
    clearTimer();
    dispatch({ type: "RESET_TIMER" });
  }, [clearTimer, dispatch]);

  return { start, stop, angleLog };
}
