/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Android Optical Link View & Hardware Simulator
 * Visualizes the Android Compose UI with real-time camera resolution,
 * optical decode health metrics, DefaultLifecycleObserver controls,
 * and CameraX error listener diagnostics.
 */

import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Camera,
  Activity,
  AlertTriangle,
  XCircle,
  CheckCircle,
  RefreshCw,
  Shield,
  Radio,
  Eye,
  Sliders,
  Play,
  Pause,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { qipCameraHardwareHub } from '../protocol/cameraTelemetry';
import {
  QipCameraHardwareIssue,
  QipCameraResolution,
  QipOpticalDecodeHealth,
} from '../types/qip';

interface AndroidOpticalLinkViewProps {
  onOpenDiagnostics?: () => void;
}

export const AndroidOpticalLinkView: React.FC<AndroidOpticalLinkViewProps> = ({
  onOpenDiagnostics,
}) => {
  const [telemetry, setTelemetry] = useState<{
    health: QipOpticalDecodeHealth;
    resolution: QipCameraResolution;
  }>(qipCameraHardwareHub.getTelemetry());
  const [activeIssues, setActiveIssues] = useState<QipCameraHardwareIssue[]>(
    qipCameraHardwareHub.getActiveIssues()
  );

  // Android lifecycle state simulation
  const [appState, setAppState] = useState<'FOREGROUND' | 'BACKGROUND'>('FOREGROUND');
  const [permissionState, setPermissionState] = useState<'GRANTED' | 'DENIED' | 'RATIONALE'>('GRANTED');
  const [sensorFacing, setSensorFacing] = useState<'BACK' | 'FRONT'>('BACK');

  useEffect(() => {
    const unsubTelemetry = qipCameraHardwareHub.subscribeTelemetry((health, resolution) => {
      setTelemetry({ health, resolution });
    });

    const unsubIssues = qipCameraHardwareHub.subscribeIssues(() => {
      setActiveIssues(qipCameraHardwareHub.getActiveIssues());
    });

    return () => {
      unsubTelemetry();
      unsubIssues();
    };
  }, []);

  // Simulate Android Lifecycle Observer onPause / onResume
  const toggleBackgroundState = () => {
    if (appState === 'FOREGROUND') {
      setAppState('BACKGROUND');
      qipCameraHardwareHub.reportHardwareEvent({
        errorCode: 'LIFECYCLE_SUSPENDED',
        severity: 'INFO',
        component: 'Lifecycle',
        message: 'DefaultLifecycleObserver triggered ON_PAUSE: Camera sensors and optical worker threads suspended.',
        troubleshooting: [
          'Bring app to foreground to resume CameraX optical reception.',
          'Suspension preserves battery and thermal budget while screen is off or obscured.',
        ],
      });
      qipCameraHardwareHub.updateDecodeHealth({
        healthScore: 0,
        linkState: 'SUSPENDED',
      });
    } else {
      setAppState('FOREGROUND');
      qipCameraHardwareHub.reportHardwareEvent({
        errorCode: 'LIFECYCLE_RESUMED',
        severity: 'INFO',
        component: 'Lifecycle',
        message: 'DefaultLifecycleObserver triggered ON_RESUME: CameraX optical frame analyzer resumed.',
        troubleshooting: [],
        resolved: true,
      });
      qipCameraHardwareHub.updateDecodeHealth({
        healthScore: 94,
        linkState: 'LOCKED',
      });
    }
  };

  // Simulate Camera Permission cycle
  const togglePermission = () => {
    if (permissionState === 'GRANTED') {
      setPermissionState('DENIED');
      qipCameraHardwareHub.reportHardwareEvent({
        errorCode: 'PERMISSION_DENIED',
        severity: 'CRITICAL',
        component: 'Permissions',
        message: 'Camera permission denied by user. QipCameraPermissionHandler blocked transceiver launch.',
        troubleshooting: [
          'Grant Camera permission in the prompt to allow optical reception.',
          'Open Android Settings > Apps > QIP Optical Node > Permissions > Camera.',
        ],
      });
      qipCameraHardwareHub.updateDecodeHealth({
        healthScore: 0,
        linkState: 'NO_SIGNAL',
      });
    } else {
      setPermissionState('GRANTED');
      qipCameraHardwareHub.reportHardwareEvent({
        errorCode: 'PERMISSION_GRANTED',
        severity: 'INFO',
        component: 'Permissions',
        message: 'Camera permission granted. QipCameraPermissionHandler authorized CameraX optical transceiver.',
        troubleshooting: [],
        resolved: true,
      });
      qipCameraHardwareHub.updateDecodeHealth({
        healthScore: 94,
        linkState: 'LOCKED',
      });
    }
  };

  const healthColor =
    telemetry.health.healthScore >= 80
      ? 'text-emerald-400'
      : telemetry.health.healthScore >= 50
      ? 'text-cyan-400'
      : telemetry.health.healthScore >= 20
      ? 'text-amber-400'
      : 'text-rose-400';

  const healthBg =
    telemetry.health.healthScore >= 80
      ? 'bg-emerald-400'
      : telemetry.health.healthScore >= 50
      ? 'bg-cyan-400'
      : telemetry.health.healthScore >= 20
      ? 'bg-amber-400'
      : 'bg-rose-400';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-mono text-base font-bold text-slate-100 flex items-center space-x-2">
              <span>Android Optical UI & Telemetry Simulator</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono">
                JETPACK COMPOSE + CAMERAX
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live mirror of the Android QipOpticalIndicatorView, DefaultLifecycleObserver, and CameraX error handling.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onOpenDiagnostics && (
            <button
              onClick={onOpenDiagnostics}
              className="px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 font-mono text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <span>Diagnostics Panel</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Simulated Android Phone Display Frame */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="w-full max-w-[340px] bg-slate-950 rounded-[36px] border-4 border-slate-800 p-3 shadow-2xl relative flex flex-col justify-between min-h-[520px]">
            {/* Phone Top Notch / Speaker */}
            <div className="flex items-center justify-between px-3 py-1 text-[10px] font-mono text-slate-400 border-b border-slate-900 mb-2">
              <span>12:45</span>
              <div className="w-16 h-3 bg-slate-900 rounded-full mx-auto" />
              <div className="flex items-center space-x-1">
                <span>5G</span>
                <span>98%</span>
              </div>
            </div>

            {/* Android Screen Content */}
            <div className="space-y-3 flex-1 flex flex-col">
              {/* App Bar */}
              <div className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                <span className="font-mono text-xs font-bold text-cyan-400 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>QIP OPTICAL NODE</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  v1.2.0-apk
                </span>
              </div>

              {/* Camera Preview Box with Reticle */}
              <div className="relative h-44 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center">
                {appState === 'BACKGROUND' ? (
                  <div className="p-4 text-center space-y-2">
                    <Pause className="w-8 h-8 text-cyan-400 mx-auto animate-pulse" />
                    <div className="font-mono text-xs font-bold text-slate-300">
                      APP IN BACKGROUND
                    </div>
                    <div className="font-mono text-[10px] text-slate-500">
                      DefaultLifecycleObserver suspended camera & optical workers
                    </div>
                  </div>
                ) : permissionState === 'DENIED' ? (
                  <div className="p-4 text-center space-y-2">
                    <Shield className="w-8 h-8 text-rose-400 mx-auto" />
                    <div className="font-mono text-xs font-bold text-rose-300">
                      CAMERA PERMISSION REQUIRED
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">
                      Grant permission in lifecycle handler to initialize CameraX
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/20 to-slate-950/80" />
                    {/* Reticle */}
                    <div className="w-28 h-28 border-2 border-dashed border-cyan-400/80 rounded-xl relative flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
                      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
                      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />
                    </div>

                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                      <span className="text-emerald-400 flex items-center space-x-1">
                        <Camera className="w-3 h-3" />
                        <span>CameraX Active ({sensorFacing})</span>
                      </span>
                      <span className="text-slate-400">{telemetry.resolution.fps} FPS</span>
                    </div>
                  </>
                )}
              </div>

              {/* ============================================================== */}
              {/* THE ANDROID UI VISUAL INDICATOR (Real-time Resolution & Health) */}
              {/* ============================================================== */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-inner">
                {/* Header: Resolution & Link Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${healthBg} animate-pulse`} />
                    <span className="font-mono text-[10px] font-bold text-slate-300 tracking-wider">
                      OPTICAL LINK
                    </span>
                  </div>

                  {/* Resolution Badge */}
                  <span className="font-mono text-[11px] font-bold text-cyan-400 px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                    {telemetry.resolution.width}×{telemetry.resolution.height}
                  </span>
                </div>

                {/* Decode Health Progress Bar & State */}
                <div>
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className={`font-bold ${healthColor}`}>
                      Health: {telemetry.health.healthScore}% ({telemetry.health.linkState})
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      SNR: {telemetry.health.snrDb} dB
                    </span>
                  </div>

                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-300 ${healthBg}`}
                      style={{ width: `${telemetry.health.healthScore}%` }}
                    />
                  </div>
                </div>

                {/* Secondary Telemetry Strip */}
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-center text-slate-400 border border-slate-800/80">
                  <div>
                    <span className="text-slate-500 block text-[9px]">CONTRAST</span>
                    <span className="text-slate-200 font-bold">{telemetry.health.contrastScore}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">AMBIENT</span>
                    <span className="text-slate-200 font-bold">{telemetry.health.ambientLux} lx</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">BER</span>
                    <span className="text-slate-200 font-bold">{telemetry.health.ber}</span>
                  </div>
                </div>

                {/* Hardware Alert Banner inside Android UI if issues exist */}
                {activeIssues.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800 text-[10px] font-mono space-y-1">
                    <div className="flex items-center space-x-1 font-bold text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>HARDWARE ALERT: [{activeIssues[0].errorCode}]</span>
                    </div>
                    <div className="text-rose-200 line-clamp-2">
                      {activeIssues[0].message}
                    </div>
                    {onOpenDiagnostics && (
                      <button
                        onClick={onOpenDiagnostics}
                        className="text-cyan-400 underline hover:text-cyan-300 block pt-0.5 cursor-pointer"
                      >
                        Troubleshoot in Diagnostics →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Android Home Navigation Bar */}
            <div className="pt-3 flex justify-center">
              <div className="w-28 h-1 bg-slate-700 rounded-full" />
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Android Subsystem Testing Workbench */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-2">
              <Sliders className="w-3.5 h-3.5" />
              <span>Android Lifecycle & CameraX Controls</span>
            </h4>
            <p className="text-xs text-slate-400">
              Verify how the Android architecture responds to system lifecycle transitions, permission prompts, and camera sensor changes.
            </p>

            <div className="space-y-3 pt-2">
              {/* 1. DefaultLifecycleObserver Controller */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-200">
                    DefaultLifecycleObserver: App State
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Suspends camera capture & decoding threads in background
                  </div>
                </div>
                <button
                  onClick={toggleBackgroundState}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-colors cursor-pointer ${
                    appState === 'FOREGROUND'
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-600/40 hover:bg-amber-900'
                      : 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-900'
                  }`}
                >
                  {appState === 'FOREGROUND' ? 'Background App' : 'Foreground App'}
                </button>
              </div>

              {/* 2. Permission Request Handler */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-200">
                    QipCameraPermissionHandler
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Status: <b className="text-slate-200">{permissionState}</b>
                  </div>
                </div>
                <button
                  onClick={togglePermission}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-colors cursor-pointer ${
                    permissionState === 'GRANTED'
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-600/40 hover:bg-rose-900'
                      : 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-900'
                  }`}
                >
                  {permissionState === 'GRANTED' ? 'Revoke Permission' : 'Grant Permission'}
                </button>
              </div>

              {/* 3. Camera Resolution Switcher */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="font-mono text-xs font-bold text-slate-200">
                  CameraX Target Resolution Selector
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  {[
                    { label: '1080p FHD', w: 1920, h: 1080 },
                    { label: '720p HD', w: 1280, h: 720 },
                    { label: '480p VGA', w: 640, h: 480 },
                  ].map((res) => (
                    <button
                      key={res.label}
                      onClick={() => qipCameraHardwareHub.updateResolution(res.w, res.h, 30)}
                      className={`p-2 rounded-lg border text-center transition-colors cursor-pointer ${
                        telemetry.resolution.width === res.w
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Sensor Facing Switch */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-200">
                    Camera Selector Lens
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Current: <b className="text-cyan-400">{sensorFacing}_CAMERA</b>
                  </div>
                </div>
                <button
                  onClick={() => setSensorFacing(sensorFacing === 'BACK' ? 'FRONT' : 'BACK')}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-mono text-xs transition-colors cursor-pointer"
                >
                  Flip Sensor
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
