/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Eye,
  Layers,
  History,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Terminal,
  Activity,
} from 'lucide-react';
import { QipNode } from '../protocol/node';
import { QipEventAuditEntry } from '../types/qip';

interface OpticalDebuggerProps {
  node: QipNode;
  onDispatchEnvelope: (envelope: any) => void;
}

export const OpticalDebugger: React.FC<OpticalDebuggerProps> = ({
  node,
  onDispatchEnvelope,
}) => {
  const [selectedLayer, setSelectedLayer] = useState<'FRAME' | 'PACKET' | 'SESSION' | 'MESSAGE' | 'EVENT'>('MESSAGE');
  const [auditLogs, setAuditLogs] = useState<QipEventAuditEntry[]>(node.fsm.getAuditLog());
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(0);

  const refreshAuditLogs = () => {
    setAuditLogs(node.fsm.getAuditLog());
  };

  const layersInfo = [
    {
      id: 'FRAME' as const,
      name: 'Layer 1: Optical Frame',
      desc: 'Visual pulses, glyphs, QR matrix cells, clock strobes on display canvas',
      sample: {
        magic: 'QIP',
        seq: 1,
        total: 3,
        carrier: 'CARRIER_QR',
        checksum: 'A48F9012',
      },
    },
    {
      id: 'PACKET' as const,
      name: 'Layer 2: Packet Layer',
      desc: 'CRC32 integrity verification, frame sequence bounds check, chunk recovery',
      sample: {
        sessionId: 'qip_7109',
        chunkSize: 140,
        crcValid: true,
        parity: 'PASS',
      },
    },
    {
      id: 'SESSION' as const,
      name: 'Layer 3: Session & FSM',
      desc: 'Multi-frame assembly, session state machine transitions, timeout purge',
      sample: {
        fsmState: node.fsm.getState(),
        activeSessions: 1,
        progress: '100%',
      },
    },
    {
      id: 'MESSAGE' as const,
      name: 'Layer 4: QIP Envelope',
      desc: 'Structured typed message envelopes (COMMAND, STATE, QUERY, EVENT, PING)',
      sample: {
        protocol: 'QIP/1.0',
        msgId: 'msg_9842f',
        source: node.identity.nodeId,
        destination: 'BROADCAST',
        type: 'COMMAND',
      },
    },
    {
      id: 'EVENT' as const,
      name: 'Layer 5: Application Event',
      desc: 'RPC execution, State Delta application, UI reaction, QPL workflow trigger',
      sample: {
        action: 'camera.capture',
        authorized: true,
        event: 'payment.completed',
      },
    },
  ];

  const handleSimulateTraceReplay = () => {
    setIsReplaying(true);
    setReplayIndex(0);

    const steps = [
      'Replay: Optical Frame detected on video stream [1/3]',
      'Replay: CRC32 checksum validated for chunk 1',
      'Replay: Optical Frame 2/3 ingested and verified',
      'Replay: Optical Frame 3/3 ingested. Reassembly complete.',
      'Replay: QIP Envelope reconstructed [TYPE: COMMAND]',
      'Replay: Security Firewall authorized RPC call: compute.hash',
      'Replay: Session transition -> VERIFIED -> IDLE',
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < steps.length) {
        node.fsm.logAudit('PacketRecovered', steps[current]);
        setReplayIndex(current + 1);
        refreshAuditLogs();
        current++;
      } else {
        clearInterval(interval);
        setIsReplaying(false);
      }
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold font-mono text-cyan-300 flex items-center gap-2">
            <Eye className="w-4 h-4 text-cyan-400" />
            OPTICAL PROTOCOL STACK DEBUGGER & REPLAY LAB
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Full protocol stack visibility from physical optical frame to application event. Inspect
            deterministic transitions and replay captured test sessions.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSimulateTraceReplay}
            disabled={isReplaying}
            className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg font-mono text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isReplaying ? `REPLAYING (${replayIndex}/7)...` : 'REPLAY SESSION TRACE'}</span>
          </button>
          <button
            onClick={refreshAuditLogs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
            title="Refresh logs"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Protocol Stack Visualizer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="font-mono text-xs font-bold text-slate-200">QIP PROTOCOL STACK HIERARCHY</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
          {layersInfo.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedLayer(l.id)}
              className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                selectedLayer === l.id
                  ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300 shadow-md'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-bold text-xs">{l.name}</div>
              <div className="text-[10px] text-slate-500 mt-1 truncate">{l.desc}</div>
            </button>
          ))}
        </div>

        {/* Selected Layer Inspector */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs font-bold text-cyan-300">
              LAYER PAYLOAD INSPECTOR: {selectedLayer}
            </span>
            <span className="text-[10px] font-mono text-emerald-400">STATUS: STABLE</span>
          </div>
          <pre className="font-mono text-xs text-slate-300 bg-slate-900/80 p-3 rounded-lg border border-slate-850">
            {JSON.stringify(layersInfo.find((l) => l.id === selectedLayer)?.sample, null, 2)}
          </pre>
        </div>
      </div>

      {/* Immutable Event Audit Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="font-mono text-xs font-bold text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            EVENT-SOURCED PROTOCOL AUDIT TRAIL
          </h3>
          <span className="text-[11px] font-mono text-slate-500">{auditLogs.length} events logged</span>
        </div>

        <div className="space-y-1.5 font-mono text-[11px] max-h-72 overflow-y-auto no-scrollbar">
          {auditLogs.length > 0 ? (
            auditLogs.map((entry) => (
              <div
                key={entry.id}
                className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-850 flex items-start justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-cyan-400 font-bold">{entry.eventType}</span>
                    <span className="text-slate-500 text-[10px]">({entry.id})</span>
                  </div>
                  <div className="text-slate-300">{entry.details}</div>
                </div>
                <span className="text-slate-600 text-[10px] shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          ) : (
            <div className="text-slate-500 text-center py-4">No events logged yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};
