# isoTrainer 💪

Aplicativo isométrico de análise de postura em tempo real.
Feito com **Tauri + React + TypeScript** — MediaPipe roda diretamente no browser via WebAssembly, sem nenhum backend Python.

---

## 🛠️ Pré-requisitos

Antes de clonar o projeto em uma **máquina nova**, instale:

1. [Node.js 20+](https://nodejs.org/) — para o React e o Vite
2. [Rust](https://www.rust-lang.org/tools/install) — para o Tauri construir a janela nativa

> ✅ **Não é necessário Python.** O motor de visão computacional (MediaPipe Pose) roda 100% em TypeScript/WebAssembly dentro do próprio app.

---

## 🚀 Como rodar pela primeira vez

### 1. Clonar o repositório
```bash
git clone https://github.com/nathandetoni/isotrainer.git
cd isotrainer
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Rodar em modo de desenvolvimento

**Como app Tauri (Desktop nativo):**
```bash
npm run tauri dev
```

**Como site no browser (Web):**
```bash
npm run dev
# Abrir http://localhost:1420
```

---

## 🎯 Como usar

1. Clique em **SET** para abrir as configurações
2. Selecione sua câmera e ajuste o ângulo alvo e a tolerância
3. Clique em **Salvar e aplicar** — a câmera inicia e o MediaPipe começa a detectar sua pose
4. Posicione-se **de lado** para a câmera, com o corpo inteiro visível
5. Clique em **START** para iniciar o timer de exercício

---

## 📦 Gerar o Instalador Final

Para distribuir o app para outras pessoas:
```bash
npm run tauri build
```
Gera um `.msi` / `.exe` (Windows) ou `.dmg` (macOS) em `src-tauri/target/release/bundle/`.

> **macOS mínimo suportado:** 11.0 (Big Sur) — exigido pelo MediaPipe e pelo Tauri v2.

---

## 🏗️ Arquitetura

```
React (TypeScript)
├── usePoseDetector.ts   ← MediaPipe PoseLandmarker (WASM/GPU)
├── CameraCanvas.tsx     ← <video> nativo + canvas overlay
├── exerciseStore.tsx    ← Estado global (Context + useReducer)
├── useTimer.ts          ← Lógica de intervalo exercício/descanso
└── core/angle.ts        ← Cálculo de ângulo (produto escalar)

Tauri (Rust)            ← Apenas gerencia a janela nativa
```

---

## ⚖️ Licença e Direitos Autorais

© 2026 Nathan Moreira Detoni. Todos os direitos reservados.

Este software e seu código-fonte são propriedade exclusiva de **Nathan Moreira Detoni**.
É **proibida** a reprodução, distribuição, modificação ou uso comercial parcial ou total
sem autorização expressa e por escrito do autor.

> Este projeto é de uso privado. Não possui licença de código aberto.
