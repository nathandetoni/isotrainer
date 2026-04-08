/**
 * features/exercise/hooks/useTimer.ts
 * ─────────────────────────────────────
 * Manages the exercise/rest interval timer with protocol support.
 *
 * When a protocol is active, the timer cycles through the protocol's
 * ordered phases. Each phase has its own duration and target angle.
 * The timer auto-stops when all cycles are completed.
 *
 * Audio feedback:
 *   - Short beep on the last 3 seconds of each phase
 *   - Triple beep on phase transition
 *   - Quintuple beep when training is complete
 */

import { useEffect, useRef, useCallback } from "react";
import { useExerciseStore } from "../store/exerciseStore";

export interface UseTimerReturn {
  start: () => void;
  stop:  () => void;
}

// ── Web Audio beep (matches professor's apitar()) ─────────────────────────────

let audioCtx: AudioContext | null = null;

function beep(): void {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.15);
  } catch {
    // Audio not available — ignore
  }
}

function tripleBeep(): void {
  beep();
  setTimeout(beep, 200);
  setTimeout(beep, 400);
}

function quintupleBeep(): void {
  beep();
  setTimeout(beep, 200);
  setTimeout(beep, 400);
  setTimeout(beep, 600);
  setTimeout(beep, 800);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTimer(): UseTimerReturn {
  const { state, dispatch } = useExerciseStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Refs to avoid stale closures
  const secondsRef = useRef(state.seconds);
  const phaseRef   = useRef(state.phase);

  useEffect(() => { secondsRef.current = state.seconds; }, [state.seconds]);
  useEffect(() => { phaseRef.current   = state.phase;   }, [state.phase]);

  // ── Phase transition ──────────────────────────────────────────────────────

  const advance = useCallback(() => {
    const proto = state.activeProtocol;

    if (proto) {
      // Protocol mode: advance to next phase in the protocol
      tripleBeep();
      dispatch({ type: "ADVANCE_PHASE" });
    } else {
      // Legacy mode (no protocol): simple rest ↔ exercise toggle
      tripleBeep();
      if (phaseRef.current === "rest") {
        dispatch({ type: "SET_PHASE",   payload: "exercise" });
        dispatch({ type: "SET_SECONDS", payload: state.config.exerciseDuration });
      } else if (phaseRef.current === "exercise") {
        dispatch({ type: "INCREMENT_CYCLES" });
        dispatch({ type: "SET_PHASE",   payload: "rest" });
        dispatch({ type: "SET_SECONDS", payload: state.config.restDuration });
      }
    }
  }, [state.activeProtocol, state.config, dispatch]);

  // ── Completion detection ──────────────────────────────────────────────────

  useEffect(() => {
    if (state.completed) {
      clearTimer();
      quintupleBeep();
    }
  }, [state.completed]);

  // ── Countdown tick ────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase === "idle") return;

    clearTimer();
    intervalRef.current = setInterval(() => {
      const next = secondsRef.current - 1;

      if (next <= 3 && next > 0) {
        beep();
      }

      if (next <= 0) {
        advance();
      } else {
        dispatch({ type: "SET_SECONDS", payload: next });
      }
    }, 1_000);

    return clearTimer;
  }, [state.phase, advance, dispatch]);

  // ── Public API ────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    // Initialize AudioContext on user interaction
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch { /* ignore */ }
    }

    dispatch({ type: "SET_COMPLETED", payload: false });

    const proto = state.activeProtocol;
    if (proto && proto.fases.length > 0) {
      // Protocol mode: start from phase 0
      const firstPhase = proto.fases[0];
      dispatch({ type: "SET_PHASE",   payload: firstPhase.descanso ? "rest" : "exercise" });
      dispatch({ type: "SET_SECONDS", payload: firstPhase.tempo });
      dispatch({ type: "SET_CONFIG",  payload: { targetAngle: firstPhase.angulo } });
    } else {
      // Legacy mode: start with rest
      dispatch({ type: "SET_PHASE",   payload: "rest" });
      dispatch({ type: "SET_SECONDS", payload: state.config.restDuration });
    }
  }, [dispatch, state.activeProtocol, state.config.restDuration]);

  const stop = useCallback(() => {
    clearTimer();
    dispatch({ type: "RESET_TIMER" });
  }, [dispatch]);

  return { start, stop };
}
