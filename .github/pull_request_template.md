## Description
Briefly describe the optical protocol changes, carrier improvements, or bug fixes.

## Subsystems Touched
- [ ] Core Protocol (`src/protocol/node.ts`, `src/protocol/fsm.ts`)
- [ ] Optical Carriers (`QR`, `Chromatic`, `Symbol Matrix`)
- [ ] Optical Discovery & Heartbeat (`src/protocol/heartbeat.ts`)
- [ ] Android Background Node (`android/`)
- [ ] QPL Execution Runtime (`src/protocol/qpl.ts`)
- [ ] CI/CD Workflows (`.github/workflows/`)

## Conformance Verification
- [ ] Ran `npm run lint` and all static checks pass
- [ ] Verified physical constraints (No fake optical transmission while screen is off)
- [ ] Verified zero secrets / keys committed
- [ ] Tested camera frame capture lifecycle & permissions
