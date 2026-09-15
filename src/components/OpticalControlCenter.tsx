/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Centralized User Control Center
 * Complete sovereign user controls for Node, Discovery, Security, Capabilities,
 * Carriers, Transfers, Storage, Automation, and Developer Mode.
 */

import React, { useState } from 'react';
import { QipNode } from '../protocol/node';
import { QipCarrierType, QipHeartbeatRate, QipHeartbeatVisualMode, QipTrustState } from '../types/qip';
import {
  Sliders,
  Radio,
  Scan,
  ShieldCheck,
  Zap,
  HardDrive,
  Cpu,
  Layers,
  Terminal,
  Activity,
  Check,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface OpticalControlCenterProps {
  node: QipNode;
  onSelectCarrier: (c: QipCarrierType) => void;
  onSelectTab: (tab: any) => void;
}

export const OpticalControlCenter: React.FC<OpticalControlCenterProps> = ({
  node,
  onSelectCarrier,
  onSelectTab,
}) => {
  // Independent user configuration toggles
  const [toggles, setToggles] = useState({
    heartbeat: node.heartbeat.getConfig().enabled,
    rpc: true,
    discovery: true,
    relay: true,
    storeAndForward: true,
    autoPairing: false,
    stealthMode: node.heartbeat.getConfig().visualMode === QipHeartbeatVisualMode.STEALTH,
    strictFirewall: !node.securityPermissions.canSendCommand,
    batterySaver: node.heartbeat.getConfig().batteryAware,
  });

  const [activeSection, setActiveSection] = useState<
    'node' | 'discovery' | 'security' | 'capabilities' | 'carriers' | 'storage' | 'developer'
  >('node');

  const handleToggle = (key: keyof typeof toggles) => {
    const nextVal = !toggles[key];
    setToggles((prev) => ({ ...prev, [key]: nextVal }));

    // Apply side effects directly to QipNode
    if (key === 'heartbeat') {
      node.heartbeat.setEnabled(nextVal);
    } else if (key === 'stealthMode') {
      node.heartbeat.setVisualMode(
        nextVal ? QipHeartbeatVisualMode.STEALTH : QipHeartbeatVisualMode.PERSISTENT
      );
    } else if (key === 'batterySaver') {
      node.heartbeat.setBatteryAware(nextVal);
    } else if (key === 'strictFirewall') {
      node.securityPermissions.canSendCommand = !nextVal;
      node.securityPermissions.canRequestCamera = !nextVal;
      node.securityPermissions.canExecuteProgram = !nextVal;
    }
  };

  const statusModel = node.getStatusModel();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="font-mono text-lg font-bold text-slate-100">
              QIP MASTER CONTROL CENTER
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Centralized sovereign configuration for node identity, optical discovery, security firewalls, and carriers.
          </p>
        </div>

        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-bold">
            STATUS: {statusModel.status}
          </span>
        </div>
      </div>

      {/* Main Grid: Nav + Settings Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-4 space-y-2 font-mono text-xs">
          {[
            { id: 'node', label: 'Node & Identity', icon: <Radio className="w-4 h-4" /> },
            { id: 'discovery', label: 'Heartbeat & Discovery', icon: <Scan className="w-4 h-4" /> },
            { id: 'security', label: 'Security & Permissions', icon: <ShieldCheck className="w-4 h-4" /> },
            { id: 'capabilities', label: 'Optical Capabilities', icon: <Zap className="w-4 h-4" /> },
            { id: 'carriers', label: 'Carriers & Physical Layer', icon: <Layers className="w-4 h-4" /> },
            { id: 'storage', label: 'Storage & Cache', icon: <HardDrive className="w-4 h-4" /> },
            { id: 'developer', label: 'Developer & CI/CD', icon: <Terminal className="w-4 h-4" /> },
          ].map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id as any)}
              className={`w-full p-3.5 rounded-xl border flex items-center space-x-3 text-left transition-all cursor-pointer ${
                activeSection === sec.id
                  ? 'bg-cyan-950/50 border-cyan-500/60 text-cyan-300 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              {sec.icon}
              <span>{sec.label}</span>
            </button>
          ))}
        </div>

        {/* Settings Panel */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          {/* SECTION: NODE */}
          {activeSection === 'node' && (
            <div className="space-y-5">
              <h3 className="font-mono text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">
                NODE IDENTITY & LIFECYCLE
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">NODE IDENTIFIER</span>
                  <span className="text-cyan-400 font-bold text-sm select-all">{node.identity.nodeId}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">ENDPOINT NAME</span>
                  <span className="text-slate-200 font-bold text-sm">{node.identity.name}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">SAS PAIRING CODE</span>
                  <span className="text-amber-400 font-bold text-sm tracking-widest">{node.identity.pairingCode}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">WIRE PROTOCOL</span>
                  <span className="text-indigo-400 font-bold text-sm">{node.protocolVersion}</span>
                </div>
              </div>

              {/* Master Feature Toggles */}
              <div className="space-y-3 pt-3">
                <h4 className="font-mono text-xs font-bold text-slate-300 uppercase">Independent System Toggles</h4>
                <div className="space-y-2">
                  {[
                    { key: 'discovery', label: 'Optical Discovery Beaconing', desc: 'Broadcast line-of-sight presence frames' },
                    { key: 'rpc', label: 'Optical RPC Server', desc: 'Accept authorized remote optical procedure calls' },
                    { key: 'relay', label: 'Mesh Relay & Store-and-Forward', desc: 'Forward optical messages to adjacent hops' },
                    { key: 'autoPairing', label: 'Automatic Trust Pairing', desc: 'Automatically trust verified cryptographic peers' },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-mono text-xs font-semibold text-slate-200">{item.label}</div>
                        <div className="text-[11px] text-slate-400">{item.desc}</div>
                      </div>
                      <button
                        onClick={() => handleToggle(item.key as any)}
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                          toggles[item.key as keyof typeof toggles] ? 'bg-cyan-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform ${
                            toggles[item.key as keyof typeof toggles] ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION: DISCOVERY */}
          {activeSection === 'discovery' && (
            <div className="space-y-5">
              <h3 className="font-mono text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">
                HEARTBEAT & NEIGHBORHOOD DISCOVERY
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Configure optical beacon rate and visual indicator persistence. When screen is turned off or tab is hidden, optical beaconing automatically suspends to comply with power and battery limits.
              </p>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs font-semibold text-slate-200">Optical Heartbeat Daemon</div>
                    <div className="text-[11px] text-slate-400">Emits periodic low-rate presence beacon</div>
                  </div>
                  <button
                    onClick={() => handleToggle('heartbeat')}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      toggles.heartbeat ? 'bg-cyan-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform ${
                        toggles.heartbeat ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs font-semibold text-slate-200">Stealth Visualization</div>
                    <div className="text-[11px] text-slate-400">Minimizes visual indicator to prevent distraction</div>
                  </div>
                  <button
                    onClick={() => handleToggle('stealthMode')}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      toggles.stealthMode ? 'bg-cyan-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform ${
                        toggles.stealthMode ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs font-semibold text-slate-200">Battery-Aware Throttle</div>
                    <div className="text-[11px] text-slate-400">Automatically scales beacon rate on low battery</div>
                  </div>
                  <button
                    onClick={() => handleToggle('batterySaver')}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      toggles.batterySaver ? 'bg-cyan-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform ${
                        toggles.batterySaver ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: SECURITY */}
          {activeSection === 'security' && (
            <div className="space-y-5">
              <h3 className="font-mono text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">
                CAPABILITY-BASED SECURITY FIREWALL
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Optical computing executes without traditional IP firewalls. Every permission-sensitive operation requires explicit capability authorization.
              </p>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs font-semibold text-slate-200">Strict Authorization Firewall</div>
                    <div className="text-[11px] text-slate-400">Prompt for every camera request, command, or script execution</div>
                  </div>
                  <button
                    onClick={() => handleToggle('strictFirewall')}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      toggles.strictFirewall ? 'bg-cyan-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform ${
                        toggles.strictFirewall ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-500 text-[10px]">CAMERA PRIVILEGE</span>
                    <span className="text-amber-400 font-bold block">INTERACTIVE PROMPT</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-500 text-[10px]">QPL SCRIPT EXECUTION</span>
                    <span className="text-emerald-400 font-bold block">RESTRICTED SANDBOX</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: CARRIERS */}
          {activeSection === 'carriers' && (
            <div className="space-y-5">
              <h3 className="font-mono text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">
                OPTICAL PHYSICAL LAYER CARRIERS
              </h3>
              <div className="space-y-3">
                {[
                  { type: QipCarrierType.QR, name: 'QR Optical Carrier', desc: 'Universal monochrome 2D matrix with high optical tolerance' },
                  { type: QipCarrierType.CHROMATIC, name: 'Chromatic Spectral Modulation', desc: 'High-bandwidth 4-channel RGB color constellation' },
                  { type: QipCarrierType.SYMBOL_MATRIX, name: 'Symbol Matrix', desc: 'High-density geometric pattern with parity checkpoints' },
                ].map((c) => (
                  <div
                    key={c.type}
                    onClick={() => {
                      onSelectCarrier(c.type);
                      node.activeCarrier = c.type;
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                      node.activeCarrier === c.type
                        ? 'bg-cyan-950/40 border-cyan-400/80'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-100">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{c.desc}</div>
                    </div>
                    {node.activeCarrier === c.type && (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION: CAPABILITIES */}
          {activeSection === 'capabilities' && (
            <div className="space-y-5">
              <h3 className="font-mono text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">
                ADVERTISED OPTICAL CAPABILITIES
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {node.identity.capabilities.map((cap) => (
                  <div
                    key={cap}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-2 text-xs font-mono text-slate-200"
                  >
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold">{cap}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION: STORAGE */}
          {activeSection === 'storage' && (
            <div className="space-y-5">
              <h3 className="font-mono text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">
                STORAGE & CONTENT-ADDRESSED CACHE
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">STATE STORE VERSION</span>
                  <span className="text-slate-200 font-bold text-sm">v{node.stateVersion}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">CACHE OBJECTS</span>
                  <span className="text-cyan-400 font-bold text-sm">{node.contentCache.size} Cached</span>
                </div>
              </div>
              <button
                onClick={() => {
                  node.contentCache.clear();
                  alert('Content-addressed cache cleared.');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-semibold cursor-pointer border border-slate-700 transition-colors"
              >
                Clear Local Cache
              </button>
            </div>
          )}

          {/* SECTION: DEVELOPER */}
          {activeSection === 'developer' && (
            <div className="space-y-5">
              <h3 className="font-mono text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">
                DEVELOPER MODE & CI/CD
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => onSelectTab('release')}
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between text-left cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-mono text-xs font-bold text-slate-200">Open Release Dashboard</div>
                    <div className="text-[11px] text-slate-400">View CI status, APK downloads, and release manifest</div>
                  </div>
                  <span className="text-cyan-400 font-mono text-xs font-bold">→</span>
                </button>

                <button
                  onClick={() => onSelectTab('diagnostics')}
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between text-left cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-mono text-xs font-bold text-slate-200">Run Subsystem Diagnostics</div>
                    <div className="text-[11px] text-slate-400">Perform hardware, carrier, and runtime validation</div>
                  </div>
                  <span className="text-cyan-400 font-mono text-xs font-bold">→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
