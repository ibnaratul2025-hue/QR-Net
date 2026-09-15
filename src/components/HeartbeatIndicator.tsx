/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Heartbeat Visual Indicator
 * Renders non-distracting optical heartbeat indicators according to user-configured mode:
 * ROTATING, PERSISTENT, DISCOVERY, or STEALTH.
 */

import React, { useState, useEffect } from 'react';
import { QipHeartbeatRate, QipHeartbeatVisualMode } from '../types/qip';
import { QipHeartbeatService } from '../protocol/heartbeat';
import { Activity, Radio, Eye, EyeOff, Sparkles, Sliders } from 'lucide-react';

interface HeartbeatIndicatorProps {
  heartbeat: QipHeartbeatService;
  onRateChange?: (rate: QipHeartbeatRate) => void;
  onModeChange?: (mode: QipHeartbeatVisualMode) => void;
  compact?: boolean;
}

export const HeartbeatIndicator: React.FC<HeartbeatIndicatorProps> = ({
  heartbeat,
  onRateChange,
  onModeChange,
  compact = false,
}) => {
  const [config, setConfig] = useState(heartbeat.getConfig());
  const [pulse, setPulse] = useState(false);
  const [showConfigPopover, setShowConfigPopover] = useState(false);

  useEffect(() => {
    const unsub = heartbeat.onTick((phase, _mode) => {
      setPulse(phase);
    });
    return () => {
      unsub();
    };
  }, [heartbeat]);

  const handleRateSelect = (rate: QipHeartbeatRate) => {
    heartbeat.setRate(rate);
    setConfig(heartbeat.getConfig());
    if (onRateChange) onRateChange(rate);
  };

  const handleModeSelect = (mode: QipHeartbeatVisualMode) => {
    heartbeat.setVisualMode(mode);
    setConfig(heartbeat.getConfig());
    if (onModeChange) onModeChange(mode);
  };

  const handleToggle = () => {
    const next = !config.enabled;
    heartbeat.setEnabled(next);
    setConfig(heartbeat.getConfig());
  };

  // Render optical beacon based on mode
  const renderVisualBadge = () => {
    if (!config.enabled || config.rate === QipHeartbeatRate.OFF) {
      return (
        <span className="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-800/80 text-slate-400 text-[11px] font-mono border border-slate-700">
          <EyeOff className="w-3 h-3 text-slate-500" />
          <span>HEARTBEAT: OFF</span>
        </span>
      );
    }

    switch (config.visualMode) {
      case QipHeartbeatVisualMode.ROTATING:
        return (
          <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-cyan-950/80 border border-cyan-500/40 text-[11px] font-mono text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
            <Radio
              className={`w-3.5 h-3.5 text-cyan-400 transition-transform duration-500 ${
                pulse ? 'rotate-90 text-cyan-300 scale-110' : 'rotate-0 text-cyan-600'
              }`}
            />
            <span className="tracking-wider">BEACON ({config.rate})</span>
          </div>
        );

      case QipHeartbeatVisualMode.DISCOVERY:
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-400/60 text-[11px] font-mono text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <span
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                pulse ? 'bg-emerald-400 scale-125 shadow-[0_0_8px_#34d399]' : 'bg-emerald-800 scale-90'
              }`}
            />
            <span className="font-bold">DISCOVERY LOCK</span>
          </div>
        );

      case QipHeartbeatVisualMode.STEALTH:
        return (
          <div className="flex items-center space-x-1.5 px-1.5 py-1 rounded bg-slate-900/50 border border-slate-800 text-[10px] font-mono text-slate-400">
            <span
              className={`w-1.5 h-1.5 rounded-full transition-opacity duration-500 ${
                pulse ? 'opacity-80 bg-cyan-400' : 'opacity-20 bg-slate-600'
              }`}
            />
            <span>STEALTH</span>
          </div>
        );

      case QipHeartbeatVisualMode.PERSISTENT:
      default:
        return (
          <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-700/80 text-[11px] font-mono text-slate-300">
            <span
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                pulse ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-slate-700'
              }`}
            />
            <span className="text-slate-300">QIP BEACON</span>
            <span className="text-[9px] px-1 rounded bg-slate-800 text-cyan-400 uppercase font-semibold">
              {config.rate}
            </span>
          </div>
        );
    }
  };

  return (
    <div className="relative inline-flex items-center space-x-2">
      <button
        type="button"
        onClick={() => setShowConfigPopover(!showConfigPopover)}
        className="cursor-pointer transition-transform hover:scale-105"
        title="Click to configure QIP Heartbeat discovery beacon"
      >
        {renderVisualBadge()}
      </button>

      {/* Popover Configuration Menu */}
      {showConfigPopover && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowConfigPopover(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-72 p-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-xs font-mono space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                QIP NODE BEACON
              </span>
              <button
                onClick={handleToggle}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                  config.enabled && config.rate !== QipHeartbeatRate.OFF
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {config.enabled && config.rate !== QipHeartbeatRate.OFF ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Rate Selection */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1.5">
                Emission Rate
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { rate: QipHeartbeatRate.OFF, label: 'OFF' },
                  { rate: QipHeartbeatRate.LOW, label: 'LOW' },
                  { rate: QipHeartbeatRate.NORMAL, label: 'NORM' },
                  { rate: QipHeartbeatRate.DISCOVERY, label: 'DISC' },
                ].map((item) => (
                  <button
                    key={item.rate}
                    onClick={() => handleRateSelect(item.rate)}
                    className={`py-1 text-center rounded text-[10px] font-semibold cursor-pointer border ${
                      config.rate === item.rate
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Mode Selection */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1.5">
                Visual Beacon Mode
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { mode: QipHeartbeatVisualMode.PERSISTENT, label: 'Persistent' },
                  { mode: QipHeartbeatVisualMode.ROTATING, label: 'Rotating' },
                  { mode: QipHeartbeatVisualMode.DISCOVERY, label: 'Discovery' },
                  { mode: QipHeartbeatVisualMode.STEALTH, label: 'Stealth' },
                ].map((item) => (
                  <button
                    key={item.mode}
                    onClick={() => handleModeSelect(item.mode)}
                    className={`py-1 px-2 text-left rounded text-[10px] cursor-pointer border ${
                      config.visualMode === item.mode
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 leading-tight">
              Optical beacon transmits tiny line-of-sight presence frames. Suspends when screen is hidden to conserve battery.
            </div>
          </div>
        </>
      )}
    </div>
  );
};
