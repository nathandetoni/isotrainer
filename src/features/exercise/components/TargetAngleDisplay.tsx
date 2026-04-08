/**
 * features/exercise/components/TargetAngleDisplay.tsx
 * ────────────────────────────────────────────────────
 * Shows the target angle for the current protocol phase.
 * Background colour matches the timer phase (green=work, red=rest).
 * Based on professor's #campo-angulo-alvo Widget.
 */

import { memo } from "react";
import type { TimerPhase } from "../store/exerciseStore";

interface TargetAngleDisplayProps {
  targetAngle: number;
  phase:       TimerPhase;
}

export const TargetAngleDisplay = memo(function TargetAngleDisplay({
  targetAngle,
  phase,
}: TargetAngleDisplayProps) {
  return (
    <div className={`target-angle-widget target-angle-widget--${phase}`}>
      <span className="target-angle-label">ÂNGULO DESEJADO</span>
      <span className="target-angle-value">
        {phase === "idle" ? "--" : targetAngle}
        <span className="target-angle-unit">°</span>
      </span>
    </div>
  );
});
