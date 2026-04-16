/**
 * App.tsx
 * ───────
 * Root component. Wires together the exercise feature.
 *
 * Fixes applied:
 *   A) canStart now checks state.phase === "idle" — not the broader !isRunning
 *      (which was blocking START during countdown)
 *   B) ExportModal receives a snapshot (useState) not a live ref, so data is
 *      always correct even if the user starts a second session
 *   D) Removed window.__isoTrainerConfig — config is now handled via refs
 *      inside usePoseDetector directly
 */

import { useState, useCallback, useEffect } from "react";
import { ExerciseProvider, useExerciseStore } from "./features/exercise/store/exerciseStore";
import { usePoseDetector } from "./features/exercise/hooks/usePoseDetector";
import { useTimer } from "./features/exercise/hooks/useTimer";
import type { AngleRecord } from "./features/exercise/hooks/useTimer";
import { CameraCanvas } from "./features/exercise/components/CameraCanvas";
import { TimerWidget } from "./features/exercise/components/TimerWidget";
import { TargetAngleDisplay } from "./features/exercise/components/TargetAngleDisplay";
import { SettingsModal } from "./features/exercise/components/SettingsModal";
import { AngleDisplay } from "./features/exercise/components/AngleDisplay";
import { ExportModal } from "./features/exercise/components/ExportModal";
import {
  getActiveProtocol,
  getActiveProtocolId,
} from "./features/exercise/store/protocolStore";
import "./index.css";

// ── Inner app (inside the provider) ──────────────────────────────────────────

function ExerciseApp() {
  const { state, dispatch } = useExerciseStore();
  const { videoRef, start, stop, listCameras } = usePoseDetector();
  const { start: startTimer, stop: stopTimer, angleLog } = useTimer();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // BUG B FIX: snapshot the log into state when training completes,
  // so ExportModal always shows the correct session's data.
  const [exportLog, setExportLog] = useState<AngleRecord[]>([]);

  // Load saved protocol on mount
  useEffect(() => {
    const savedId = getActiveProtocolId();
    if (savedId) {
      const proto = getActiveProtocol();
      if (proto) dispatch({ type: "SET_ACTIVE_PROTOCOL", payload: proto });
    }
  }, [dispatch]);

  // BUG B FIX: capture snapshot of the log when training completes
  useEffect(() => {
    if (state.completed) {
      setExportLog([...angleLog.current]);   // snapshot — not the live ref
      setExportOpen(true);
    }
  }, [state.completed, angleLog]);

  const handleApplySettings = useCallback(async (deviceId: string) => {
    await start(deviceId);
  }, [start]);

  const handleStart = useCallback(() => {
    startTimer();
  }, [startTimer]);

  const handleStop = useCallback(() => {
    stopTimer();
    dispatch({ type: "RESET_TIMER" });
  }, [stopTimer, dispatch]);

  // BUG A FIX: canStart only requires phase === "idle" — not "!isRunning"
  // The old check blocked START when phase was "countdown". Now countdown
  // counts as "running" correctly but the button still only re-enables
  // after a full STOP/RESET brings the phase back to idle.
  const canStart = state.detectorStatus === "running" && state.phase === "idle";

  const statusLabel =
    state.detectorStatus === "running" ? "● Ao vivo" :
      state.detectorStatus === "loading" ? "◌ Carregando…" :
        state.detectorStatus === "error" ? "✕ Erro" : "○ Offline";

  return (
    <div className="app-root">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-logo">ISO<span>TRAINER</span></div>
        <div className="header-right">
          <span className={`ws-badge ws-badge--${state.detectorStatus === "running" ? "open" :
            state.detectorStatus === "loading" ? "connecting" :
              state.detectorStatus === "error" ? "error" : "closed"
            }`}>{statusLabel}</span>
          <span className="app-badge">
            {state.activeProtocol ? state.activeProtocol.nome : "Exercício de Parede"}
          </span>
        </div>
      </header>

      {/* ── Main grid ──────────────────────────────────────────────────── */}
      <main className="app-grid">

        {/* Camera feed */}
        <section className="camera-section">
          <div className="camera-wrapper">
            <CameraCanvas
              videoRef={videoRef}
              landmarks={state.pose.landmarks}
              status={state.pose.status}
              angle={state.pose.angle}
              tolerance={state.config.tolerance}
              targetAngle={state.config.targetAngle}
              phase={state.phase}
              seconds={state.seconds}
            />
            {state.detectorStatus !== "running" && (
              <div className="camera-placeholder">
                <span className="camera-placeholder__icon">📷</span>
                <p>Abra as <strong>configurações</strong> para iniciar a câmera</p>
              </div>
            )}
          </div>

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

          <div className="timer-row">
            <TimerWidget
              phase={state.phase}
              seconds={state.seconds}
              cycles={state.cycles}
              targetCycles={state.targetCycles}
              completed={state.completed}
            />
            <TargetAngleDisplay
              targetAngle={state.config.targetAngle}
              phase={state.phase}
            />
          </div>

          <div className="controls">
            <button className="btn btn--amber" onClick={() => setSettingsOpen(true)}>SET</button>
            <button className="btn btn--primary" onClick={handleStart} disabled={!canStart}>START</button>
            <button
              className="btn btn--danger"
              onClick={handleStop}
              disabled={state.detectorStatus !== "running"}
            >STOP</button>
          </div>

        </aside>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="app-footer">
        <p>
          Powered by <strong>FCMFreire</strong> e <strong>Detoni</strong>. Este aplicativo integra o
          projeto de pesquisa da doutoranda <strong>Claudiana Marcela Siste Charal</strong>, sob orientação do
          <strong> Prof. Dr. Wendell A. Lopes</strong>, vinculado aos Departamentos de Física e de Educação Física
          da <strong>Universidade Estadual de Maringá (UEM)</strong>, Maringá, PR, Brasil.
        </p>
      </footer>

      {/* Modals */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onApply={handleApplySettings}
        listCameras={listCameras}
      />

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        log={exportLog}
      />
    </div>
  );
}

export default function App() {
  return (
    <ExerciseProvider>
      <ExerciseApp />
    </ExerciseProvider>
  );
}
