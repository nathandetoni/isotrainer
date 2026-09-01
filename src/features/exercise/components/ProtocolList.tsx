/**
 * features/exercise/components/ProtocolList.tsx
 * ──────────────────────────────────────────────
 * Displays the list of saved training protocols inside the Settings modal.
 * Each item can be selected (as active), edited, or deleted.
 */

import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TrainingProtocol } from "../store/protocolStore";
import { formatTime } from "../store/protocolStore";

interface ProtocolListProps {
  protocols:       TrainingProtocol[];
  activeId:        string | null;
  onSelect:        (id: string) => void;
  onEdit:          (protocol: TrainingProtocol) => void;
  onDelete:        (id: string) => void;
  onCreateNew:     () => void;
}

export const ProtocolList = memo(function ProtocolList({
  protocols,
  activeId,
  onSelect,
  onEdit,
  onDelete,
  onCreateNew,
}: ProtocolListProps) {

  const { t } = useTranslation();

  const handleDelete = useCallback((id: string) => {
    if (confirm(t("protocolDelete.confirm"))) {
      onDelete(id);
    }
  }, [onDelete, t]);

  return (
    <div className="protocol-list">
      <label className="modal-label">{t("protocolList.label")}</label>

      {protocols.length === 0 ? (
        <p className="protocol-empty">{t("protocolList.empty")}</p>
      ) : (
        <div className="protocol-items">
          {protocols.map((proto) => (
            <div
              key={proto.id}
              className={`protocol-item ${proto.id === activeId ? "protocol-item--active" : ""}`}
              onClick={() => onSelect(proto.id)}
            >
              <div className="protocol-item__info">
                <span className="protocol-item__name">{proto.nome}</span>
                <span className="protocol-item__detail">
                  {proto.fases.map((f, i) => (
                    `F${i + 1}: ${formatTime(f.tempo)}/${f.angulo}°${f.descanso ? t("protocolList.rest") : t("protocolList.work")}`
                  )).join(" · ")}
                  {" · "}{proto.ciclos}x
                </span>
              </div>
              <div className="protocol-item__actions">
                <button
                  className="protocol-btn protocol-btn--edit"
                  onClick={(e) => { e.stopPropagation(); onEdit(proto); }}
                  title={t("protocolList.editTitle")}
                >
                  ✏️
                </button>
                <button
                  className="protocol-btn protocol-btn--delete"
                  onClick={(e) => { e.stopPropagation(); handleDelete(proto.id); }}
                  title={t("protocolList.deleteTitle")}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="btn-add-phase" onClick={onCreateNew}>
        {t("protocolList.createNew")}
      </button>
    </div>
  );
});
