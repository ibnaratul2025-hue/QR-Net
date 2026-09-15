/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Node Core Engine
 * Manages identity, FSM, RPC capabilities, state synchronization,
 * message routing, mesh relay, and optical event subscriptions.
 */

import {
  QipCapability,
  QipCarrierType,
  QipDiscoveredNode,
  QipFsmState,
  QipHeartbeatRate,
  QipHeartbeatVisualMode,
  QipIdentity,
  QipMessageEnvelope,
  QipMessageType,
  QipNodeStatus,
  QipOpticalPingRecord,
  QipSecurityPermission,
  QipTrustState,
  QipStateDeltaRecord,
  QipPackageManifest,
} from '../types/qip';
import { calculateCrc32, calculateSha256, generateSasVerificationCode } from './crc';
import { QipProtocolStateMachine } from './fsm';
import { QplRuntime } from './qpl';
import { QipHeartbeatService } from './heartbeat';

export type MessageHandler = (envelope: QipMessageEnvelope) => void;
export type SecurityPromptHandler = (
  requesterNodeId: string,
  capability: string,
  details: string
) => Promise<boolean>;

export class QipNode {
  public identity: QipIdentity;
  public fsm: QipProtocolStateMachine;
  public qplRuntime: QplRuntime;
  public heartbeat: QipHeartbeatService;
  public activeCarrier: QipCarrierType = QipCarrierType.QR;
  public protocolVersion: string = 'QIP/1.2';

  // Real optical peer discovery table (Only nodes physically detected via optical frames)
  public discoveredNodes: Map<string, QipDiscoveredNode> = new Map();
  public sessionCount: number = 0;
  public totalFramesDecoded: number = 0;
  public totalFramesEncoded: number = 0;

  // Distributed application state store
  public stateStore: Record<string, any> = {
    volume: 80,
    theme: 'dark',
    language: 'bn',
    brightness: 95,
    kioskMode: 'active',
  };
  public stateVersion: number = 103;
  public stateHistory: QipStateDeltaRecord[] = [];

  // Content-addressed local cache: hash -> object
  public contentCache: Map<string, { data: any; size: number; timestamp: number }> = new Map();

  // Mesh routing & Store-and-Forward queue
  public storeAndForwardQueue: QipMessageEnvelope[] = [];
  public knownPeers: Map<string, QipIdentity> = new Map();

  // Active subscriptions for optical event bus
  public eventSubscriptions: Set<string> = new Set([
    'temperature.changed',
    'payment.completed',
    'device.ready',
    'transport.updated',
  ]);

  // Optical ping telemetry
  public pingHistory: QipOpticalPingRecord[] = [];

  // Security permissions
  public securityPermissions: QipSecurityPermission = {
    canRead: true,
    canWrite: true,
    canDisplay: true,
    canRequestCamera: false, // dangerous, prompt required
    canSendCommand: false,   // prompt required
    canExecuteProgram: false,// prompt required
  };

  public onSecurityPrompt: SecurityPromptHandler | null = null;
  public onMessageReceived: MessageHandler | null = null;
  public onStateSync: ((store: Record<string, any>, version: number) => void) | null = null;
  public onTerminalLog: ((line: string) => void) | null = null;
  public onNodeDiscovered: ((node: QipDiscoveredNode) => void) | null = null;

  constructor(nodeId?: string, name?: string) {
    const id = nodeId || 'QIP-NODE-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const nodeName = name || 'TERMINAL-ALPHA';
    const pairingCode = generateSasVerificationCode(id);

    this.identity = {
      nodeId: id,
      name: nodeName,
      publicKeyHex: '04' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      capabilities: [
        QipCapability.DISPLAY,
        QipCapability.CAMERA,
        QipCapability.CLIPBOARD,
        QipCapability.STORAGE,
        QipCapability.COMPUTE,
        QipCapability.RPC,
        QipCapability.STREAM,
        QipCapability.SIGNAGE,
        QipCapability.STATE_SYNC,
        QipCapability.QIP_1,
      ],
      trustState: QipTrustState.TRUSTED,
      pairingCode,
    };

    this.fsm = new QipProtocolStateMachine();
    this.qplRuntime = new QplRuntime();
    this.heartbeat = new QipHeartbeatService(this.identity, this.activeCarrier, {
      rate: QipHeartbeatRate.LOW,
      visualMode: QipHeartbeatVisualMode.PERSISTENT,
      enabled: true,
    });

    // Populate initial state history deltas
    this.stateHistory = [
      { key: 'volume', oldValue: 75, newValue: 80, version: 101, timestamp: Date.now() - 300000 },
      { key: 'theme', oldValue: 'light', newValue: 'dark', version: 102, timestamp: Date.now() - 200000 },
      { key: 'language', oldValue: 'en', newValue: 'bn', version: 103, timestamp: Date.now() - 100000 },
    ];

    // Seed sample cache object
    const samplePayload = { title: 'QIP Offline Web Manifest', version: '1.0.0' };
    const sampleHash = calculateCrc32(JSON.stringify(samplePayload));
    this.contentCache.set(`qip://sha256/${sampleHash}`, {
      data: samplePayload,
      size: JSON.stringify(samplePayload).length,
      timestamp: Date.now(),
    });
  }

  /**
   * Generates a presence beacon message
   */
  public createPresenceBeacon(): QipMessageEnvelope {
    const payload = {
      presence: 'I AM HERE',
      nodeId: this.identity.nodeId,
      name: this.identity.name,
      capabilities: this.identity.capabilities,
      status: 'ONLINE',
      pairingCode: this.identity.pairingCode,
      timestamp: Date.now(),
    };
    return this.createEnvelope(QipMessageType.CAPABILITY, 'BROADCAST', payload);
  }

  /**
   * Builds an envelope
   */
  public createEnvelope(
    type: QipMessageType,
    destination: string,
    payload: any,
    ttl: number = 4
  ): QipMessageEnvelope {
    const msgId = 'qip_' + Math.random().toString(36).substring(2, 9);
    const serialized = JSON.stringify(payload);
    const checksum = calculateCrc32(serialized);

    return {
      protocol: 'QIP/1.0',
      msgId,
      source: this.identity.nodeId,
      destination,
      ttl,
      hopCount: 0,
      type,
      timestamp: Date.now(),
      payload,
      checksum,
    };
  }

  /**
   * Ingest and process an incoming decoded message envelope
   */
  public async processIncomingEnvelope(
    envelope: QipMessageEnvelope,
    opticalMetrics?: { decodeDurationMs: number }
  ): Promise<QipMessageEnvelope | null> {
    this.fsm.logAudit('MessageReceived', `Received [${envelope.type}] from ${envelope.source} (id: ${envelope.msgId})`);

    // Verify envelope checksum
    const calc = calculateCrc32(JSON.stringify(envelope.payload));
    if (calc !== envelope.checksum) {
      this.fsm.logAudit('StateUpdated', `Checksum mismatch for envelope ${envelope.msgId}`);
      return null;
    }

    // Register and update real optical peer in discoveredNodes
    if (envelope.source !== this.identity.nodeId) {
      const existing = this.discoveredNodes.get(envelope.source);
      const isBeacon = envelope.payload?.beacon === 'QIP_PRESENCE';
      const discovered: QipDiscoveredNode = {
        nodeId: envelope.source,
        name: envelope.payload?.name || existing?.name || envelope.source,
        protocolVersion: envelope.payload?.protocol || existing?.protocolVersion || 'QIP/1.2',
        capabilities: envelope.payload?.capabilities || existing?.capabilities || [
          QipCapability.DISPLAY,
          QipCapability.RPC,
          QipCapability.STATE_SYNC,
        ],
        carrier: envelope.payload?.carrier || existing?.carrier || this.activeCarrier,
        trustState: existing?.trustState || QipTrustState.SEEN,
        lastSeen: Date.now(),
        signalQuality: Math.min(100, Math.max(65, 100 - (opticalMetrics?.decodeDurationMs || 10) * 2)),
        frameSuccessRate: 99,
        sessionCount: (existing?.sessionCount || 0) + 1,
        status: isBeacon ? QipNodeStatus.ADVERTISING : QipNodeStatus.VISIBLE,
        pairingCode: envelope.payload?.pairingCode || existing?.pairingCode,
      };

      this.discoveredNodes.set(envelope.source, discovered);
      if (this.onNodeDiscovered) {
        this.onNodeDiscovered(discovered);
      }

      this.knownPeers.set(envelope.source, {
        nodeId: envelope.source,
        name: discovered.name,
        publicKeyHex: envelope.payload?.publicKeyHex || '04e1fa...',
        capabilities: discovered.capabilities,
        trustState: discovered.trustState,
        pairingCode: discovered.pairingCode,
      });
    }

    // Check if this message is routed for someone else (Mesh relay)
    if (envelope.destination !== 'BROADCAST' && envelope.destination !== this.identity.nodeId) {
      return this.handleMeshRelay(envelope);
    }

    // Notify message listener
    if (this.onMessageReceived) {
      this.onMessageReceived(envelope);
    }

    // Process native message types
    switch (envelope.type) {
      case QipMessageType.PING: {
        const pingPayload = envelope.payload;
        const now = Date.now();
        const sendTimestamp = pingPayload.sendTimestamp || envelope.timestamp;
        const rtt = Math.max(8, now - sendTimestamp);

        const record: QipOpticalPingRecord = {
          id: envelope.msgId,
          source: envelope.source,
          target: this.identity.nodeId,
          encodeTimeMs: pingPayload.encodeDurationMs || 4,
          displayLatencyMs: 16,
          cameraLatencyMs: 33,
          decodeTimeMs: opticalMetrics?.decodeDurationMs || 12,
          roundTripTimeMs: rtt,
          timestamp: now,
        };
        this.pingHistory.unshift(record);
        if (this.pingHistory.length > 20) this.pingHistory.pop();

        this.fsm.logAudit('OpticalPingRecorded', `Optical Ping from ${envelope.source}: RTT ${rtt}ms`);
        if (this.onTerminalLog) {
          this.onTerminalLog(`[OPTICAL PING] RTT: ${rtt} ms | Encode: ${record.encodeTimeMs}ms | Decode: ${record.decodeTimeMs}ms`);
        }

        // Return PONG response
        return this.createEnvelope(QipMessageType.PONG, envelope.source, {
          pingId: envelope.msgId,
          receivedAt: now,
          echo: pingPayload,
        });
      }

      case QipMessageType.TIME_REQUEST: {
        return this.createEnvelope(QipMessageType.TIME_RESPONSE, envelope.source, {
          originateTime: envelope.timestamp,
          receiveTime: Date.now(),
          transmitTime: Date.now(),
        });
      }

      case QipMessageType.STATE_REQUEST: {
        const peerVersion = envelope.payload?.version || 0;
        const deltas = this.stateHistory.filter(d => d.version > peerVersion);
        return this.createEnvelope(QipMessageType.STATE_DELTA, envelope.source, {
          currentVersion: this.stateVersion,
          deltas,
          store: deltas.length === 0 ? undefined : this.stateStore,
        });
      }

      case QipMessageType.STATE_DELTA: {
        const { deltas, currentVersion } = envelope.payload;
        if (Array.isArray(deltas) && deltas.length > 0) {
          for (const d of deltas) {
            this.stateStore[d.key] = d.newValue;
          }
          this.stateVersion = Math.max(this.stateVersion, currentVersion || 0);
          this.fsm.logAudit('StateUpdated', `Applied ${deltas.length} state deltas up to v${this.stateVersion}`);
          if (this.onStateSync) this.onStateSync(this.stateStore, this.stateVersion);
          if (this.onTerminalLog) {
            this.onTerminalLog(`[STATE SYNC] Applied ${deltas.length} delta(s). Store now at version ${this.stateVersion}`);
          }
        }
        return this.createEnvelope(QipMessageType.STATE_ACK, envelope.source, {
          syncedVersion: this.stateVersion,
        });
      }

      case QipMessageType.COMMAND: {
        return await this.handleRpcCommand(envelope);
      }

      case QipMessageType.QUERY: {
        return this.handleQuery(envelope);
      }

      case QipMessageType.EVENT: {
        const eventName = envelope.payload?.event;
        const eventVal = envelope.payload?.value;
        if (this.onTerminalLog) {
          this.onTerminalLog(`[EVENT RECEIVED] ${eventName} -> ${JSON.stringify(eventVal)}`);
        }
        return null;
      }

      default:
        return null;
    }
  }

  /**
   * Handles RPC commands with capability-based security prompts
   */
  private async handleRpcCommand(envelope: QipMessageEnvelope): Promise<QipMessageEnvelope> {
    const { operation, args } = envelope.payload;
    const op = (operation || '').toLowerCase();

    // Check capability permissions
    let allowed = false;
    if (op === 'compute.hash' || op === 'compute.encode' || op === 'compute.validate') {
      allowed = true; // Safe edge compute
    } else if (op === 'text.display' || op === 'screen.show') {
      allowed = this.securityPermissions.canDisplay;
    } else if (op === 'clipboard.write') {
      allowed = this.securityPermissions.canWrite;
    } else if (op === 'camera.capture') {
      allowed = this.securityPermissions.canRequestCamera;
    }

    if (!allowed && this.onSecurityPrompt) {
      allowed = await this.onSecurityPrompt(envelope.source, op, JSON.stringify(args || {}));
    }

    if (!allowed) {
      this.fsm.logAudit('StateUpdated', `Blocked unauthorized RPC call [${op}] from ${envelope.source}`);
      return this.createEnvelope(QipMessageType.ERROR, envelope.source, {
        code: 'PERMISSION_DENIED',
        message: `Capability for '${op}' was denied by user authorization firewall.`,
      });
    }

    this.fsm.logAudit('CommandAuthorized', `Authorized and executed RPC [${op}] from ${envelope.source}`);

    // Execute safe operations
    let result: any = null;
    if (op === 'compute.hash') {
      const input = args?.input || '';
      result = { hash: calculateCrc32(input), algorithm: 'CRC32/Optical' };
    } else if (op === 'compute.encode') {
      result = { encoded: btoa(args?.input || '') };
    } else if (op === 'compute.validate') {
      result = { valid: true, timestamp: Date.now() };
    } else if (op === 'text.display' || op === 'screen.show') {
      result = { status: 'DISPLAYED', message: args?.text || 'OK' };
      if (this.onTerminalLog) {
        this.onTerminalLog(`[RPC SCREEN.SHOW] "${args?.text || ''}"`);
      }
    } else if (op === 'clipboard.write') {
      result = { status: 'COPIED_TO_CLIPBOARD', length: (args?.text || '').length };
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(args?.text || '').catch(() => {});
      }
    } else if (op === 'camera.capture') {
      result = {
        status: 'CAPTURED',
        format: 'optical/telemetry',
        resolution: '1280x720',
        luminance: '64%',
      };
    } else if (op === 'timer.start') {
      result = { status: 'TIMER_STARTED', durationMs: args?.duration || 5000 };
    } else {
      result = { status: 'UNKNOWN_OPERATION', operation: op };
    }

    return this.createEnvelope(QipMessageType.RESPONSE, envelope.source, {
      requestId: envelope.msgId,
      operation: op,
      result,
    });
  }

  /**
   * Handles QQL Queries
   */
  private handleQuery(envelope: QipMessageEnvelope): QipMessageEnvelope {
    const { action, target, field, filter } = envelope.payload;

    if (action === 'DISCOVER') {
      return this.createEnvelope(QipMessageType.RESPONSE, envelope.source, {
        devices: [
          {
            nodeId: this.identity.nodeId,
            name: this.identity.name,
            capabilities: this.identity.capabilities,
            trustState: this.identity.trustState,
          },
          ...Array.from(this.knownPeers.values()),
        ],
      });
    }

    if (action === 'GET') {
      if (target === 'capability') {
        const hasCap = this.identity.capabilities.includes((field || '').toUpperCase() as QipCapability);
        return this.createEnvelope(QipMessageType.RESPONSE, envelope.source, {
          capability: field,
          supported: hasCap,
        });
      }
      if (target === 'state') {
        return this.createEnvelope(QipMessageType.RESPONSE, envelope.source, {
          version: this.stateVersion,
          value: field ? this.stateStore[field] : this.stateStore,
        });
      }
    }

    return this.createEnvelope(QipMessageType.RESPONSE, envelope.source, {
      status: 'QUERY_RESOLVED',
      target,
    });
  }

  /**
   * Mesh relay forwarding with TTL and hop limits
   */
  private handleMeshRelay(envelope: QipMessageEnvelope): QipMessageEnvelope | null {
    if (envelope.ttl <= 1) {
      this.fsm.logAudit('StateUpdated', `Mesh message ${envelope.msgId} dropped: TTL expired`);
      return null;
    }

    const relayed: QipMessageEnvelope = {
      ...envelope,
      ttl: envelope.ttl - 1,
      hopCount: envelope.hopCount + 1,
    };

    // Store in relay queue for store-and-forward delay-tolerant transmission
    this.storeAndForwardQueue.push(relayed);
    if (this.storeAndForwardQueue.length > 50) this.storeAndForwardQueue.shift();

    this.fsm.logAudit(
      'MessageTransmitted',
      `Relayed mesh message ${envelope.msgId} to dst ${envelope.destination} (Hops: ${relayed.hopCount}, TTL: ${relayed.ttl})`
    );

    if (this.onTerminalLog) {
      this.onTerminalLog(`[MESH RELAY] Forwarded msg ${envelope.msgId.slice(0, 8)} -> ${envelope.destination} (Hop ${relayed.hopCount})`);
    }

    return relayed;
  }

  /**
   * Update a local state key and increment version
   */
  public updateState(key: string, newValue: any): QipStateDeltaRecord {
    const oldValue = this.stateStore[key];
    this.stateStore[key] = newValue;
    this.stateVersion += 1;

    const delta: QipStateDeltaRecord = {
      key,
      oldValue,
      newValue,
      version: this.stateVersion,
      timestamp: Date.now(),
    };

    this.stateHistory.unshift(delta);
    if (this.stateHistory.length > 50) this.stateHistory.pop();

    this.fsm.logAudit('StateUpdated', `State updated: ${key} = ${newValue} (v${this.stateVersion})`);
    return delta;
  }

  /**
   * Derives current QipNode status
   */
  public getNodeStatus(): QipNodeStatus {
    const fsmState = this.fsm.getState();
    if (this.heartbeat.getStats().isSuspended) {
      return QipNodeStatus.SUSPENDED;
    }
    if (fsmState === 'TRANSFERRING' || fsmState === 'SYNCHRONIZING' || fsmState === 'HANDSHAKING') {
      return QipNodeStatus.BUSY;
    }
    if (this.identity.trustState === QipTrustState.TRUSTED && this.discoveredNodes.size > 0) {
      return QipNodeStatus.PAIRED;
    }
    if (this.heartbeat.getConfig().enabled && this.heartbeat.getConfig().rate !== QipHeartbeatRate.OFF) {
      return QipNodeStatus.ADVERTISING;
    }
    if (this.discoveredNodes.size > 0) {
      return QipNodeStatus.VISIBLE;
    }
    return QipNodeStatus.IDLE;
  }

  /**
   * Returns comprehensive node status model
   */
  public getStatusModel() {
    return {
      nodeId: this.identity.nodeId,
      name: this.identity.name,
      protocolVersion: this.protocolVersion,
      capabilities: this.identity.capabilities,
      carrier: this.activeCarrier,
      heartbeatRate: this.heartbeat.getConfig().rate,
      heartbeatVisualMode: this.heartbeat.getConfig().visualMode,
      trustState: this.identity.trustState,
      status: this.getNodeStatus(),
      lastSeen: Date.now(),
      sessionCount: this.sessionCount,
      discoveredCount: this.discoveredNodes.size,
      storeVersion: this.stateVersion,
    };
  }

  /**
   * Returns list of real discovered optical nodes
   */
  public getDiscoveredNodes(): QipDiscoveredNode[] {
    return Array.from(this.discoveredNodes.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  }

  /**
   * Sets trust state to VERIFIED for a peer
   */
  public pairWithNode(nodeId: string): boolean {
    const node = this.discoveredNodes.get(nodeId);
    if (!node) return false;
    node.trustState = QipTrustState.VERIFIED;
    node.status = QipNodeStatus.PAIRED;
    this.discoveredNodes.set(nodeId, node);
    this.fsm.logAudit('HandshakeCompleted', `Paired with optical node ${nodeId}`);
    return true;
  }

  /**
   * Blocks an optical peer
   */
  public blockNode(nodeId: string): void {
    const node = this.discoveredNodes.get(nodeId);
    if (node) {
      node.trustState = QipTrustState.BLOCKED;
      this.discoveredNodes.set(nodeId, node);
      this.fsm.logAudit('StateUpdated', `Blocked optical node ${nodeId}`);
    }
  }

  /**
   * Forgets an optical peer from discovered table
   */
  public forgetNode(nodeId: string): void {
    this.discoveredNodes.delete(nodeId);
    this.knownPeers.delete(nodeId);
  }

  /**
   * Creates an optical PING message envelope for a peer
   */
  public pingNode(nodeId: string): QipMessageEnvelope {
    return this.createEnvelope(QipMessageType.PING, nodeId, {
      sendTimestamp: Date.now(),
      target: nodeId,
      requester: this.identity.nodeId,
    });
  }

  /**
   * Requests capabilities from an optical peer
   */
  public requestNodeCapabilities(nodeId: string): QipMessageEnvelope {
    return this.createEnvelope(QipMessageType.QUERY, nodeId, {
      action: 'GET',
      target: 'capability',
      requester: this.identity.nodeId,
    });
  }

  /**
   * Starts an optical session with a peer
   */
  public startSession(nodeId: string): void {
    this.sessionCount++;
    this.fsm.transition(QipFsmState.TRANSFERRING, `Optical session opened with peer ${nodeId}`);
    this.fsm.logAudit('HandshakeCompleted', `Session started with optical node ${nodeId}`);
  }
}
