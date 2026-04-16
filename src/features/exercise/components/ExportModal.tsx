/**
 * features/exercise/components/ExportModal.tsx
 * ──────────────────────────────────────────────
 * Shown when training completes. Offers to export the angle log as CSV.
 * The log contains one row per second of "exercise" phase.
 */

import { memo, useCallback } from "react";
import type { AngleRecord } from "../hooks/useTimer";

interface ExportModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  log:      AngleRecord[];
}

export const ExportModal = memo(function ExportModal({
  isOpen,
  onClose,
  log,
}: ExportModalProps) {
  const handleExport = useCallback(() => {
    if (log.length === 0) {
      alert("Nenhum dado registrado.");
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
  }, [log]);

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
        <h2 id="export-title" className="modal-title">Treino concluído!</h2>
        <p className="export-description">
          {log.length > 0
            ? <>Foram registrados <strong>{log.length}</strong> pontos de ângulo durante o exercício.</>
            : "Nenhum dado de ângulo foi registrado nesta sessão."}
        </p>
        <p className="export-description">
          Deseja exportar os dados em <strong>CSV</strong>?
        </p>

        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Fechar
          </button>
          {log.length > 0 && (
            <button className="btn btn--primary" onClick={handleExport}>
              📥 Exportar CSV
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
