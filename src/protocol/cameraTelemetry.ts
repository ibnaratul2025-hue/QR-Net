/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Camera Hardware Telemetry & Error Listener Hub
 * Surfaces low-level CameraX hardware events, sensor metrics,
 * frame resolutions, and optical decode health to the Diagnostics Panel.
 */

import {
  QipCameraHardwareIssue,
  QipCameraResolution,
  QipOpticalDecodeHealth,
  QipOpticalLinkState,
} from '../types/qip';

type HardwareIssueListener = (issue: QipCameraHardwareIssue) => void;
type TelemetryListener = (health: QipOpticalDecodeHealth, res: QipCameraResolution) => void;

class CameraHardwareHub {
  private issues: QipCameraHardwareIssue[] = [];
  private issueListeners: Set<HardwareIssueListener> = new Set();
  private telemetryListeners: Set<TelemetryListener> = new Set();

  private currentResolution: QipCameraResolution = {
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatio: '16:9',
    label: '1080p FHD (1920×1080)',
  };

  private currentHealth: QipOpticalDecodeHealth = {
    healthScore: 94,
    linkState: 'LOCKED',
    snrDb: 18.2,
    ber: 0.0002,
    frameDropRate: 0.5,
    contrastScore: 88,
    ambientLux: 340,
    crcPassRate: 99.4,
    lastDecodeLatencyMs: 14,
    fecRecoveredBlocks: 0,
  };

  constructor() {
    // Seed initial operational baseline issue for audit logging
    this.reportHardwareEvent({
      errorCode: 'CAMERAX_INIT_OK',
      severity: 'INFO',
      component: 'CameraX',
      message: 'CameraX provider initialized with YUV_420_888 optical frame analyzer.',
      troubleshooting: [
        'Camera subsystem operational.',
        'Ready for optical transmission reception.',
      ],
      resolved: true,
    });
  }

  public subscribeIssues(listener: HardwareIssueListener): () => void {
    this.issueListeners.add(listener);
    return () => this.issueListeners.delete(listener);
  }

  public subscribeTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    listener(this.currentHealth, this.currentResolution);
    return () => this.telemetryListeners.delete(listener);
  }

  public reportHardwareEvent(params: {
    errorCode: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    component: 'CameraX' | 'ImageAnalysis' | 'Sensor' | 'Permissions' | 'Lifecycle';
    message: string;
    troubleshooting: string[];
    resolved?: boolean;
  }): QipCameraHardwareIssue {
    const issue: QipCameraHardwareIssue = {
      id: `cam_hw_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      errorCode: params.errorCode,
      severity: params.severity,
      component: params.component,
      message: params.message,
      troubleshooting: params.troubleshooting,
      resolved: params.resolved ?? false,
    };

    this.issues.unshift(issue);
    if (this.issues.length > 50) this.issues.pop();

    this.issueListeners.forEach((fn) => fn(issue));
    return issue;
  }

  public resolveIssue(issueId: string): void {
    const target = this.issues.find((i) => i.id === issueId);
    if (target) {
      target.resolved = true;
      this.issueListeners.forEach((fn) => fn(target));
    }
  }

  public clearResolved(): void {
    this.issues = this.issues.filter((i) => !i.resolved);
  }

  public getIssues(): QipCameraHardwareIssue[] {
    return [...this.issues];
  }

  public getActiveIssues(): QipCameraHardwareIssue[] {
    return this.issues.filter((i) => !i.resolved);
  }

  public updateResolution(width: number, height: number, fps: number = 30): void {
    let label = `${width}×${height}`;
    let aspectRatio = '4:3';
    if (width >= 1920) {
      label = `1080p FHD (${width}×${height})`;
      aspectRatio = '16:9';
    } else if (width >= 1280) {
      label = `720p HD (${width}×${height})`;
      aspectRatio = '16:9';
    } else if (width >= 640) {
      label = `VGA (${width}×${height})`;
      aspectRatio = '4:3';
    }

    this.currentResolution = {
      width,
      height,
      fps,
      aspectRatio,
      label,
    };
    this.notifyTelemetry();
  }

  public updateDecodeHealth(partial: Partial<QipOpticalDecodeHealth>): void {
    this.currentHealth = { ...this.currentHealth, ...partial };

    // Auto calculate link state from health score
    let state: QipOpticalLinkState = 'LOCKED';
    if (this.currentHealth.healthScore >= 80) state = 'LOCKED';
    else if (this.currentHealth.healthScore >= 50) state = 'ACQUIRING';
    else if (this.currentHealth.healthScore >= 20) state = 'DEGRADED';
    else state = 'NO_SIGNAL';

    if (!partial.linkState) {
      this.currentHealth.linkState = state;
    }

    this.notifyTelemetry();
  }

  public getTelemetry(): { health: QipOpticalDecodeHealth; resolution: QipCameraResolution } {
    return {
      health: { ...this.currentHealth },
      resolution: { ...this.currentResolution },
    };
  }

  private notifyTelemetry(): void {
    this.telemetryListeners.forEach((fn) => fn(this.currentHealth, this.currentResolution));
  }
}

export const qipCameraHardwareHub = new CameraHardwareHub();
