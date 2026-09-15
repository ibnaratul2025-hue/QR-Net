/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Radio,
  Eye,
  ShieldCheck,
  Terminal,
  Activity,
  Workflow,
  Sparkles,
  Layers,
  Sliders,
  Network,
  Scan,
  Cpu,
  Globe,
} from 'lucide-react';
import { QipCarrierType, QipFsmState, QipIdentity } from '../types/qip';
import { QipHeartbeatService } from '../protocol/heartbeat';
import { HeartbeatIndicator } from './HeartbeatIndicator';

export type ActiveTab =
  | 'transceiver'
  | 'discovery'
  | 'terminal'
  | 'rpc'
  | 'signage'
  | 'sync'
  | 'qpl'
  | 'carrier_lab'
  | 'mesh'
  | 'debugger'
  | 'diagnostics'
  | 'control'
  | 'release';

interface HeaderProps {
  identity: QipIdentity;
  fsmState: QipFsmState;
  activeCarrier: QipCarrierType;
  heartbeat: QipHeartbeatService;
  onSelectCarrier: (carrier: QipCarrierType) => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenPairing: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  identity,
  fsmState,
  activeCarrier,
  heartbeat,
  onSelectCarrier,
  activeTab,
  onSelectTab,
  onOpenPairing,
}) => {
  const getFsmBadgeColor = (state: QipFsmState) => {
    switch (state) {
      case QipFsmState.TRANSFERRING:
      case QipFsmState.SYNCHRONIZING:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case QipFsmState.HANDSHAKING:
      case QipFsmState.NEGOTIATING:
      case QipFsmState.AUTHENTICATING:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case QipFsmState.VERIFIED:
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case QipFsmState.FAILED:
      case QipFsmState.CANCELLED:
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'transceiver', label: 'Transceiver', icon: <Radio className="w-4 h-4" /> },
    { id: 'discovery', label: 'Discovery', icon: <Scan className="w-4 h-4" /> },
    { id: 'terminal', label: 'Optical CLI', icon: <Terminal className="w-4 h-4" /> },
    { id: 'rpc', label: 'Optical RPC', icon: <Workflow className="w-4 h-4" /> },
    { id: 'signage', label: 'Digital Signage', icon: <Layers className="w-4 h-4" /> },
    { id: 'sync', label: 'State Sync', icon: <Activity className="w-4 h-4" /> },
    { id: 'qpl', label: 'QPL Studio', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'carrier_lab', label: 'Carrier Lab', icon: <Sliders className="w-4 h-4" /> },
    { id: 'mesh', label: 'Mesh Relay', icon: <Network className="w-4 h-4" /> },
    { id: 'debugger', label: 'Debugger', icon: <Eye className="w-4 h-4" /> },
    { id: 'diagnostics', label: 'Diagnostics', icon: <Cpu className="w-4 h-4" /> },
    { id: 'control', label: 'Control Center', icon: <Sliders className="w-4 h-4" /> },
    { id: 'release', label: 'Release / CI', icon: <Globe className="w-4 h-4" /> },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Concept */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold tracking-wider text-slate-100 font-mono">
                QR//INTERNET
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                QIP/1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Screen-to-Camera Optical Internet Protocol & Distributed Bus
            </p>
          </div>
        </div>

        {/* Node Identity & Telemetry */}
        <div className="flex items-center space-x-2 sm:space-x-3 text-xs font-mono">
          {/* FSM state */}
          <div
            className={`px-2.5 py-1 rounded-md border flex items-center space-x-1.5 ${getFsmBadgeColor(
              fsmState
            )}`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            <span className="font-semibold">{fsmState}</span>
          </div>

          {/* Node ID */}
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <span className="text-slate-500">NODE:</span>
            <span className="text-cyan-400 font-semibold">{identity.nodeId}</span>
          </div>

          {/* SAS Security Code */}
          <button
            onClick={onOpenPairing}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
            title="Human-Verifiable SAS Optical Security Code"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">SAS:</span>
            <span className="font-bold text-emerald-400">{identity.pairingCode}</span>
          </button>

          {/* Carrier Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => onSelectCarrier(QipCarrierType.QR)}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                activeCarrier === QipCarrierType.QR
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              QR
            </button>
            <button
              onClick={() => onSelectCarrier(QipCarrierType.CHROMATIC)}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                activeCarrier === QipCarrierType.CHROMATIC
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Color
            </button>
            <button
              onClick={() => onSelectCarrier(QipCarrierType.SYMBOL_MATRIX)}
              className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                activeCarrier === QipCarrierType.SYMBOL_MATRIX
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Symbol
            </button>
          </div>

          {/* Optical Heartbeat Beacon Indicator */}
          <HeartbeatIndicator heartbeat={heartbeat} />
        </div>
      </div>

      {/* Navigation Sub-bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex space-x-1 overflow-x-auto no-scrollbar border-t border-slate-900/80">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center space-x-2 py-2.5 px-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
