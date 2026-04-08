/**
 * features/exercise/components/TimerWidget.tsx
 * ─────────────────────────────────────────────
 * Displays the current timer phase, countdown, cycle count, and completion.
 * Background colour transitions between exercise (green) and rest (red).
 */

import { memo } from "react";
import type { TimerPhase } from "../store/exerciseStore";

interface TimerWidgetProps {
  phase:        TimerPhase;
  seconds:      number;
  cycles:       number;
  targetCycles: number;
  completed:    boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const PHASE_LABEL: Record<TimerPhase, string> = {
  idle:     "AGUARDANDO INÍCIO",
  exercise: "▶ EXERCÍCIO",
  rest:     "⏸ DESCANSO",
};

// ── Component ─────────────────────────────────────────────────────────────────

export const TimerWidget = memo(function TimerWidget({
  phase,
  seconds,
  cycles,
  targetCycles,
  completed,
}: TimerWidgetProps) {
  return (
    <div className={`timer-widget timer-widget--${phase} ${completed ? "timer-widget--completed" : ""}`}>
      <span className="timer-phase-label">
        {completed ? "✓ TREINO CONCLUÍDO!" : PHASE_LABEL[phase]}
      </span>
      <span className="timer-display">{formatTime(seconds)}</span>
      {cycles > 0 && (
        <span className="timer-cycles">
          Ciclo {cycles} / {targetCycles}
        </span>
      )}
    </div>
  );
});
