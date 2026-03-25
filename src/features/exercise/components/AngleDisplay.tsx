/**
 * features/exercise/components/AngleDisplay.tsx
 * ─────────────────────────────────────────────
 * Large angle readout with colour-coded feedback text.
 * Purely presentational.
 */

import { memo } from "react";
import type { PoseStatus } from "../../../types/protocol";

interface AngleDisplayProps {
  angle:  number | null;
  status: PoseStatus;
}

const FEEDBACK: Record<PoseStatus, string> = {
  on_target:      "✓ Ângulo correto — mantenha!",
  above:          "↓ Abaixe um pouco",
  below:          "↑ Vá mais fundo",
  no_pose:        "Posicione-se de lado para a câmera…",
  low_visibility: "Mantenha quadril, joelho e tornozelo visíveis",
};

export const AngleDisplay = memo(function AngleDisplay({
  angle,
  status,
}: AngleDisplayProps) {
  return (
    <div className="angle-display">
      <p className="angle-label">ÂNGULO DO JOELHO</p>
      <p className={`angle-value angle-value--${status}`}>
        {angle !== null ? `${angle}°` : "--"}
      </p>
      <p className={`angle-feedback angle-feedback--${status}`}>
        {FEEDBACK[status]}
      </p>

      {/* Visual progress bar */}
      <div className="angle-bar-track" aria-hidden="true">
        <div
          className={`angle-bar-fill angle-bar-fill--${status}`}
          style={{ width: angle !== null ? `${Math.min(100, (angle / 180) * 100)}%` : "0%" }}
        />
      </div>
    </div>
  );
});
