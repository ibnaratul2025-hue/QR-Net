/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Network,
  Send,
  Clock,
  Database,
  ArrowRight,
  Shield,
  Layers,
  CheckCircle2,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { QipNode } from '../protocol/node';
import { QipMessageType } from '../types/qip';

interface OpticalMeshPanelProps {
  node: QipNode;
  onDispatchEnvelope: (envelope: any) => void;
}

export const OpticalMeshPanel: React.FC<OpticalMeshPanelProps> = ({
  node,
  onDispatchEnvelope,
}) => {
  const [targetNode, setTargetNode] = useState<string>('NODE-GAMMA');
  const [meshTtl, setMeshTtl] = useState<number>(3);
  const [meshMessage, setMeshMessage] = useState<string>('Mesh packet across optical relay');
  const [relayQueue, setRelayQueue] = useState(node.storeAndForwardQueue);
  const [meshLogs, setMeshLogs] = useState<string[]>([
    'Optical Mesh Topology engine initialized.',
    'Node Alpha connected to Relay Node Beta. Node Gamma reachable via 2 hops.',
  ]);

  // Network Time sync state
  const [timeSyncResult, setTimeSyncResult] = useState<{
    offsetMs: number;
    roundTripMs: number;
    synchronizedTime: string;
  } | null>(null);

  // Content Addressing query state
  const [contentQueryHash, setContentQueryHash] = useState<string>('A71C92');
  const [contentQueryResult, setContentQueryResult] = useState<string | null>(null);

  const appendMeshLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setMeshLogs((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 15)]);
  };

  const handleSendMeshPacket = () => {
    const envelope = node.createEnvelope(
      QipMessageType.TEXT,
      targetNode,
      {
        body: meshMessage,
        originTime: Date.now(),
      },
      meshTtl
    );

    appendMeshLog(`Created mesh packet ${envelope.msgId.slice(0, 8)} -> Dest: ${targetNode} (TTL: ${meshTtl}, Hops: 0)`);
    appendMeshLog(`Relay Node Beta accepted packet into optical store-and-forward queue.`);

    onDispatchEnvelope(envelope);
    node.storeAndForwardQueue.push(envelope);
    setRelayQueue([...node.storeAndForwardQueue]);
  };

  const handleSimulateTimeSync = () => {
    appendMeshLog('Emitting TIME_REQUEST over optical carrier...');
    const t0 = Date.now();

    setTimeout(() => {
      const t3 = Date.now();
      const rtt = Math.max(12, t3 - t0 + 18);
      const offset = -4; // 4ms clock skew
      setTimeSyncResult({
        offsetMs: offset,
        roundTripMs: rtt,
        synchronizedTime: new Date(Date.now() + offset).toISOString(),
      });
      appendMeshLog(`Received TIME_RESPONSE: Clock offset ${offset} ms | Optical RTT: ${rtt} ms`);
    }, 120);
  };

  const handleQueryContentCache = () => {
    const targetHash = `qip://sha256/${contentQueryHash}`;
    appendMeshLog(`Querying peer cache: "DO YOU HAVE OBJECT ${contentQueryHash}?"`);

    const hasObject = node.contentCache.has(targetHash) || contentQueryHash.includes('A71C');

    setTimeout(() => {
      if (hasObject) {
        setContentQueryResult('OBJECT ALREADY CACHED LOCALLY (Transfer Skipped — Saved 100% Optical Bandwidth)');
        appendMeshLog(`Peer response: YES (Found in QIP Cache). Full transmission skipped.`);
      } else {
        setContentQueryResult('OBJECT MISSING: Requesting transmission from peer node...');
        appendMeshLog(`Peer response: NO. Queueing optical frame transmission.`);
      }
    }, 80);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold font-mono text-cyan-300 flex items-center gap-2">
            <Network className="w-4 h-4 text-cyan-400" />
            OPTICAL MESH TOPOLOGY, STORE-AND-FORWARD & CONTENT ADDRESSING
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Multi-hop optical routing with strict TTL limits, delay-tolerant store-and-forward, optical
            network time synchronization (NTP), and content-addressed deduplication.
          </p>
        </div>
      </div>

      {/* Mesh Topology Visualizer */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h3 className="font-mono text-xs font-bold text-slate-300 mb-6 flex items-center justify-between">
          <span>LINE-OF-SIGHT OPTICAL MESH ROUTING GRAPH</span>
          <span className="text-[11px] text-cyan-400">Delay-Tolerant Network</span>
        </h3>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative py-4">
          {/* Node Alpha */}
          <div className="bg-slate-900 border-2 border-cyan-500 rounded-xl p-4 text-center w-full sm:w-52 shadow-lg shadow-cyan-950/40 z-10">
            <span className="text-[10px] font-mono text-cyan-400 font-bold block mb-1">
              ORIGINATOR (LOCAL)
            </span>
            <div className="font-mono text-sm font-bold text-slate-100">{node.identity.nodeId}</div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">Screen Transmitter</div>
          </div>

          {/* Optical Link 1 */}
          <div className="flex flex-col items-center justify-center font-mono text-[10px] text-cyan-400">
            <div className="animate-pulse">OPTICAL BEAM ➔</div>
            <div className="h-0.5 w-16 bg-cyan-500/40 my-1" />
            <span className="text-slate-500">LOS: 1.5m</span>
          </div>

          {/* Node Beta (Relay) */}
          <div className="bg-slate-900 border-2 border-amber-500 rounded-xl p-4 text-center w-full sm:w-52 shadow-lg shadow-amber-950/40 z-10">
            <span className="text-[10px] font-mono text-amber-400 font-bold block mb-1">
              OPTICAL RELAY
            </span>
            <div className="font-mono text-sm font-bold text-slate-100">NODE-BETA (LAPTOP)</div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">Store &amp; Forward Buffer</div>
          </div>

          {/* Optical Link 2 */}
          <div className="flex flex-col items-center justify-center font-mono text-[10px] text-emerald-400">
            <div className="animate-pulse">OPTICAL BEAM ➔</div>
            <div className="h-0.5 w-16 bg-emerald-500/40 my-1" />
            <span className="text-slate-500">LOS: 3.0m</span>
          </div>

          {/* Node Gamma */}
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-xl p-4 text-center w-full sm:w-52 shadow-lg shadow-emerald-950/40 z-10">
            <span className="text-[10px] font-mono text-emerald-400 font-bold block mb-1">
              FINAL DESTINATION
            </span>
            <div className="font-mono text-sm font-bold text-slate-100">NODE-GAMMA (PHONE)</div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">Camera Receiver</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Packet Dispatcher & Store-and-Forward Buffer */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-mono text-sm font-bold text-slate-100 flex items-center gap-2">
              <Send className="w-4 h-4 text-cyan-400" />
              DISPATCH MESH PACKET
            </h3>
            <span className="text-xs font-mono text-slate-400">TTL Limit Enforced</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">DESTINATION NODE:</label>
              <input
                type="text"
                value={targetNode}
                onChange={(e) => setTargetNode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">TIME-TO-LIVE (HOPS):</label>
              <input
                type="number"
                min="1"
                max="8"
                value={meshTtl}
                onChange={(e) => setMeshTtl(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">PAYLOAD:</label>
            <input
              type="text"
              value={meshMessage}
              onChange={(e) => setMeshMessage(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            onClick={handleSendMeshPacket}
            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>DISPATCH TO OPTICAL RELAY</span>
          </button>

          {/* Store-and-Forward Queue Inspector */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
              <span>STORE-AND-FORWARD RELAY QUEUE:</span>
              <span className="text-amber-400 font-bold">{relayQueue.length} queued</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 max-h-32 overflow-y-auto space-y-1 font-mono text-[11px]">
              {relayQueue.length > 0 ? (
                relayQueue.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-300 py-0.5">
                    <span className="text-cyan-400">{item.msgId.slice(0, 8)}</span>
                    <span className="text-slate-400">➔ {item.destination}</span>
                    <span className="text-amber-400">TTL: {item.ttl}</span>
                    <span className="text-emerald-400">Hops: {item.hopCount}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-center py-2">Queue is empty</div>
              )}
            </div>
          </div>
        </div>

        {/* Optical NTP & Content-Addressed Deduplication */}
        <div className="space-y-6">
          {/* Optical Network Time */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-mono text-sm font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                OPTICAL NETWORK TIME (NTP OVER LIGHT)
              </h3>
              <button
                onClick={handleSimulateTimeSync}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Sync Time
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Estimate clock offset and optical transit delay for synchronized multi-device displays.
            </p>

            {timeSyncResult ? (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs space-y-1">
                <div>ESTIMATED OFFSET: <span className="text-emerald-400 font-bold">{timeSyncResult.offsetMs} ms</span></div>
                <div>ROUND-TRIP LATENCY: <span className="text-cyan-400 font-bold">{timeSyncResult.roundTripMs} ms</span></div>
                <div className="text-[11px] text-slate-400 break-all">SYNCED: {timeSyncResult.synchronizedTime}</div>
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-500 bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                Click &quot;Sync Time&quot; to exchange optical TIME_REQUEST / TIME_RESPONSE.
              </div>
            )}
          </div>

          {/* Content-Addressed Deduplication */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-mono text-sm font-bold text-slate-100 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                CONTENT ADDRESSING (QIP://SHA256)
              </h3>
              <span className="text-[10px] font-mono text-slate-500">Deduplication</span>
            </div>

            <p className="text-xs text-slate-400">
              If another device already holds the object hash, optical transfer is skipped.
            </p>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={contentQueryHash}
                onChange={(e) => setContentQueryHash(e.target.value)}
                placeholder="Object hash (e.g. A71C92)..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleQueryContentCache}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs font-bold rounded border border-slate-700 cursor-pointer"
              >
                CHECK
              </button>
            </div>

            {contentQueryResult && (
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono text-cyan-300">
                {contentQueryResult}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
