/**
 * features/exercise/hooks/useTimer.ts
 * ─────────────────────────────────────
 * Manages the exercise/rest interval timer.
 *
 * Phases:
 *   idle     → initial state, timer not running
 *   exercise → counting down the exercise duration
 *   rest     → counting down the rest duration
 *
 * Each completed exercise phase increments the cycle counter.
 * Transitions auto-fire (rest → exercise → rest …) until stop() is called.
 */

import { useEffect, useRef, useCallback } from "react";
import { useExerciseStore } from "../store/exerciseStore";
import type { TimerPhase } from "../store/exerciseStore";

export interface UseTimerReturn {
  start: () => void;
  stop:  () => void;
}

export function useTimer(): UseTimerReturn {
  const { state, dispatch } = useExerciseStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const clearTimer = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  /**
   * Transition to the next phase when the current countdown reaches zero.
   * exercise → rest (increment cycles)
   * rest     → exercise
   */
  const advance = useCallback((currentPhase: TimerPhase, config: typeof state.config) => {
    if (currentPhase === "exercise") {
      dispatch({ type: "INCREMENT_CYCLES" });
      dispatch({ type: "SET_PHASE",   payload: "rest" });
      dispatch({ type: "SET_SECONDS", payload: config.restDuration });
    } else if (currentPhase === "rest") {
      dispatch({ type: "SET_PHASE",   payload: "exercise" });
      dispatch({ type: "SET_SECONDS", payload: config.exerciseDuration });
    }
  }, [dispatch]);

// ── Countdown tick via an interval approach ─────────────────────────────────
  // ── Countdown tick via a separate interval approach ────────────────────────
  // We use a ref-based approach to avoid stale closure on `state.seconds`.

  const secondsRef = useRef(state.seconds);
  const phaseRef   = useRef(state.phase);

  useEffect(() => { secondsRef.current = state.seconds; }, [state.seconds]);
  useEffect(() => { phaseRef.current   = state.phase;   }, [state.phase]);

  useEffect(() => {
    if (state.phase === "idle") return;

    clearTimer();
    intervalRef.current = setInterval(() => {
      const next = secondsRef.current - 1;
      if (next <= 0) {
        advance(phaseRef.current, state.config);
      } else {
        dispatch({ type: "SET_SECONDS", payload: next });
      }
    }, 1_000);

    return clearTimer;
  }, [state.phase, state.config, advance, dispatch]);

  // ── Public API ────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    dispatch({ type: "SET_PHASE",   payload: "exercise" });
    dispatch({ type: "SET_SECONDS", payload: state.config.exerciseDuration });
  }, [dispatch, state.config.exerciseDuration]);

  const stop = useCallback(() => {
    clearTimer();
    dispatch({ type: "RESET_TIMER" });
  }, [dispatch]);

  return { start, stop };
}
