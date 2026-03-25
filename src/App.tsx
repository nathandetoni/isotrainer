/**
 * App.tsx
 * ───────
 * Root component. Wires together the exercise feature:
 *   - ExerciseProvider wraps the tree with the global store
 *   - usePoseDetector replaces the Python sidecar + usePoseSocket entirely
 *   - useTimer manages the exercise/rest interval
 *   - Layout: camera on the left, metrics panel on the right
 */

import { useState, useCallback, useEffect } from "react";
import { ExerciseProvider, useExerciseStore } from "./features/exercise/store/exerciseStore";
import { usePoseDetector } from "./features/exercise/hooks/usePoseDetector";
import { useTimer } from "./features/exercise/hooks/useTimer";
import { CameraCanvas } from "./features/exercise/components/CameraCanvas";
import { TimerWidget } from "./features/exercise/components/TimerWidget";
import { SettingsModal } from "./features/exercise/components/SettingsModal";
import { AngleDisplay } from "./features/exercise/components/AngleDisplay";
import "./index.css";

// ── Inner app (inside the provider) ──────────────────────────────────────────

function ExerciseApp() {
  const { state, dispatch } = useExerciseStore();
  const { videoRef, start, stop, listCameras } = usePoseDetector();
  const { start: startTimer, stop: stopTimer } = useTimer();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Expose config to the detector loop via a global ref (avoids closure staleness)
  useEffect(() => {
    (window as any).__isoTrainerConfig = {
      targetAngle: state.config.targetAngle,
      tolerance:   state.config.tolerance,
    };
  }, [state.config.targetAngle, state.config.tolerance]);

  const handleApplySettings = useCallback(async (deviceId: string) => {
    await start(deviceId);
  }, [start]);

  const handleStart = useCallback(() => {
    startTimer();
  }, [startTimer]);

  const handleStop = useCallback(() => {
    stop();
    stopTimer();
    dispatch({ type: "RESET_TIMER" });
  }, [stop, stopTimer, dispatch]);

  const isRunning = state.phase !== "idle";
  const canStart  = state.detectorStatus === "running" && !isRunning;

  // Detector status badge
  const statusLabel =
    state.detectorStatus === "running" ? "● Ao vivo"   :
    state.detectorStatus === "loading" ? "◌ Carregando…" :
    state.detectorStatus === "error"   ? "✕ Erro"      : "○ Offline";

  return (
    <div className="app-root">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-logo">
          ISO<span>TRAINER</span>
        </div>
        <div className="header-right">
          <span className={`ws-badge ws-badge--${state.detectorStatus === "running" ? "open" : state.detectorStatus === "loading" ? "connecting" : state.detectorStatus === "error" ? "error" : "closed"}`}>
            {statusLabel}
          </span>
          <span className="app-badge">Exercício de Parede</span>
        </div>
      </header>

      {/* ── Main grid ──────────────────────────────────────────────────── */}
      <main className="app-grid">

        {/* Camera feed */}
        <section className="camera-section">
          <div className="camera-wrapper">
            {state.detectorStatus === "running" ? (
              <CameraCanvas
                videoRef={videoRef}
                landmarks={state.pose.landmarks}
                status={state.pose.status}
              />
            ) : (
              <div className="camera-placeholder">
                <span className="camera-placeholder__icon">📷</span>
                <p>Abra as <strong>configurações</strong> para iniciar a câmera</p>
              </div>
            )}
          </div>

          {/* Instructions card */}
          <div className="info-card">
            <p className="info-card__label">GUIA DE POSIÇÃO</p>
            <p className="info-card__text">
              Posicione-se de lado para a câmera. Mantenha o corpo inteiro visível
              da cabeça aos pés. A câmera deve estar na altura do joelho, a ~1,5 m.
            </p>
          </div>
        </section>

        {/* Metrics panel */}
        <aside className="metrics-panel">

          <AngleDisplay
            angle={state.pose.angle}
            status={state.pose.status}
          />

          <TimerWidget
            phase={state.phase}
            seconds={state.seconds}
            cycles={state.cycles}
          />

          {/* Controls */}
          <div className="controls">
            <button
              className="btn btn--amber"
              onClick={() => setSettingsOpen(true)}
            >
              SET
            </button>
            <button
              className="btn btn--primary"
              onClick={handleStart}
              disabled={!canStart}
            >
              START
            </button>
            <button
              className="btn btn--danger"
              onClick={handleStop}
              disabled={!isRunning && state.detectorStatus !== "running"}
            >
              STOP
            </button>
          </div>

        </aside>
      </main>

      {/* Settings modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onApply={handleApplySettings}
        listCameras={listCameras}
      />
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ExerciseProvider>
      <ExerciseApp />
    </ExerciseProvider>
  );
}
