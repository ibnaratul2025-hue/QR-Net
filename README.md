# QIP — Screen-to-Camera Optical Internet Protocol & Distributed Air-Gapped Network

[![QIP CI Pipeline](https://github.com/ibnaratul2025-hue/QR-Net/actions/workflows/ci.yml/badge.svg)](https://github.com/ibnaratul2025-hue/QR-Net/actions/workflows/ci.yml)
[![QIP Android Build & Release](https://github.com/ibnaratul2025-hue/QR-Net/actions/workflows/android.yml/badge.svg)](https://github.com/ibnaratul2025-hue/QR-Net/actions/workflows/android.yml)
[![QIP Protocol Conformance](https://github.com/ibnaratul2025-hue/QR-Net/actions/workflows/protocol.yml/badge.svg)](https://github.com/ibnaratul2025-hue/QR-Net/actions/workflows/protocol.yml)
[![QIP Security Audit](https://github.com/ibnaratul2025-hue/QR-Net/actions/workflows/security.yml/badge.svg)](https://github.com/ibnaratul2025-hue/QR-Net/actions/workflows/security.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Protocol Specification](https://img.shields.io/badge/Protocol-QIP%2F1.2-cyan.svg)](#protocol-architecture)
[![Android](https://img.shields.io/badge/Android-CameraX%20%2B%20Compose-green.svg)](#android-camerax-node)

> **World-Class Screen-to-Camera Programmable Optical Communication & Resilient Networking Suite**  
> Stream encrypted datagrams, files, SAS pairing codes, CRDT state streams, and mesh telemetry across air-gapped devices at zero radio emission (RF-silent) using dynamic animated QR barcodes, spectral chromatic carriers, and high-density 2D matrix symbology.

---

## 🚀 Key Architectural Capabilities

- **Zero RF Air-Gapped Transmission**: Exchange files, messages, and cryptographic handshakes between PCs, Macs, phones, and embedded terminals with 0% radio frequency emissions (immune to RF jamming, eavesdropping, and WiFi/Bluetooth attacks).
- **Multi-Carrier Optical Modulation**:
  - **Animated High-Density QR Barcodes**: Robust Reed-Solomon error correction (EC Levels L/M/Q/H) with dynamic burst framerates up to 30 FPS.
  - **Chromatic RGB Spectral Modulation**: High-throughput multi-color channel optical transmission.
  - **2D Symbol Constellation**: Pixel-matrix modulation for specialized display-to-sensor links.
- **Robust Session Reassembly & Zero Data Loss**:
  - Sequence-tracked packetization with CRC-32 integrity verification per frame.
  - Fountain-code inspired dynamic retransmission and duplicate-frame elimination.
  - In-memory de-jittering buffers ensuring zero dropped bytes during dropped frame bursts.
- **Professional Android CameraX & Compose Subsystem**:
  - **Camera Permission Lifecycle Manager**: Automatic rationale, denial recovery, direct system settings intent triggers, and graceful fallback to image scanning.
  - **`DefaultLifecycleObserver`**: Automatic hardware thread pause/resume on backgrounding (`ON_PAUSE` / `ON_RESUME`), conserving battery and thermal headroom.
  - **CameraX Error Listener**: Real-time detection and recovery for `ERROR_CAMERA_IN_USE`, sensor timeouts, thermal throttling, and dark/occluded lenses.
  - **Live Optical Telemetry HUD**: Real-time display of camera resolution (e.g. `1920×1080 @ 30 FPS`), Optical SNR (dB), Contrast %, Ambient Lux, and 0–100% Decode Health.
- **Enterprise-Grade Cryptography & Air-Gapped Pairing**:
  - **Short Authentication String (SAS)** visual emoji & hexadecimal parity check preventing optical Man-in-the-Middle (MITM) attacks.
  - **CRDT State Synchronization**: Conflict-free replicated data types for collaborative offline document sharing.

---

## 🛠️ Quick Start & Installation

### Prerequisites
- Node.js >= 18.0.0 (Node 20 LTS recommended)
- npm >= 9.0.0
- A modern browser with WebRTC Camera permissions (Chrome, Safari, Firefox, Edge, or Android Chrome)

### 1. Clone & Install
```bash
git clone https://github.com/ibnaratul2025-hue/QR-Net.git
cd QR-Net

# Clean install with lockfile
npm ci || npm install
```

### 2. Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000` (or the provided dev URL).

### 3. Production Build & Validation
```bash
# Type check and lint
npm run lint

# Production bundle
npm run build
```

---

## 📱 Android CameraX Node

The native Android module lives in `/android` and provides a Jetpack Compose frontend backed by CameraX:

- **Manifest Declaration**: Camera hardware feature required, optional flashlight torch, Foreground Service optical listener.
- **Permission Flow**: Declarative permissions using Jetpack Activity Result Contracts, supporting Android 6.0 through Android 15+.
- **Lifecycle Integration**:
  ```kotlin
  class QipCameraLifecycleObserver(
      private val cameraController: LifecycleCameraController
  ) : DefaultLifecycleObserver {
      override fun onResume(owner: LifecycleOwner) {
          cameraController.bindToLifecycle(owner)
      }
      override fun onPause(owner: LifecycleOwner) {
          cameraController.unbind()
      }
  }
  ```

---

## 🔒 Security & Air-Gap Compliance

- **No Remote Telemetry**: QIP runs entirely on the client or local node. Private keys and transmission payloads never exit the local device boundary unless optically projected.
- **CRC-32 & Content Hash Verification**: Every optical frame envelope contains cryptographic message hashes and CRC-32 checksums to reject frame corruption.
- For vulnerability reports, please see [SECURITY.md](SECURITY.md).

---

## 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.
