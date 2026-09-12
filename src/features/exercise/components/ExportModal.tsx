/**
 * features/exercise/components/ExportModal.tsx
 * ──────────────────────────────────────────────
 * Shown when training completes. Offers to export the angle log as CSV
 * and to save the validation photos taken at 1:30 of each exercise phase.
 * The log contains one row per second of "exercise" phase.
 */

import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { AngleRecord } from "../hooks/useTimer";
import { downloadSnapshot, type Snapshot } from "../core/snapshot";

interface ExportModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  log:       AngleRecord[];
  snapshots: Snapshot[];
}

/** Delay between consecutive downloads — browsers drop rapid-fire a.click() calls */
const DOWNLOAD_STAGGER_MS = 300;

export const ExportModal = memo(function ExportModal({
  isOpen,
  onClose,
  log,
  snapshots,
}: ExportModalProps) {
  const { t } = useTranslation();

  const handleExport = useCallback(() => {
    if (log.length === 0) {
      alert(t("exportModal.alertEmpty"));
      return;
    }

    const header = "timestamp_ms,tempo_sessao,fase,angulo_atual,angulo_alvo";
    const rows   = log.map((r) =>
      `${r.timestampMs},${r.elapsed},${r.phase},${r.angle ?? ""},${r.targetAngle}`
    );
    const csv    = [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = `isoTrainer_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [log, t]);

  const handleSavePhotos = useCallback(() => {
    snapshots.forEach((snap, i) => {
      window.setTimeout(() => downloadSnapshot(snap), i * DOWNLOAD_STAGGER_MS);
    });
  }, [snapshots]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card export-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
      >
        <div className="export-icon">✅</div>
        <h2 id="export-title" className="modal-title">{t("exportModal.title")}</h2>
        <p
          className="export-description"
          dangerouslySetInnerHTML={{
            __html: log.length > 0
              ? t("exportModal.dataPoints", { count: log.length })
              : t("exportModal.noData"),
          }}
        />
        <p
          className="export-description"
          dangerouslySetInnerHTML={{ __html: t("exportModal.exportQuestion") }}
        />

        {snapshots.length > 0 && (
          <ul className="snapshot-grid" aria-label={t("exportModal.photosLabel")}>
            {snapshots.map((snap) => (
              <li key={snap.id}>
                <button
                  type="button"
                  className="snapshot-thumb"
                  onClick={() => downloadSnapshot(snap)}
                  title={snap.caption}
                  aria-label={t("exportModal.savePhotoItem", { caption: snap.caption })}
                >
                  <img src={snap.url} alt={snap.caption} loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>
            {t("exportModal.close")}
          </button>
          {log.length > 0 && (
            <button className="btn btn--primary" onClick={handleExport}>
              {t("exportModal.export")}
            </button>
          )}
          {snapshots.length > 0 && (
            <button className="btn btn--amber" onClick={handleSavePhotos}>
              {t("exportModal.savePhoto", { count: snapshots.length })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
