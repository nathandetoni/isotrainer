/**
 * features/exercise/store/protocolStore.ts
 * ─────────────────────────────────────────
 * Training protocol management with localStorage persistence.
 *
 * Each protocol defines a sequence of phases (work/rest), each with
 * its own duration and target angle. The timer cycles through the
 * phases for a configurable number of repetitions.
 *
 * Based on the professor's v7 implementation, ported to TypeScript
 * with proper type safety and React hooks integration.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single phase within a training protocol. */
export interface TrainingPhase {
  tempo:    number;   // duration in seconds
  angulo:   number;   // target angle in degrees
  descanso: boolean;  // true = rest phase, false = work phase
}

/** A complete training protocol (persisted in localStorage). */
export interface TrainingProtocol {
  id:     string;           // unique ID (timestamp-based)
  nome:   string;           // user-defined name
  ciclos: number;           // number of full cycles
  fases:  TrainingPhase[];  // ordered list of phases
}

// ── localStorage key ──────────────────────────────────────────────────────────

const STORAGE_KEY      = "isoTrainer:protocolos";
const ACTIVE_KEY       = "isoTrainer:protocoloAtivo";
const CAMERA_KEY       = "isoTrainer:cameraId";

// ── Protocol CRUD ─────────────────────────────────────────────────────────────

/** Read all protocols from localStorage. */
export function getProtocols(): TrainingProtocol[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Persist the full protocol list to localStorage. */
export function saveProtocols(list: TrainingProtocol[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** Save or update a single protocol. */
export function upsertProtocol(protocol: TrainingProtocol): void {
  const list = getProtocols();
  const idx = list.findIndex((p) => p.id === protocol.id);
  if (idx >= 0) {
    list[idx] = protocol;
  } else {
    list.push(protocol);
  }
  saveProtocols(list);
}

/** Delete a protocol by ID. */
export function deleteProtocol(id: string): void {
  saveProtocols(getProtocols().filter((p) => p.id !== id));
  // If the deleted protocol was active, clear it
  if (getActiveProtocolId() === id) {
    setActiveProtocolId(null);
  }
}

// ── Active protocol ID ────────────────────────────────────────────────────────

export function getActiveProtocolId(): string | null {
  return localStorage.getItem(ACTIVE_KEY) || null;
}

export function setActiveProtocolId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

export function getActiveProtocol(): TrainingProtocol | null {
  const id = getActiveProtocolId();
  if (!id) return null;
  return getProtocols().find((p) => p.id === id) || null;
}

// ── Camera persistence ────────────────────────────────────────────────────────

export function getSavedCameraId(): string | null {
  return localStorage.getItem(CAMERA_KEY) || null;
}

export function saveCameraId(deviceId: string): void {
  localStorage.setItem(CAMERA_KEY, deviceId);
}

// ── Default protocol factory ──────────────────────────────────────────────────

export function createDefaultPhases(): TrainingPhase[] {
  return [
    { tempo: 120, angulo: 90, descanso: false },
    { tempo: 120, angulo: 90, descanso: true },
  ];
}

export function createNewProtocol(
  nome: string = "",
  fases?: TrainingPhase[],
  ciclos: number = 10,
): TrainingProtocol {
  return {
    id:     Date.now().toString(),
    nome,
    ciclos,
    fases:  fases || createDefaultPhases(),
  };
}

// ── Time formatting helpers ───────────────────────────────────────────────────

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function parseTime(str: string): number {
  if (!str) return 0;
  if (str.includes(":")) {
    const [m, s] = str.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  }
  return (parseFloat(str) || 0) * 60;
}
