# Security Policy

## Supported Versions

The QIP (Optical Internet Protocol) project maintains strict security guarantees for air-gapped optical communications. Security updates are provided for the following releases:

| Version | Supported          |
| ------- | ------------------ |
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :white_check_mark: |
| < 1.1.0 | :x:                |

---

## Air-Gapped Security Architecture & Guarantees

1. **RF-Silent Channel**: The protocol exclusively utilizes optical transducers (screens, LEDs, smartphone displays, image sensors, cameras). No electromagnetic/radio transmissions (Wi-Fi, Bluetooth, NFC, Cellular) are required or initiated during transceiver operation.
2. **Visual Short Authentication String (SAS)**: Man-in-the-Middle (MITM) attacks on public camera-to-screen links are mitigated using cryptographic SAS pairing (visual emoji constellations + hexadecimal authentication codes) computed via SHA-256 HMAC of session ephemeral keys.
3. **No External Network Exfiltration**: Payloads encoded into optical QR frames and decoded by client sensors are processed locally in memory. The core transceiver does not send decode frames or raw video streams to third-party endpoints.
4. **Android Hardware Boundary**: Camera streams on Android are scoped strictly to in-memory `ImageAnalysis.Analyzer` buffers and immediately released on lifecycle pauses (`DefaultLifecycleObserver.onPause`), preventing background surveillance or sensor leakage.

---

## Reporting a Vulnerability

If you discover a security vulnerability in QIP or its Android/Web transceivers, please follow these steps:

1. **Do not create a public issue.**
2. Send an email to the security team or maintainer: `iibnaratul@gmail.com` with the subject `[SECURITY] QIP Vulnerability Report`.
3. Include:
   - Detailed description of the vulnerability (e.g., optical frame injection, buffer overflow, permission escalation, framing deserialization flaw).
   - Proof of Concept (PoC) steps or test vectors.
   - Affected platform (Web Browser, Android CameraX, Protocol Engine).
4. You will receive an acknowledgment within 48 hours. We will coordinate a patched release and credit the reporter in accordance with responsible disclosure practices.
