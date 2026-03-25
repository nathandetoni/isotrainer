/**
 * features/exercise/components/SettingsModal.tsx
 * ─────────────────────────────────────────────────
 * Settings dialog ("SET" button) for configuring:
 *   - Camera selection (now by deviceId, shows real camera labels)
 *   - Target knee angle and tolerance
 *   - Exercise and rest durations
 *
 * Updated for TypeScript-native MediaPipe: no longer sends messages to a
 * WebSocket server. Config is dispatched to the store; the detector hook
 * reads it directly.
 */

import { useState, useEffect, useCallback, memo } from "react";
import { useExerciseStore } from "../store/exerciseStore";

interface SettingsModalProps {
  isOpen:      boolean;
  onClose:     () => void;
  onApply:     (deviceId: string) => void;  // triggers detector.start(deviceId)
  listCameras: () => Promise<void>;          // refresh camera list
}

export const SettingsModal = memo(function SettingsModal({
  isOpen,
  onClose,
  onApply,
  listCameras,
}: SettingsModalProps) {
  const { state, dispatch } = useExerciseStore();

  // Local form state — only committed to the store on "Save"
  const [form, setForm] = useState({ ...state.config });

  // Sync local form when the modal opens
  useEffect(() => {
    if (isOpen) setForm({ ...state.config });
  }, [isOpen, state.config]);

  // Refresh camera list every time modal opens
  useEffect(() => {
    if (isOpen) listCameras();
  }, [isOpen, listCameras]);

  // Pre-select first camera if none selected yet
  useEffect(() => {
    if (state.cameras.length > 0 && !form.cameraIndex) {
      setForm((prev) => ({ ...prev, cameraIndex: state.cameras[0].deviceId }));
    }
  }, [state.cameras, form.cameraIndex]);

  const handleChange = useCallback(
    <K extends keyof typeof form>(field: K, value: typeof form[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSave = useCallback(() => {
    dispatch({ type: "SET_CONFIG", payload: form });
    onApply(form.cameraIndex);
    onClose();
  }, [form, dispatch, onApply, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <h2 id="settings-title" className="modal-title">⚙ Configurações</h2>

        {/* Camera selection */}
        <div className="modal-field">
          <label className="modal-label" htmlFor="sel-camera">Câmera</label>
          <select
            id="sel-camera"
            className="modal-input"
            value={form.cameraIndex}
            onChange={(e) => handleChange("cameraIndex", e.target.value)}
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

        {/* Target angle */}
        <div className="modal-field">
          <label className="modal-label" htmlFor="inp-target-angle">
            Ângulo alvo (°)
          </label>
          <input
            id="inp-target-angle"
            type="number"
            className="modal-input"
            min={45}
            max={135}
            value={form.targetAngle}
            onChange={(e) => handleChange("targetAngle", Number(e.target.value))}
          />
        </div>

        {/* Tolerance */}
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
            value={form.tolerance}
            onChange={(e) => handleChange("tolerance", Number(e.target.value))}
          />
        </div>

        {/* Exercise duration */}
        <div className="modal-field">
          <label className="modal-label" htmlFor="inp-exercise">
            Duração do exercício (min)
          </label>
          <input
            id="inp-exercise"
            type="number"
            className="modal-input"
            min={1}
            max={10}
            value={Math.round(form.exerciseDuration / 60)}
            onChange={(e) =>
              handleChange("exerciseDuration", Number(e.target.value) * 60)
            }
          />
        </div>

        {/* Rest duration */}
        <div className="modal-field">
          <label className="modal-label" htmlFor="inp-rest">
            Duração do descanso (min)
          </label>
          <input
            id="inp-rest"
            type="number"
            className="modal-input"
            min={1}
            max={10}
            value={Math.round(form.restDuration / 60)}
            onChange={(e) =>
              handleChange("restDuration", Number(e.target.value) * 60)
            }
          />
        </div>

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
  );
});
