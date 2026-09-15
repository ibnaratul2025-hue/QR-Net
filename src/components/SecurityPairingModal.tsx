/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  Check,
  Lock,
  Key,
  Smartphone,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { QipIdentity, QipTrustState } from '../types/qip';
import { generateSasVerificationCode } from '../protocol/crc';

interface SecurityPairingModalProps {
  identity: QipIdentity;
  isOpen: boolean;
  onClose: () => void;
  onVerifyPairing: (trustState: QipTrustState) => void;
}

export const SecurityPairingModal: React.FC<SecurityPairingModalProps> = ({
  identity,
  isOpen,
  onClose,
  onVerifyPairing,
}) => {
  const [pairingType, setPairingType] = useState<'TEMPORARY' | 'PERSISTENT' | 'ONE_TIME'>('TEMPORARY');
  const [isVerified, setIsVerified] = useState<boolean>(identity.trustState === QipTrustState.TRUSTED);
  const [inputCode, setInputCode] = useState<string>('');

  if (!isOpen) return null;

  const handleConfirmMatch = () => {
    setIsVerified(true);
    onVerifyPairing(QipTrustState.TRUSTED);
  };

  const handleRevokePairing = () => {
    setIsVerified(false);
    onVerifyPairing(QipTrustState.UNKNOWN);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-mono text-base font-bold text-slate-100">
              OPTICAL PAIRING & SAS VERIFICATION
            </h3>
            <p className="text-xs text-slate-400">
              Human-verifiable Short Authentication String (SAS) against optical MitM
            </p>
          </div>
        </div>

        {/* Security Code Banner */}
        <div className="bg-slate-950 border-2 border-emerald-500/40 rounded-xl p-5 text-center space-y-2">
          <span className="text-xs font-mono text-slate-400 block tracking-wider">
            HUMAN-VERIFIABLE OPTICAL SECURITY CODE:
          </span>
          <div className="font-mono text-3xl font-extrabold text-emerald-400 tracking-widest selection:bg-emerald-950">
            {identity.pairingCode}
          </div>
          <p className="text-xs text-slate-400">
            Compare this code with the peer screen. If both numbers match, confirm verification.
          </p>
        </div>

        {/* Local Key Material Telemetry */}
        <div className="bg-slate-950/80 rounded-lg p-3.5 border border-slate-800 font-mono text-xs space-y-2 text-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">NODE ID:</span>
            <span className="text-cyan-400 font-bold">{identity.nodeId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">EPHEMERAL PUBKEY:</span>
            <span className="text-slate-400 break-all">{identity.publicKeyHex.slice(0, 26)}...</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">TRUST STATE:</span>
            <span
              className={`font-bold ${
                isVerified ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {isVerified ? 'VERIFIED & TRUSTED' : 'AWAITING SAS CONFIRMATION'}
            </span>
          </div>
        </div>

        {/* Pairing Policy Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-mono text-slate-400">PAIRING POLICY:</label>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            {[
              { id: 'TEMPORARY', label: 'Temporary' },
              { id: 'PERSISTENT', label: 'Persistent' },
              { id: 'ONE_TIME', label: 'One-Time' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPairingType(p.id as any)}
                className={`py-2 px-3 rounded-lg border text-center transition-colors cursor-pointer ${
                  pairingType === p.id
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={handleRevokePairing}
            className="px-3.5 py-2 rounded-lg text-xs font-mono text-rose-400 hover:bg-rose-950/40 border border-rose-500/30 transition-colors cursor-pointer"
          >
            REVOKE PAIRING
          </button>

          <button
            onClick={handleConfirmMatch}
            className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-emerald-950/50"
          >
            <Check className="w-4 h-4" />
            <span>CONFIRM MATCH ✓</span>
          </button>
        </div>
      </div>
    </div>
  );
};
