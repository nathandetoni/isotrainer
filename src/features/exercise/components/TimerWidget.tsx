/**
 * features/exercise/components/TimerWidget.tsx
 * ─────────────────────────────────────────────
 * Displays the current timer phase, countdown, and cycle count.
 * Background colour transitions between exercise (green) and rest (red).
 *
 * Purely presentational — receives all data as props.
 */

import { memo } from "react";
import type { TimerPhase } from "../store/exerciseStore";

interface TimerWidgetProps {
  phase:   TimerPhase;
  seconds: number;
  cycles:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const PHASE_LABEL: Record<TimerPhase, string> = {
  idle:     "PRONTO",
  exercise: "EXERCÍCIO",
  rest:     "DESCANSO",
};

// ── Component ─────────────────────────────────────────────────────────────────

export const TimerWidget = memo(function TimerWidget({
  phase,
  seconds,
  cycles,
}: TimerWidgetProps) {
  return (
    <div className={`timer-widget timer-widget--${phase}`}>
      <span className="timer-phase-label">{PHASE_LABEL[phase]}</span>
      <span className="timer-display">{formatTime(seconds)}</span>
      {cycles > 0 && (
        <span className="timer-cycles">
          {cycles} ciclo{cycles !== 1 ? "s" : ""} concluído{cycles !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
});
