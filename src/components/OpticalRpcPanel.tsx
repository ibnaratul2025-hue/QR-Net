/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Workflow,
  Shield,
  CheckCircle2,
  XCircle,
  Play,
  Cpu,
  Lock,
  Eye,
  FileText,
  Sliders,
  Server,
  Zap,
} from 'lucide-react';
import { QipNode } from '../protocol/node';
import { QipCapability, QipMessageType } from '../types/qip';

interface OpticalRpcPanelProps {
  node: QipNode;
  onDispatchEnvelope: (envelope: any) => void;
}

export const OpticalRpcPanel: React.FC<OpticalRpcPanelProps> = ({ node, onDispatchEnvelope }) => {
  const [selectedOp, setSelectedOp] = useState<string>('compute.hash');
  const [opInput, setOpInput] = useState<string>('Optical Payload string 47192');
  const [rpcResult, setRpcResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [activeServices, setActiveServices] = useState<string[]>([
    'weather',
    'calculator',
    'display',
    'compute',
  ]);

  // Permissions state
  const [permissions, setPermissions] = useState(node.securityPermissions);

  const handleTogglePermission = (key: keyof typeof permissions) => {
    const updated = { ...permissions, [key]: !permissions[key] };
    setPermissions(updated);
    node.securityPermissions = updated;
  };

  const handleExecuteRpc = async () => {
    setIsExecuting(true);
    setRpcResult(null);

    const envelope = node.createEnvelope(QipMessageType.COMMAND, 'BROADCAST', {
      operation: selectedOp,
      args: { input: opInput, text: opInput, timestamp: Date.now() },
    });

    onDispatchEnvelope(envelope);

    try {
      const response = await node.processIncomingEnvelope(envelope);
      if (response) {
        setRpcResult(response.payload);
      }
    } catch (err: any) {
      setRpcResult({ error: err.message || 'Execution failed' });
    } finally {
      setIsExecuting(false);
    }
  };

  const capabilitiesList = [
    {
      id: 'camera.capture',
      name: 'camera.capture',
      desc: 'Requests optical snapshot or camera telemetry frame',
      level: 'DANGEROUS',
      permKey: 'canRequestCamera' as const,
    },
    {
      id: 'clipboard.write',
      name: 'clipboard.write',
      desc: 'Writes optical payload directly to system clipboard',
      level: 'SENSITIVE',
      permKey: 'canWrite' as const,
    },
    {
      id: 'screen.show',
      name: 'screen.show / text.display',
      desc: 'Renders remote alert text on display interface',
      level: 'SAFE',
      permKey: 'canDisplay' as const,
    },
    {
      id: 'compute.hash',
      name: 'compute.hash',
      desc: 'Edge computing: calculates CRC32/SHA checksum locally',
      level: 'SAFE',
      permKey: 'canRead' as const,
    },
    {
      id: 'timer.start',
      name: 'timer.start',
      desc: 'Starts synchronized optical countdown timer',
      level: 'SAFE',
      permKey: 'canRead' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold font-mono text-cyan-300 flex items-center gap-2">
            <Workflow className="w-4 h-4 text-cyan-400" />
            OPTICAL RPC & CAPABILITY-BASED SECURITY FIREWALL
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Expose capabilities over the visual channel. Every operation requires explicit permission
            authorization to prevent arbitrary remote execution.
          </p>
        </div>
        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            FIREWALL ENFORCED
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RPC Dispatcher */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-mono text-sm font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              OPTICAL RPC DISPATCHER
            </h3>
            <span className="text-xs font-mono text-slate-400">Target: BROADCAST / DEVICE-A</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">
                SELECT EXPOSED OPERATION:
              </label>
              <select
                value={selectedOp}
                onChange={(e) => setSelectedOp(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="compute.hash">compute.hash (Optical Edge Compute)</option>
                <option value="compute.encode">compute.encode (Base64 Encode)</option>
                <option value="compute.validate">compute.validate (Validate Token)</option>
                <option value="camera.capture">camera.capture (Request Snapshot)</option>
                <option value="clipboard.write">clipboard.write (Push to Clipboard)</option>
                <option value="screen.show">screen.show (Display Alert)</option>
                <option value="timer.start">timer.start (Start Sync Timer)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">
                CALL ARGUMENT / PAYLOAD:
              </label>
              <input
                type="text"
                value={opInput}
                onChange={(e) => setOpInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleExecuteRpc}
              disabled={isExecuting}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition-colors flex items-center space-x-2 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isExecuting ? 'TRANSMITTING RPC...' : 'EMIT OPTICAL CALL'}</span>
            </button>
          </div>

          {/* Result Output Viewer */}
          <div className="bg-slate-950 rounded-lg border border-slate-800 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-slate-400">OPTICAL RPC RESPONSE:</span>
              {rpcResult?.result && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  SUCCESS (200 OK)
                </span>
              )}
            </div>
            <pre className="text-xs font-mono text-slate-200 bg-slate-900/90 p-3 rounded border border-slate-800 max-h-48 overflow-y-auto">
              {rpcResult
                ? JSON.stringify(rpcResult, null, 2)
                : '// Response payload will appear here after optical transmission...'}
            </pre>
          </div>

          {/* Optical Service Worker Section */}
          <div className="pt-3 border-t border-slate-800/80">
            <h4 className="text-xs font-mono font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              OPTICAL SERVICE WORKER ADVERTISEMENTS
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['weather', 'calculator', 'translator', 'display', 'storage', 'printer'].map(
                (srv) => {
                  const isRegistered = activeServices.includes(srv);
                  return (
                    <button
                      key={srv}
                      onClick={() => {
                        setActiveServices((prev) =>
                          isRegistered ? prev.filter((s) => s !== srv) : [...prev, srv]
                        );
                      }}
                      className={`p-2 rounded-lg border text-xs font-mono text-left transition-colors cursor-pointer ${
                        isRegistered
                          ? 'bg-cyan-950/30 text-cyan-300 border-cyan-500/40'
                          : 'bg-slate-950/60 text-slate-500 border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>srv.{srv}</span>
                        {isRegistered ? (
                          <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                        ) : (
                          <XCircle className="w-3 h-3 text-slate-600" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {isRegistered ? 'Broadcasting' : 'Inactive'}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>

        {/* Capability Security Firewall Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-mono text-sm font-bold text-slate-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              CAPABILITY PERMISSIONS
            </h3>
            <span className="text-[11px] font-mono text-emerald-400">Strict Auth</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Configure local capability permissions. Never trust a peer simply because it is connected.
          </p>

          <div className="space-y-3">
            {capabilitiesList.map((item) => {
              const isEnabled = permissions[item.permKey];
              return (
                <div
                  key={item.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-200">{item.name}</span>
                      <span
                        className={`text-[9px] font-mono px-1 rounded ${
                          item.level === 'DANGEROUS'
                            ? 'bg-rose-500/20 text-rose-300'
                            : item.level === 'SENSITIVE'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {item.level}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">{item.desc}</div>
                  </div>

                  <button
                    onClick={() => handleTogglePermission(item.permKey)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      isEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {isEnabled ? 'ALLOWED' : 'PROMPT'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-[11px] font-mono text-slate-400">
            <span className="text-amber-400 font-bold block mb-1">RULE POLICY:</span>
            WHEN unknown device emits dangerous capability, require visual SAS code matching before
            execution.
          </div>
        </div>
      </div>
    </div>
  );
};
