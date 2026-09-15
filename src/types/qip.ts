/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP — Optical Internet Protocol
 * Core Type Definitions & Protocol Specification
 */

export enum QipCarrierType {
  QR = 'CARRIER_QR',
  CHROMATIC = 'CARRIER_CHROMATIC',
  SYMBOL_MATRIX = 'CARRIER_SYMBOL_MATRIX',
}

export enum QipFsmState {
  IDLE = 'IDLE',
  DISCOVERING = 'DISCOVERING',
  HANDSHAKING = 'HANDSHAKING',
  NEGOTIATING = 'NEGOTIATING',
  AUTHENTICATING = 'AUTHENTICATING',
  TRANSFERRING = 'TRANSFERRING',
  RECOVERING = 'RECOVERING',
  SYNCHRONIZING = 'SYNCHRONIZING',
  COMPLETING = 'COMPLETING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum QipMessageType {
  TEXT = 'TEXT',
  JSON = 'JSON',
  BINARY = 'BINARY',
  EVENT = 'EVENT',
  COMMAND = 'COMMAND',
  RESPONSE = 'RESPONSE',
  STATE = 'STATE',
  STATE_DELTA = 'STATE_DELTA',
  STATE_REQUEST = 'STATE_REQUEST',
  STATE_ACK = 'STATE_ACK',
  QUERY = 'QUERY',
  CAPABILITY = 'CAPABILITY',
  IDENTITY = 'IDENTITY',
  PROGRAM = 'PROGRAM',
  STREAM = 'STREAM',
  PING = 'PING',
  PONG = 'PONG',
  TIME_REQUEST = 'TIME_REQUEST',
  TIME_RESPONSE = 'TIME_RESPONSE',
  PACKAGE = 'PACKAGE',
  ERROR = 'ERROR',
}

export enum QipTrustState {
  UNKNOWN = 'UNKNOWN',
  SEEN = 'SEEN',
  VERIFIED = 'VERIFIED',
  TRUSTED = 'TRUSTED',
  BLOCKED = 'BLOCKED',
}

export enum QipCapability {
  DISPLAY = 'DISPLAY',
  CAMERA = 'CAMERA',
  CLIPBOARD = 'CLIPBOARD',
  STORAGE = 'STORAGE',
  COMPUTE = 'COMPUTE',
  RPC = 'RPC',
  STREAM = 'STREAM',
  SIGNAGE = 'SIGNAGE',
  STATE_SYNC = 'STATE_SYNC',
  QIP_1 = 'QIP/1',
}

export interface QipSecurityPermission {
  canRead: boolean;
  canWrite: boolean;
  canDisplay: boolean;
  canRequestCamera: boolean;
  canSendCommand: boolean;
  canExecuteProgram: boolean;
}

export interface QipIdentity {
  nodeId: string;
  name: string;
  publicKeyHex: string;
  capabilities: QipCapability[];
  trustState: QipTrustState;
  pairingCode?: string;
}

export interface QipMessageEnvelope {
  protocol: 'QIP/1.0';
  msgId: string;
  source: string;
  destination: string; // 'BROADCAST' or specific nodeId
  ttl: number;
  hopCount: number;
  type: QipMessageType;
  timestamp: number;
  payload: any;
  checksum: string;
}

export interface QipFramePacket {
  magic: 'QIP';
  sessionId: string;
  seq: number;
  total: number;
  carrier: QipCarrierType;
  payloadChunk: string; // Base64 or string slice
  chunkChecksum: string;
  frameTimestamp: number;
}

export interface QipOpticalPingRecord {
  id: string;
  source: string;
  target: string;
  encodeTimeMs: number;
  displayLatencyMs: number;
  cameraLatencyMs: number;
  decodeTimeMs: number;
  roundTripTimeMs: number;
  timestamp: number;
}

export interface QipEventAuditEntry {
  id: string;
  timestamp: number;
  eventType: 
    | 'FrameDetected' 
    | 'PacketDecoded' 
    | 'PacketValidated' 
    | 'PacketRecovered' 
    | 'MessageReceived' 
    | 'MessageTransmitted' 
    | 'CommandAuthorized' 
    | 'StateUpdated' 
    | 'HandshakeCompleted'
    | 'OpticalPingRecorded';
  details: string;
  raw?: any;
}

export interface QipStateDeltaRecord {
  key: string;
  oldValue: any;
  newValue: any;
  version: number;
  timestamp: number;
}

export interface QipPackageManifest {
  packageId: string;
  name: string;
  version: string;
  author: string;
  contentHash: string; // sha256
  capabilitiesRequired: QipCapability[];
  code: string; // QPL program code
  timestamp: number;
}

export interface QipMeshRouteEntry {
  destination: string;
  nextHop: string;
  hops: number;
  lastSeen: number;
  storedMessagesCount: number;
}

export enum QipNodeStatus {
  OFFLINE = 'OFFLINE',
  IDLE = 'IDLE',
  ADVERTISING = 'ADVERTISING',
  VISIBLE = 'VISIBLE',
  PAIRED = 'PAIRED',
  BUSY = 'BUSY',
  SUSPENDED = 'SUSPENDED',
}

export enum QipHeartbeatRate {
  OFF = 'OFF',
  LOW = 'LOW',         // 10 seconds interval (low-energy discovery)
  NORMAL = 'NORMAL',   // 4 seconds interval
  DISCOVERY = 'DISCOVERY', // 1.5 seconds interval (active pairing/scanning)
}

export enum QipHeartbeatVisualMode {
  ROTATING = 'ROTATING',       // Periodically displays small animated visual marker
  PERSISTENT = 'PERSISTENT',   // Subtle persistent optical marker remains visible
  DISCOVERY = 'DISCOVERY',     // Stronger beacon optimized for camera lock-on
  STEALTH = 'STEALTH',         // Minimal discrete indicator to avoid distraction
}

export interface QipDiscoveredNode {
  nodeId: string;
  name: string;
  protocolVersion: string;
  capabilities: QipCapability[];
  carrier: QipCarrierType;
  trustState: QipTrustState;
  lastSeen: number;
  signalQuality: number; // 0 - 100%
  frameSuccessRate: number; // 0 - 100%
  sessionCount: number;
  status: QipNodeStatus;
  pairingCode?: string;
}

export interface QipHeartbeatConfig {
  rate: QipHeartbeatRate;
  visualMode: QipHeartbeatVisualMode;
  enabled: boolean;
  batteryAware: boolean;
  activeScreenOnly: boolean;
}

export interface QipReleaseMetadata {
  version: string;
  protocolVersion: string;
  commit: string;
  buildTimestamp: number;
  buildType: 'debug' | 'release' | 'nightly';
  artifacts: {
    name: string;
    size: string;
    sha256: string;
    type: 'apk' | 'aab' | 'web-zip' | 'protocol-zip' | 'manifest';
  }[];
}

export interface QipDiagnosticItem {
  id: string;
  name: string;
  category: 'core' | 'carrier' | 'hardware' | 'runtime' | 'storage';
  status: 'passed' | 'warning' | 'failed' | 'running';
  latencyMs?: number;
  details: string;
  lastChecked: number;
}

export interface QipCameraResolution {
  width: number;
  height: number;
  fps: number;
  aspectRatio: string;
  label: string;
}

export type QipOpticalLinkState = 'LOCKED' | 'ACQUIRING' | 'DEGRADED' | 'NO_SIGNAL' | 'SUSPENDED';

export interface QipOpticalDecodeHealth {
  healthScore: number;       // 0 - 100%
  linkState: QipOpticalLinkState;
  snrDb: number;             // Optical Signal-to-Noise Ratio (e.g. 18.4 dB)
  ber: number;               // Bit Error Rate (e.g. 0.0001)
  frameDropRate: number;     // 0 - 100%
  contrastScore: number;     // 0 - 100%
  ambientLux: number;        // Estimated lighting level (Lux)
  crcPassRate: number;       // 0 - 100%
  lastDecodeLatencyMs: number;
  fecRecoveredBlocks: number;
}

export type QipCameraErrorSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface QipCameraHardwareIssue {
  id: string;
  timestamp: number;
  errorCode: string;
  severity: QipCameraErrorSeverity;
  component: 'CameraX' | 'ImageAnalysis' | 'Sensor' | 'Permissions' | 'Lifecycle';
  message: string;
  troubleshooting: string[];
  resolved: boolean;
}

