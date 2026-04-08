/**
 * features/exercise/hooks/useTimer.ts
 * ─────────────────────────────────────
 * Manages the exercise/rest interval timer.
 *
 * Phases:
 *   idle     → initial state, timer not running
 *   rest     → counting down the rest duration (STARTS HERE, like professor)
 *   exercise → counting down the exercise duration
 *
 * Each completed exercise phase increments the cycle counter.
 * Transitions auto-fire (rest → exercise → rest …) until stop() is called.
 *
 * Audio feedback (matched to professor's apitar()):
 *   - Short beep on the last 3 seconds of each phase
 *   - Triple beep on phase transition
 */

import { useEffect, useRef, useCallback } from "react";
import { useExerciseStore } from "../store/exerciseStore";
import type { TimerPhase } from "../store/exerciseStore";

export interface UseTimerReturn {
  start: () => void;
  stop:  () => void;
}

// ── Web Audio beep (matches professor's apitar()) ─────────────────────────────

let audioCtx: AudioContext | null = null;

function beep(): void {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = 880;     // A5 — sharp and audible
  gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.15);
}

function tripleBeep(): void {
  beep();
  setTimeout(beep, 200);
  setTimeout(beep, 400);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

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
   * rest     → exercise (like professor: descanso → exercício)
   * exercise → rest     (increment cycles)
   */
  const advance = useCallback((currentPhase: TimerPhase, config: typeof state.config) => {
    // Triple beep on transition
    tripleBeep();

    if (currentPhase === "rest") {
      dispatch({ type: "SET_PHASE",   payload: "exercise" });
      dispatch({ type: "SET_SECONDS", payload: config.exerciseDuration });
    } else if (currentPhase === "exercise") {
      dispatch({ type: "INCREMENT_CYCLES" });
      dispatch({ type: "SET_PHASE",   payload: "rest" });
      dispatch({ type: "SET_SECONDS", payload: config.restDuration });
    }
  }, [dispatch]);

  // ── Countdown tick ────────────────────────────────────────────────────────
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

      // Beep on last 3 seconds of each phase
      if (next <= 3 && next > 0) {
        beep();
      }

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
    // Initialize AudioContext on user interaction (browser requirement)
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Start in REST phase like the professor's version — gives user time
    // to position themselves before the exercise begins
    dispatch({ type: "SET_PHASE",   payload: "rest" });
    dispatch({ type: "SET_SECONDS", payload: state.config.restDuration });
  }, [dispatch, state.config.restDuration]);

  const stop = useCallback(() => {
    clearTimer();
    dispatch({ type: "RESET_TIMER" });
  }, [dispatch]);

  return { start, stop };
}
