/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP — Optical Internet Protocol
 * Main Application Shell & Master Subsystem Coordinator
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Header,
  ActiveTab,
} from './components/Header';
import { OpticalTransceiver } from './components/OpticalTransceiver';
import { OpticalTerminal } from './components/OpticalTerminal';
import { OpticalRpcPanel } from './components/OpticalRpcPanel';
import { OpticalSignagePanel } from './components/OpticalSignagePanel';
import { OpticalSyncPanel } from './components/OpticalSyncPanel';
import { OpticalQplStudio } from './components/OpticalQplStudio';
import { OpticalCarrierLab } from './components/OpticalCarrierLab';
import { OpticalMeshPanel } from './components/OpticalMeshPanel';
import { OpticalDebugger } from './components/OpticalDebugger';
import { OpticalDiscoveryPanel } from './components/OpticalDiscoveryPanel';
import { OpticalDiagnosticsPanel } from './components/OpticalDiagnosticsPanel';
import { OpticalControlCenter } from './components/OpticalControlCenter';
import { OpticalReleaseDashboard } from './components/OpticalReleaseDashboard';
import { SecurityPairingModal } from './components/SecurityPairingModal';
import { QipNode } from './protocol/node';
import { QipCarrierType, QipFsmState, QipMessageEnvelope, QipTrustState } from './types/qip';
import { ShieldAlert, Check, X } from 'lucide-react';

export default function App() {
  // Initialize master QipNode singleton
  const node = useMemo(() => new QipNode(), []);

  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>('transceiver');
  const [activeCarrier, setActiveCarrier] = useState<QipCarrierType>(QipCarrierType.QR);
  const [fsmState, setFsmState] = useState<QipFsmState>(node.fsm.getState());
  const [isPairingOpen, setIsPairingOpen] = useState<boolean>(false);

  // Security prompt dialog state
  const [securityPrompt, setSecurityPrompt] = useState<{
    requester: string;
    capability: string;
    details: string;
    resolve: (val: boolean) => void;
  } | null>(null);

  // Global notification banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Connect FSM listener and security prompt handler
  useEffect(() => {
    const unsubFsm = node.fsm.onTransition((_old, newState) => {
      setFsmState(newState);
    });

    node.onSecurityPrompt = (requesterNodeId, capability, details) => {
      return new Promise<boolean>((resolve) => {
        setSecurityPrompt({
          requester: requesterNodeId,
          capability,
          details,
          resolve,
        });
      });
    };

    return () => {
      unsubFsm();
    };
  }, [node]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Called when an envelope is assembled by the receiver or dispatched from a panel
  const handleEnvelopeDispatched = (envelope: QipMessageEnvelope) => {
    showToast(`Dispatched ${envelope.type} (${envelope.msgId.slice(0, 8)}) to ${envelope.destination}`);
  };

  const handleMessageAssembled = (envelope: QipMessageEnvelope) => {
    showToast(`Received ${envelope.type} from ${envelope.source}`);
  };

  const handleVerifyPairing = (trustState: QipTrustState) => {
    node.identity.trustState = trustState;
    setIsPairingOpen(false);
    showToast(`Node trust updated to: ${trustState}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Header bar */}
      <Header
        identity={node.identity}
        fsmState={fsmState}
        activeCarrier={activeCarrier}
        heartbeat={node.heartbeat}
        onSelectCarrier={(c) => {
          setActiveCarrier(c);
          showToast(`Carrier switched to: ${c}`);
        }}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenPairing={() => setIsPairingOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'transceiver' && (
          <OpticalTransceiver
            node={node}
            activeCarrier={activeCarrier}
            onCarrierChange={setActiveCarrier}
            onMessageAssembled={handleMessageAssembled}
          />
        )}

        {activeTab === 'discovery' && (
          <OpticalDiscoveryPanel
            node={node}
            onDispatchEnvelope={handleEnvelopeDispatched}
            onSelectNodeForSession={(nodeId) => {
              setActiveTab('transceiver');
              showToast(`Session established with optical peer ${nodeId}`);
            }}
          />
        )}

        {activeTab === 'terminal' && (
          <OpticalTerminal
            node={node}
            onDispatchEnvelope={handleEnvelopeDispatched}
          />
        )}

        {activeTab === 'rpc' && (
          <OpticalRpcPanel
            node={node}
            onDispatchEnvelope={handleEnvelopeDispatched}
          />
        )}

        {activeTab === 'signage' && (
          <OpticalSignagePanel
            node={node}
            onDispatchEnvelope={handleEnvelopeDispatched}
          />
        )}

        {activeTab === 'sync' && (
          <OpticalSyncPanel
            node={node}
            onDispatchEnvelope={handleEnvelopeDispatched}
          />
        )}

        {activeTab === 'qpl' && (
          <OpticalQplStudio
            node={node}
            onDispatchEnvelope={handleEnvelopeDispatched}
          />
        )}

        {activeTab === 'carrier_lab' && (
          <OpticalCarrierLab
            activeCarrier={activeCarrier}
            onSelectCarrier={setActiveCarrier}
          />
        )}

        {activeTab === 'mesh' && (
          <OpticalMeshPanel
            node={node}
            onDispatchEnvelope={handleEnvelopeDispatched}
          />
        )}

        {activeTab === 'debugger' && (
          <OpticalDebugger
            node={node}
            onDispatchEnvelope={handleEnvelopeDispatched}
          />
        )}

        {activeTab === 'diagnostics' && (
          <OpticalDiagnosticsPanel node={node} />
        )}

        {activeTab === 'control' && (
          <OpticalControlCenter
            node={node}
            onSelectCarrier={setActiveCarrier}
            onSelectTab={setActiveTab}
          />
        )}

        {activeTab === 'release' && (
          <OpticalReleaseDashboard />
        )}
      </main>

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-cyan-500/50 shadow-2xl px-4 py-2.5 rounded-xl font-mono text-xs text-cyan-300 animate-in fade-in slide-in-from-bottom-2 duration-150 flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Security Capability Authorization Prompt Modal */}
      {securityPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-amber-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="font-mono text-sm font-bold text-slate-100">
                OPTICAL RPC AUTHORIZATION REQUEST
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Optical peer <span className="font-mono text-cyan-400 font-bold">{securityPrompt.requester}</span> is
              requesting execution of sensitive capability:
            </p>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs space-y-1">
              <div className="text-amber-300 font-bold">OPERATION: {securityPrompt.capability}</div>
              <div className="text-slate-400 break-all text-[11px]">ARGS: {securityPrompt.details}</div>
            </div>

            <p className="text-[11px] text-slate-400">
              Never execute unauthorized optical commands. Approve only if you initiated this visual request.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  securityPrompt.resolve(false);
                  setSecurityPrompt(null);
                }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-semibold cursor-pointer"
              >
                DENY
              </button>
              <button
                onClick={() => {
                  securityPrompt.resolve(true);
                  setSecurityPrompt(null);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold transition-colors cursor-pointer shadow-md"
              >
                AUTHORIZE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Human-Verifiable Security Pairing Modal */}
      <SecurityPairingModal
        identity={node.identity}
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        onVerifyPairing={handleVerifyPairing}
      />
    </div>
  );
}
