/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Database,
  Layers,
  Zap,
} from 'lucide-react';
import { QipNode } from '../protocol/node';
import { QipMessageType, QipStateDeltaRecord } from '../types/qip';

interface OpticalSyncPanelProps {
  node: QipNode;
  onDispatchEnvelope: (envelope: any) => void;
}

export const OpticalSyncPanel: React.FC<OpticalSyncPanelProps> = ({
  node,
  onDispatchEnvelope,
}) => {
  // Local Node state
  const [localStore, setLocalStore] = useState({ ...node.stateStore });
  const [localVersion, setLocalVersion] = useState(node.stateVersion);

  // Peer Node state (starts at an older version to demonstrate delta protocol)
  const [peerStore, setPeerStore] = useState<Record<string, any>>({
    volume: 50,
    theme: 'light',
    language: 'en',
    brightness: 80,
    kioskMode: 'idle',
  });
  const [peerVersion, setPeerVersion] = useState<number>(97);
  const [syncLogs, setSyncLogs] = useState<string[]>([
    'Optical State Sync protocol initialized.',
    'Node Alpha is at version 103. Peer Node Beta is at version 97.',
  ]);
  const [transmittedDeltas, setTransmittedDeltas] = useState<QipStateDeltaRecord[]>([]);

  // Update a key on Node Alpha
  const handleModifyLocal = (key: string, value: any) => {
    const delta = node.updateState(key, value);
    setLocalStore({ ...node.stateStore });
    setLocalVersion(node.stateVersion);

    setSyncLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] Local state modified: ${key} = ${value} (v${node.stateVersion})`,
      ...prev.slice(0, 15),
    ]);
  };

  // Run Optical Delta Sync
  const handlePerformDeltaSync = () => {
    const versionGap = localVersion - peerVersion;
    if (versionGap <= 0) {
      setSyncLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] State is already up to date (both at v${localVersion}). No transfer needed.`,
        ...prev,
      ]);
      return;
    }

    // Determine missing deltas
    const missingDeltas = node.stateHistory.filter((d) => d.version > peerVersion);

    // If history didn't cover everything, synthesize missing deltas
    const fullDeltasToTransmit: QipStateDeltaRecord[] = missingDeltas.length > 0
      ? missingDeltas
      : Object.entries(localStore).map(([k, v], idx) => ({
          key: k,
          oldValue: peerStore[k],
          newValue: v,
          version: peerVersion + idx + 1,
          timestamp: Date.now(),
        }));

    setTransmittedDeltas(fullDeltasToTransmit);

    // Build STATE_DELTA envelope
    const envelope = node.createEnvelope(QipMessageType.STATE_DELTA, 'PEER-NODE-BETA', {
      currentVersion: localVersion,
      baseVersion: peerVersion,
      missingVersionsCount: versionGap,
      deltas: fullDeltasToTransmit,
    });

    onDispatchEnvelope(envelope);

    // Apply deltas to Peer Node Beta to simulate catching up
    const updatedPeer = { ...peerStore };
    fullDeltasToTransmit.forEach((d) => {
      updatedPeer[d.key] = d.newValue;
    });
    setPeerStore(updatedPeer);
    setPeerVersion(localVersion);

    setSyncLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] SYNCHRONIZED: Transmitted ${fullDeltasToTransmit.length} delta(s). Peer upgraded from v${peerVersion} -> v${localVersion}. Resent 0 unmodified keys.`,
      ...prev.slice(0, 15),
    ]);
  };

  const versionDifference = Math.max(0, localVersion - peerVersion);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold font-mono text-cyan-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            OPTICAL SYNCHRONIZATION & STATE DELTA PROTOCOL
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Distributed state reconciliation over visual states. Only missing differential changes
            are transmitted across optical frames, preserving optical bandwidth.
          </p>
        </div>
        <button
          onClick={handlePerformDeltaSync}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg font-mono text-xs font-bold transition-colors flex items-center space-x-2 cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>TRANSMIT DELTA SYNC</span>
        </button>
      </div>

      {/* Side-by-side Node Comparison: Node A (v103) vs Node B (v97) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Node A (Transmitter) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 font-bold block">SOURCE DEVICE</span>
              <h3 className="font-mono text-sm font-bold text-slate-100">
                NODE ALPHA ({node.identity.nodeId})
              </h3>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 block">STATE VERSION</span>
              <span className="text-sm font-mono font-bold text-cyan-300">v{localVersion}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Modify any attribute below to increment local version and generate a new differential delta:
          </p>

          <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            {/* Volume */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">volume:</span>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={localStore.volume}
                  onChange={(e) => handleModifyLocal('volume', Number(e.target.value))}
                  className="w-28 accent-cyan-400 cursor-pointer"
                />
                <span className="text-cyan-300 font-bold w-8 text-right">{localStore.volume}</span>
              </div>
            </div>

            {/* Brightness */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">brightness:</span>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={localStore.brightness}
                  onChange={(e) => handleModifyLocal('brightness', Number(e.target.value))}
                  className="w-28 accent-cyan-400 cursor-pointer"
                />
                <span className="text-cyan-300 font-bold w-8 text-right">{localStore.brightness}%</span>
              </div>
            </div>

            {/* Theme */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">theme:</span>
              <div className="flex space-x-1.5">
                {['dark', 'light', 'cyber'].map((t) => (
                  <button
                    key={t}
                    onClick={() => handleModifyLocal('theme', t)}
                    className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                      localStore.theme === t
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">language:</span>
              <div className="flex space-x-1.5">
                {['bn', 'en', 'es', 'ja'].map((l) => (
                  <button
                    key={l}
                    onClick={() => handleModifyLocal('language', l)}
                    className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                      localStore.language === l
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Node B (Target Peer Receiver) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold block">PEER RECEIVER</span>
              <h3 className="font-mono text-sm font-bold text-slate-100">
                NODE BETA (PHONE-B)
              </h3>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 block">STATE VERSION</span>
              <span className={`text-sm font-mono font-bold ${versionDifference > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                v{peerVersion}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Version Gap:</span>
            {versionDifference > 0 ? (
              <span className="text-amber-400 font-bold">
                Behind by {versionDifference} delta(s)
              </span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized
              </span>
            )}
          </div>

          <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono">
            {Object.entries(peerStore).map(([key, value]) => {
              const hasChanged = localStore[key] !== value;
              return (
                <div key={key} className="flex items-center justify-between py-1 border-b border-slate-900 last:border-0">
                  <span className="text-slate-400">{key}:</span>
                  <div className="flex items-center space-x-2">
                    <span className={hasChanged ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                      {JSON.stringify(value)}
                    </span>
                    {hasChanged && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Delta History & Synchronizer Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h4 className="font-mono text-xs font-bold text-slate-300 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            DELTA SYNCHRONIZATION AUDIT TRAIL
          </h4>
          <span className="text-[11px] font-mono text-slate-500">
            Bandwidth Saved: {versionDifference > 0 ? '78%' : '100%'}
          </span>
        </div>

        <div className="space-y-1.5 font-mono text-[11px] max-h-40 overflow-y-auto no-scrollbar">
          {syncLogs.map((log, idx) => (
            <div
              key={idx}
              className="p-2 rounded bg-slate-950/70 border border-slate-850 text-slate-300"
            >
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
