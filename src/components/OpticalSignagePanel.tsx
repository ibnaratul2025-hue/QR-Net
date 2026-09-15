/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Layers,
  Bus,
  MapPin,
  Globe,
  Volume2,
  Download,
  CreditCard,
  Printer,
  Smartphone,
  CheckCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { QipNode } from '../protocol/node';
import { QipMessageType } from '../types/qip';

interface OpticalSignagePanelProps {
  node: QipNode;
  onDispatchEnvelope: (envelope: any) => void;
}

export const OpticalSignagePanel: React.FC<OpticalSignagePanelProps> = ({
  node,
  onDispatchEnvelope,
}) => {
  const [selectedRoute, setSelectedRoute] = useState<string>('Express Line 42');
  const [activeLang, setActiveLang] = useState<string>('EN');
  const [opticalInteractionLog, setOpticalInteractionLog] = useState<string[]>([
    'Signage kiosk broadcasting service beacon: qip://kiosk/bus-stop-72',
    'Interactive optical control regions active on screen display.',
  ]);
  const [lastActionStatus, setLastActionStatus] = useState<string | null>(null);

  const busArrivals = [
    { route: 'Express Line 42', dest: 'Civic Center Hub', eta: '3 min', status: 'On Time' },
    { route: 'Metropolis Metro 14', dest: 'Harbor Gateway', eta: '8 min', status: 'On Time' },
    { route: 'Rapid Shuttle 09', dest: 'Tech District', eta: '14 min', status: 'Slight Delay' },
  ];

  const triggerOpticalUiAction = (actionName: string, payload: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] Optical UI Triggered: ${actionName} -> ${JSON.stringify(payload)}`;
    setOpticalInteractionLog((prev) => [logEntry, ...prev.slice(0, 15)]);
    setLastActionStatus(`Action Executed: ${actionName}`);

    const envelope = node.createEnvelope(QipMessageType.COMMAND, 'BROADCAST', {
      signageAction: actionName,
      payload,
      kioskId: 'KIOSK-BUS-STOP-72',
    });

    onDispatchEnvelope(envelope);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold font-mono text-cyan-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            OPTICAL DIGITAL SIGNAGE & OPTICAL UI INTERACTION
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Turn displays into interactive endpoints without WiFi, Cellular, or Bluetooth. Point a
            camera at visual control regions to interactively trigger services.
          </p>
        </div>
        <div className="flex items-center space-x-2 font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-md">
          <Clock className="w-3.5 h-3.5" />
          <span>KIOSK LIVE // NO INTERNET REQUIRED</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* The Kiosk Display Screen Simulation */}
        <div className="lg:col-span-2 bg-slate-950 border-2 border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Kiosk Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-mono text-base font-bold text-slate-100 flex items-center gap-2">
                  METRO TRANSIT DISPLAY #72
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    QIP SIGNAGE
                  </span>
                </h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-cyan-400" /> 5th Avenue & Central Boulevard
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 font-mono text-xs">
              {['EN', 'ES', 'FR', 'BN', 'JA'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setActiveLang(lang);
                    triggerOpticalUiAction('language.change', { lang });
                  }}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    activeLang === lang
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Real-time Transit Schedule Display */}
          <div className="space-y-3">
            <div className="text-xs font-mono text-slate-400 flex justify-between px-2">
              <span>ROUTE / DESTINATION</span>
              <span>ESTIMATED ARRIVAL</span>
            </div>

            {busArrivals.map((item) => (
              <div
                key={item.route}
                className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="font-mono text-sm font-bold text-slate-200">{item.route}</div>
                  <div className="text-xs text-slate-400">{item.dest}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-base font-bold text-emerald-400">{item.eta}</div>
                  <div className="text-[11px] font-mono text-slate-500">{item.status}</div>
                </div>
              </div>
            ))}
          </div>

          {/* OPTICAL UI INTERACTION REGIONS (Controls recognized visually by phone camera) */}
          <div className="border-t border-slate-800 pt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                OPTICAL INTERACTION REGIONS (Point camera to execute)
              </span>
              <span className="text-[11px] font-mono text-slate-500">Camera-Recognized Actions</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                onClick={() =>
                  triggerOpticalUiAction('route.lookup', {
                    route: selectedRoute,
                    stops: 12,
                    transfer: 'Civic Hub',
                  })
                }
                className="p-3 bg-slate-900 hover:bg-slate-850 border border-cyan-500/30 hover:border-cyan-400 rounded-xl text-left transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex items-center justify-between text-cyan-400 mb-1">
                  <MapPin className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40">
                    [LOOKUP]
                  </span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-200">Route Details</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Download stops & map</div>
              </button>

              <button
                onClick={() =>
                  triggerOpticalUiAction('payment.fare', {
                    amount: '$2.75',
                    currency: 'USD',
                    ticket: 'Single Transit',
                  })
                }
                className="p-3 bg-slate-900 hover:bg-slate-850 border border-emerald-500/30 hover:border-emerald-400 rounded-xl text-left transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex items-center justify-between text-emerald-400 mb-1">
                  <CreditCard className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/40">
                    [PAY $2.75]
                  </span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-200">Optical Pay</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Contactless token pass</div>
              </button>

              <button
                onClick={() =>
                  triggerOpticalUiAction('accessibility.audio', {
                    enabled: true,
                    rate: 1.0,
                    text: 'Express Line 42 arrives in 3 minutes.',
                  })
                }
                className="p-3 bg-slate-900 hover:bg-slate-850 border border-amber-500/30 hover:border-amber-400 rounded-xl text-left transition-all cursor-pointer group shadow-sm"
              >
                <div className="flex items-center justify-between text-amber-400 mb-1">
                  <Volume2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500/40">
                    [AUDIO]
                  </span>
                </div>
                <div className="font-mono text-xs font-bold text-slate-200">Accessibility</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Voice assistance channel</div>
              </button>
            </div>
          </div>
        </div>

        {/* Optical Printer & Interaction Telemetry */}
        <div className="space-y-6">
          {/* Optical Printer Demo */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-mono text-sm font-bold text-slate-100 flex items-center gap-2">
                <Printer className="w-4 h-4 text-cyan-400" />
                OPTICAL PRINTER SERVICE
              </h3>
              <span className="text-[10px] font-mono text-emerald-400">READY</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Screen displays sequence of optical print frames. Phone receives document without
              internet and relays directly to printer endpoint via optical channel.
            </p>

            <button
              onClick={() =>
                triggerOpticalUiAction('printer.print', {
                  document: 'Transit Ticket #TX-9042',
                  fare: '$2.75',
                  validUntil: new Date(Date.now() + 7200000).toLocaleTimeString(),
                  authSignature: 'SIG-OPTICAL-7F89B',
                })
              }
              className="w-full py-2.5 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg font-mono text-xs font-bold transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>TRANSMIT TICKET TO PRINTER</span>
            </button>
          </div>

          {/* Optical UI Event Stream Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-mono text-xs font-bold text-slate-300">INTERACTION LOG</span>
              {lastActionStatus && (
                <span className="text-[10px] font-mono text-emerald-400 animate-pulse">
                  {lastActionStatus}
                </span>
              )}
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar font-mono text-[11px]">
              {opticalInteractionLog.map((log, i) => (
                <div
                  key={i}
                  className="p-2 rounded bg-slate-950/80 border border-slate-850 text-slate-300 break-all leading-relaxed"
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
