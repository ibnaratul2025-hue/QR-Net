/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Node Heartbeat Service
 * Emits periodic low-rate optical discovery beacons identifying that a
 * QIP-compatible optical endpoint exists without continuously transmitting heavy data.
 */

import {
  QipCapability,
  QipCarrierType,
  QipHeartbeatConfig,
  QipHeartbeatRate,
  QipHeartbeatVisualMode,
  QipIdentity,
  QipMessageEnvelope,
  QipMessageType,
} from '../types/qip';
import { calculateCrc32 } from './crc';

export interface HeartbeatBeaconPayload {
  beacon: 'QIP_PRESENCE';
  protocol: 'QIP/1.0';
  nodeId: string;
  name: string;
  capabilities: QipCapability[];
  carrier: QipCarrierType;
  pairingCode?: string;
  heartbeatRate: QipHeartbeatRate;
  timestamp: number;
}

export type HeartbeatCallback = (beaconEnvelope: QipMessageEnvelope, payload: HeartbeatBeaconPayload) => void;
export type HeartbeatTickCallback = (phase: boolean, visualMode: QipHeartbeatVisualMode) => void;

export class QipHeartbeatService {
  private config: QipHeartbeatConfig;
  private identity: QipIdentity;
  private activeCarrier: QipCarrierType;
  private timerId: any = null;
  private visualTickTimerId: any = null;
  private isSuspended: boolean = false;
  private lastBeaconTimestamp: number = 0;
  private beaconsEmittedCount: number = 0;
  private clockPhase: boolean = false;

  private beaconListeners: Set<HeartbeatCallback> = new Set();
  private tickListeners: Set<HeartbeatTickCallback> = new Set();

  constructor(identity: QipIdentity, activeCarrier: QipCarrierType, initialConfig?: Partial<QipHeartbeatConfig>) {
    this.identity = identity;
    this.activeCarrier = activeCarrier;
    this.config = {
      rate: QipHeartbeatRate.LOW,
      visualMode: QipHeartbeatVisualMode.PERSISTENT,
      enabled: true,
      batteryAware: true,
      activeScreenOnly: true,
      ...initialConfig,
    };

    // Listen to document visibility if in browser environment
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (this.config.activeScreenOnly) {
          if (document.visibilityState === 'hidden') {
            this.suspend('Screen / Tab Hidden');
          } else {
            this.resume();
          }
        }
      });
    }

    if (this.config.enabled && this.config.rate !== QipHeartbeatRate.OFF) {
      this.start();
    }
  }

  public updateIdentity(identity: QipIdentity): void {
    this.identity = identity;
  }

  public updateCarrier(carrier: QipCarrierType): void {
    this.activeCarrier = carrier;
  }

  public getConfig(): QipHeartbeatConfig {
    return { ...this.config };
  }

  public setRate(rate: QipHeartbeatRate): void {
    this.config.rate = rate;
    this.restart();
  }

  public setVisualMode(mode: QipHeartbeatVisualMode): void {
    this.config.visualMode = mode;
    this.notifyTick();
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  public setBatteryAware(batteryAware: boolean): void {
    this.config.batteryAware = batteryAware;
  }

  public setActiveScreenOnly(activeScreenOnly: boolean): void {
    this.config.activeScreenOnly = activeScreenOnly;
  }

  public onBeacon(callback: HeartbeatCallback): () => void {
    this.beaconListeners.add(callback);
    return () => this.beaconListeners.delete(callback);
  }

  public onTick(callback: HeartbeatTickCallback): () => void {
    this.tickListeners.add(callback);
    return () => this.tickListeners.delete(callback);
  }

  public getIntervalMs(): number {
    switch (this.config.rate) {
      case QipHeartbeatRate.DISCOVERY:
        return 1500; // 1.5s
      case QipHeartbeatRate.NORMAL:
        return 4000; // 4s
      case QipHeartbeatRate.LOW:
        return 10000; // 10s (default conservative discovery rate)
      case QipHeartbeatRate.OFF:
      default:
        return 0;
    }
  }

  public start(): void {
    this.stop();
    if (!this.config.enabled || this.config.rate === QipHeartbeatRate.OFF) {
      return;
    }

    this.isSuspended = false;
    const interval = this.getIntervalMs();

    // Periodic Beacon generation
    this.emitBeacon(); // Immediate initial beacon
    this.timerId = setInterval(() => {
      if (!this.isSuspended) {
        this.emitBeacon();
      }
    }, interval);

    // Visual strobe tick (at 2Hz for visual indicator pulse)
    this.visualTickTimerId = setInterval(() => {
      if (!this.isSuspended) {
        this.clockPhase = !this.clockPhase;
        this.notifyTick();
      }
    }, 500);
  }

  public stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.visualTickTimerId) {
      clearInterval(this.visualTickTimerId);
      this.visualTickTimerId = null;
    }
  }

  public restart(): void {
    this.stop();
    this.start();
  }

  public suspend(reason?: string): void {
    this.isSuspended = true;
  }

  public resume(): void {
    if (this.isSuspended) {
      this.isSuspended = false;
      this.emitBeacon();
    }
  }

  public getStats() {
    return {
      enabled: this.config.enabled,
      rate: this.config.rate,
      visualMode: this.config.visualMode,
      intervalMs: this.getIntervalMs(),
      isSuspended: this.isSuspended,
      beaconsEmittedCount: this.beaconsEmittedCount,
      lastBeaconTimestamp: this.lastBeaconTimestamp,
    };
  }

  /**
   * Constructs the official QIP low-rate discovery beacon envelope
   */
  public generateBeaconEnvelope(): { envelope: QipMessageEnvelope; payload: HeartbeatBeaconPayload } {
    const payload: HeartbeatBeaconPayload = {
      beacon: 'QIP_PRESENCE',
      protocol: 'QIP/1.0',
      nodeId: this.identity.nodeId,
      name: this.identity.name,
      capabilities: this.identity.capabilities,
      carrier: this.activeCarrier,
      pairingCode: this.identity.pairingCode,
      heartbeatRate: this.config.rate,
      timestamp: Date.now(),
    };

    const msgId = 'qip_bcn_' + Math.random().toString(36).substring(2, 8);
    const serialized = JSON.stringify(payload);
    const checksum = calculateCrc32(serialized);

    const envelope: QipMessageEnvelope = {
      protocol: 'QIP/1.0',
      msgId,
      source: this.identity.nodeId,
      destination: 'BROADCAST',
      ttl: 1, // Beacons are local physical line-of-sight only
      hopCount: 0,
      type: QipMessageType.CAPABILITY,
      timestamp: Date.now(),
      payload,
      checksum,
    };

    return { envelope, payload };
  }

  private emitBeacon(): void {
    const { envelope, payload } = this.generateBeaconEnvelope();
    this.lastBeaconTimestamp = Date.now();
    this.beaconsEmittedCount++;

    for (const listener of this.beaconListeners) {
      try {
        listener(envelope, payload);
      } catch (err) {
        console.error('Error in QipHeartbeatService listener', err);
      }
    }
  }

  private notifyTick(): void {
    for (const listener of this.tickListeners) {
      try {
        listener(this.clockPhase, this.config.visualMode);
      } catch (err) {
        console.error('Error in QipHeartbeatService tick listener', err);
      }
    }
  }
}
