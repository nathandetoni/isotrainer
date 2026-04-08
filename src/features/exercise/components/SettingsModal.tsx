/**
 * features/exercise/components/SettingsModal.tsx
 * ─────────────────────────────────────────────────
 * Settings dialog:
 *   - Camera selection (persisted in localStorage)
 *   - Training protocols (create, edit, delete, select)
 *   - Tolerance setting
 *
 * Protocol management replaces the old individual time/angle inputs.
 * Camera selection is persisted so reopening the app remembers the choice.
 */

import { useState, useEffect, useCallback, memo } from "react";
import { useExerciseStore } from "../store/exerciseStore";
import {
  getProtocols,
  deleteProtocol,
  getActiveProtocolId,
  setActiveProtocolId,
  getSavedCameraId,
  saveCameraId,
} from "../store/protocolStore";
import type { TrainingProtocol } from "../store/protocolStore";
import { ProtocolList } from "./ProtocolList";
import { ProtocolEditor } from "./ProtocolEditor";

interface SettingsModalProps {
  isOpen:      boolean;
  onClose:     () => void;
  onApply:     (deviceId: string) => void;
  listCameras: () => Promise<void>;
}

export const SettingsModal = memo(function SettingsModal({
  isOpen,
  onClose,
  onApply,
  listCameras,
}: SettingsModalProps) {
  const { state, dispatch } = useExerciseStore();

  // ── Local state ─────────────────────────────────────────────────────────
  const [cameraId, setCameraId] = useState(state.config.cameraIndex || "");
  const [tolerance, setTolerance] = useState(state.config.tolerance);
  const [protocols, setProtocols] = useState<TrainingProtocol[]>([]);
  const [activeProtoId, setActiveProtoId] = useState<string | null>(null);

  // Protocol editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProto, setEditingProto] = useState<TrainingProtocol | null>(null);

  // ── Sync when modal opens ───────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      listCameras();
      setProtocols(getProtocols());
      setActiveProtoId(getActiveProtocolId());
      setTolerance(state.config.tolerance);

      // Load saved camera
      const savedCam = getSavedCameraId();
      if (savedCam) {
        setCameraId(savedCam);
      } else if (state.config.cameraIndex) {
        setCameraId(state.config.cameraIndex);
      }
    }
  }, [isOpen, listCameras, state.config]);

  // Pre-select first camera if none selected
  useEffect(() => {
    if (state.cameras.length > 0 && !cameraId) {
      const savedCam = getSavedCameraId();
      const id = savedCam || state.cameras[0].deviceId;
      setCameraId(id);
    }
  }, [state.cameras, cameraId]);

  // ── Protocol handlers ───────────────────────────────────────────────────

  const refreshProtocols = useCallback(() => {
    setProtocols(getProtocols());
  }, []);

  const handleSelectProtocol = useCallback((id: string) => {
    setActiveProtoId(id);
  }, []);

  const handleEditProtocol = useCallback((proto: TrainingProtocol) => {
    setEditingProto(proto);
    setEditorOpen(true);
  }, []);

  const handleDeleteProtocol = useCallback((id: string) => {
    deleteProtocol(id);
    if (activeProtoId === id) setActiveProtoId(null);
    refreshProtocols();
  }, [activeProtoId, refreshProtocols]);

  const handleCreateNew = useCallback(() => {
    setEditingProto(null);
    setEditorOpen(true);
  }, []);

  const handleEditorSaved = useCallback(() => {
    refreshProtocols();
  }, [refreshProtocols]);

  // ── Save & Apply ────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    // Save camera preference
    if (cameraId) saveCameraId(cameraId);

    // Save active protocol
    setActiveProtocolId(activeProtoId);

    // Dispatch config
    dispatch({
      type: "SET_CONFIG",
      payload: {
        cameraIndex: cameraId,
        tolerance,
      },
    });

    // Set active protocol in exercise store
    const proto = activeProtoId
      ? protocols.find((p) => p.id === activeProtoId) || null
      : null;
    dispatch({ type: "SET_ACTIVE_PROTOCOL", payload: proto });

    // Start camera
    onApply(cameraId);
    onClose();
  }, [cameraId, tolerance, activeProtoId, protocols, dispatch, onApply, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div
          className="modal-card"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <h2 id="settings-title" className="modal-title">⚙ Configurações</h2>

          {/* 1. Camera selection */}
          <div className="modal-field">
            <label className="modal-label" htmlFor="sel-camera">Câmera</label>
            <select
              id="sel-camera"
              className="modal-input"
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
            >
              {state.cameras.length === 0 ? (
                <option value="">Nenhuma câmera detectada</option>
              ) : (
                state.cameras.map((cam) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 2. Tolerance */}
          <div className="modal-field">
            <label className="modal-label" htmlFor="inp-tolerance">
              Tolerância (±°)
            </label>
            <input
              id="inp-tolerance"
              type="number"
              className="modal-input"
              min={1}
              max={15}
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
            />
          </div>

          {/* 3. Training protocols */}
          <ProtocolList
            protocols={protocols}
            activeId={activeProtoId}
            onSelect={handleSelectProtocol}
            onEdit={handleEditProtocol}
            onDelete={handleDeleteProtocol}
            onCreateNew={handleCreateNew}
          />

          {/* Actions */}
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn btn--primary" onClick={handleSave}>
              Salvar e aplicar
            </button>
          </div>
        </div>
      </div>

      {/* Protocol Editor (secondary modal) */}
      <ProtocolEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={handleEditorSaved}
        editingProtocol={editingProto}
      />
    </>
  );
});
