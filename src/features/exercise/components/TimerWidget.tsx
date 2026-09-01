/**
 * features/exercise/components/TimerWidget.tsx
 * ─────────────────────────────────────────────
 * Displays the current timer phase, countdown, cycle count, and completion.
 * Supports countdown phase (amber) before the workout begins.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { TimerPhase } from "../store/exerciseStore";

interface TimerWidgetProps {
  phase:        TimerPhase;
  seconds:      number;
  cycles:       number;
  targetCycles: number;
  completed:    boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export const TimerWidget = memo(function TimerWidget({
  phase,
  seconds,
  cycles,
  targetCycles,
  completed,
}: TimerWidgetProps) {
  const { t } = useTranslation();

  return (
    <div className={`timer-widget timer-widget--${phase} ${completed ? "timer-widget--completed" : ""}`}>
      <span className="timer-phase-label">
        {completed ? t("timerWidget.completed") : t(`timerWidget.phase.${phase}`)}
      </span>
      <span className="timer-display">{formatTime(seconds)}</span>
      {cycles > 0 && (
        <span className="timer-cycles">
          {t("timerWidget.cycle", { current: cycles, total: targetCycles })}
        </span>
      )}
    </div>
  );
});
