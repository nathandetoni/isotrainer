/**
 * features/exercise/components/AngleDisplay.tsx
 * ─────────────────────────────────────────────
 * Large angle readout with colour-coded feedback text.
 * Purely presentational.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { PoseStatus } from "../../../types/protocol";

interface AngleDisplayProps {
  angle:  number | null;
  status: PoseStatus;
}

export const AngleDisplay = memo(function AngleDisplay({
  angle,
  status,
}: AngleDisplayProps) {
  const { t } = useTranslation();

  return (
    <div className="angle-display">
      <p className="angle-label">{t("angleDisplay.label")}</p>
      <p className={`angle-value angle-value--${status}`}>
        {angle !== null ? `${angle}°` : "--"}
      </p>
      <p className={`angle-feedback angle-feedback--${status}`}>
        {t(`angleDisplay.feedback.${status}`)}
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
