/**
 * features/exercise/components/ProtocolEditor.tsx
 * ─────────────────────────────────────────────────
 * Modal for creating/editing training protocols.
 * Supports dynamic phases (add/remove) with time (MM:SS), angle, and rest toggle.
 * Based on professor's v7 modal-protocolo.
 */

import { useState, useEffect, useCallback, memo } from "react";
import type { TrainingProtocol, TrainingPhase } from "../store/protocolStore";
import {
  createNewProtocol,
  createDefaultPhases,
  upsertProtocol,
  formatTime,
  parseTime,
} from "../store/protocolStore";

interface ProtocolEditorProps {
  isOpen:    boolean;
  onClose:   () => void;
  onSaved:   () => void;
  editingProtocol: TrainingProtocol | null;  // null = new protocol
}

export const ProtocolEditor = memo(function ProtocolEditor({
  isOpen,
  onClose,
  onSaved,
  editingProtocol,
}: ProtocolEditorProps) {
  const [nome, setNome] = useState("");
  const [ciclos, setCiclos] = useState(10);
  const [fases, setFases] = useState<TrainingPhase[]>(createDefaultPhases());

  // Reset form when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (editingProtocol) {
      setNome(editingProtocol.nome);
      setCiclos(editingProtocol.ciclos);
      setFases(editingProtocol.fases.map((f) => ({ ...f })));
    } else {
      setNome("");
      setCiclos(10);
      setFases(createDefaultPhases());
    }
  }, [isOpen, editingProtocol]);

  const updatePhase = useCallback((idx: number, updates: Partial<TrainingPhase>) => {
    setFases((prev) => prev.map((f, i) => (i === idx ? { ...f, ...updates } : f)));
  }, []);

  const addPhase = useCallback(() => {
    setFases((prev) => [...prev, { tempo: 120, angulo: 90, descanso: false }]);
  }, []);

  const removePhase = useCallback((idx: number) => {
    setFases((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!nome.trim()) {
      alert("Digite um nome para o treino.");
      return;
    }

    const proto: TrainingProtocol = editingProtocol
      ? { ...editingProtocol, nome: nome.trim(), ciclos, fases: fases.map((f) => ({ ...f })) }
      : createNewProtocol(nome.trim(), fases.map((f) => ({ ...f })), ciclos);

    upsertProtocol(proto);
    onSaved();
    onClose();
  }, [nome, ciclos, fases, editingProtocol, onSaved, onClose]);

  const handleTimeBlur = useCallback((idx: number, value: string) => {
    updatePhase(idx, { tempo: parseTime(value) });
  }, [updatePhase]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop modal-backdrop--z200" onClick={onClose}>
      <div className="modal-card protocol-editor" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">
          {editingProtocol ? `Editar: ${editingProtocol.nome}` : "Novo treino"}
        </h2>

        {/* Protocol name */}
        <div className="modal-field">
          <label className="modal-label">Nome do treino</label>
          <input
            className="modal-input"
            type="text"
            placeholder="Ex: Treino Isométrico 1"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        {/* Dynamic phases */}
        <div className="phases-container">
          {fases.map((fase, idx) => (
            <div
              key={idx}
              className={`phase-card ${fase.descanso ? "phase-card--rest" : "phase-card--work"}`}
            >
              <div className="phase-header">
                <span className="phase-title">
                  Fase {idx + 1} — {fase.descanso ? "Descanso" : "Treino"}
                </span>
                {fases.length > 2 && (
                  <button
                    className="phase-remove-btn"
                    onClick={() => removePhase(idx)}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="phase-fields">
                <div className="phase-field">
                  <label className="modal-label">Tempo</label>
                  <input
                    className="modal-input modal-input--mono"
                    type="text"
                    defaultValue={formatTime(fase.tempo)}
                    placeholder="MM:SS"
                    onBlur={(e) => handleTimeBlur(idx, e.target.value)}
                  />
                </div>
                <div className="phase-field">
                  <label className="modal-label">Ângulo (°)</label>
                  <input
                    className="modal-input modal-input--mono"
                    type="number"
                    min={60}
                    max={130}
                    value={fase.angulo}
                    onChange={(e) => updatePhase(idx, { angulo: Number(e.target.value) || 90 })}
                  />
                </div>
                <div className="phase-field phase-field--check">
                  <label className="modal-label">Desc.</label>
                  <input
                    type="checkbox"
                    className="phase-checkbox"
                    checked={fase.descanso}
                    onChange={(e) => updatePhase(idx, { descanso: e.target.checked })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="btn-add-phase" onClick={addPhase}>
          + Adicionar nova fase
        </button>

        {/* Cycles */}
        <div className="modal-field">
          <label className="modal-label">Número de ciclos (repetições)</label>
          <input
            className="modal-input"
            type="number"
            min={1}
            max={99}
            value={ciclos}
            onChange={(e) => setCiclos(Number(e.target.value) || 1)}
          />
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleSave}>
            Salvar treino
          </button>
        </div>
      </div>
    </div>
  );
});
