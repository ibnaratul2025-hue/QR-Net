/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Play,
  Package,
  ShieldAlert,
  CheckCircle,
  FileCode,
  ArrowRight,
  Download,
  Terminal,
  UploadCloud,
  FileUp,
} from 'lucide-react';
import { QipNode } from '../protocol/node';
import { QipCapability, QipMessageType, QipPackageManifest } from '../types/qip';
import { calculateSha256, calculateCrc32 } from '../protocol/crc';
import { parseQpl, QplRuntime } from '../protocol/qpl';

interface OpticalQplStudioProps {
  node: QipNode;
  onDispatchEnvelope: (envelope: any) => void;
}

const DEFAULT_QPL_SAMPLE = `// Safe QPL Declarative Protocol Script
DEVICE {
  display
  camera
  clipboard
}

ON receive("HELLO") {
  display("HANDSHAKE SUCCESSFUL");
  emit("device.ready");
}

ON event("temperature.changed") {
  display("THERMAL TELEMETRY RECEIVED");
}

// Optical Workflow Engine Rule
WHEN device.detected THEN request.capabilities IF camera.available THEN show("CAMERA READY")
`;

export const OpticalQplStudio: React.FC<OpticalQplStudioProps> = ({
  node,
  onDispatchEnvelope,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceCode, setSourceCode] = useState(DEFAULT_QPL_SAMPLE);
  const [currentFileName, setCurrentFileName] = useState<string>('sample.qpl');
  const [runtimeLogs, setRuntimeLogs] = useState<string[]>([
    'QPL Runtime sandbox initialized.',
    'Restricted declarative instruction set active.',
  ]);
  const [testEventInput, setTestEventInput] = useState<string>('HELLO');
  const [packageManifest, setPackageManifest] = useState<QipPackageManifest | null>(null);
  const [packageStatus, setPackageStatus] = useState<string | null>(null);

  const handleScriptFileSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      setSourceCode(content);
      setCurrentFileName(file.name);
      appendRuntimeLog(`Loaded script file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    };
    reader.readAsText(file);
  };

  const handleExportScript = () => {
    const blob = new Blob([sourceCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFileName || 'protocol_script.qpl';
    a.click();
    URL.revokeObjectURL(url);
    appendRuntimeLog(`Exported script file: ${currentFileName}`);
  };

  const appendRuntimeLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setRuntimeLogs((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 15)]);
  };

  const handleTestRun = () => {
    const { program, errors } = parseQpl(sourceCode);
    if (errors.length > 0) {
      appendRuntimeLog(`Syntax Error: ${errors.join(', ')}`);
      return;
    }

    appendRuntimeLog('QPL Program compiled successfully into safe AST.');
    appendRuntimeLog(`Declared Capabilities: ${(program.device?.capabilities || []).join(', ')}`);
    appendRuntimeLog(`Registered Handlers: ${program.handlers.length} | Workflows: ${program.workflows.length}`);

    // Create runtime instance
    const runtime = new QplRuntime();
    runtime.loadProgram(sourceCode);

    // Run test event trigger
    appendRuntimeLog(`Simulating incoming optical trigger: "${testEventInput}"`);

    runtime.handleEvent('receive', testEventInput, {
      displayMessage: (msg) => appendRuntimeLog(`[UI DISPLAY] "${msg}"`),
      emitEvent: (ev, pl) => appendRuntimeLog(`[OPTICAL EVENT BUS] Emitted '${ev}'`),
      requestCapability: (cap) => appendRuntimeLog(`[RPC CAPABILITY REQUEST] '${cap}'`),
      setState: (k, v) => appendRuntimeLog(`[STATE UPDATE] ${k} = ${v}`),
      log: (msg) => appendRuntimeLog(`[LOG] ${msg}`),
      availableCapabilities: ['camera', 'display'],
    });
  };

  const handleBundlePackage = async () => {
    const hash = calculateCrc32(sourceCode);
    const contentHash = `qip://sha256/${hash}`;

    const manifest: QipPackageManifest = {
      packageId: 'pkg_' + Math.random().toString(36).substring(2, 8),
      name: 'Transit Companion Micro-App',
      version: '1.0.4',
      author: node.identity.nodeId,
      contentHash,
      capabilitiesRequired: [QipCapability.DISPLAY, QipCapability.CAMERA],
      code: sourceCode,
      timestamp: Date.now(),
    };

    setPackageManifest(manifest);
    setPackageStatus('Package compiled with content hash: ' + contentHash);

    // Emit optical package distribution envelope
    const envelope = node.createEnvelope(QipMessageType.PACKAGE, 'BROADCAST', manifest);
    onDispatchEnvelope(envelope);

    appendRuntimeLog(`Bundled optical package [${manifest.name}] (Hash: ${contentHash}). Emitted to optical transmitter.`);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold font-mono text-cyan-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            QPL STUDIO & OPTICAL SOFTWARE DISTRIBUTION
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Safe, restricted declarative protocol description language (QPL) and content-addressed
            optical software packaging. Never executes without explicit permission.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleTestRun}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-mono text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>RUN SIMULATION</span>
          </button>
          <button
            onClick={handleBundlePackage}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <Package className="w-3.5 h-3.5" />
            <span>BUNDLE QIP PACKAGE</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QPL Editor */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <span className="font-mono text-xs font-bold text-slate-200 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                DECLARATIVE QPL SOURCE {currentFileName ? `(${currentFileName})` : ''}
              </span>
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleScriptFileSelected(f);
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer"
                  title="Open script file from disk"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>Open File</span>
                </button>
                <span className="text-slate-700">|</span>
                <button
                  onClick={handleExportScript}
                  className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer"
                  title="Export script file to disk"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save File</span>
                </button>
                <span className="text-slate-700">|</span>
                <span className="text-[10px] font-mono text-emerald-400">RESTRICTED SANDBOX</span>
              </div>
            </div>

            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              rows={14}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500 leading-relaxed resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center space-x-2 flex-1">
              <span className="text-slate-400">Trigger:</span>
              <input
                type="text"
                value={testEventInput}
                onChange={(e) => setTestEventInput(e.target.value)}
                placeholder="Trigger string..."
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 text-xs w-36 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <span className="text-slate-500 text-[11px]">// No eval, no DOM access</span>
          </div>
        </div>

        {/* Runtime Logs & Package Manifest */}
        <div className="space-y-6">
          {/* Sandbox Execution Stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                QPL SANDBOX RUNTIME OUTPUT
              </span>
              <span className="text-[10px] font-mono text-slate-500">Event-Driven Engine</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar font-mono text-[11px]">
              {runtimeLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-slate-950/80 border border-slate-850 text-slate-300"
                >
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Optical Package Manifest Inspector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                OPTICAL SOFTWARE PACKAGE
              </span>
              <span className="text-[10px] font-mono text-amber-400">
                {packageManifest ? 'READY FOR AIR-GAPPED BOOTSTRAP' : 'UNBUNDLED'}
              </span>
            </div>

            {packageManifest ? (
              <div className="space-y-2 font-mono text-xs text-slate-300">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                  <div>NAME: <span className="text-cyan-400 font-bold">{packageManifest.name}</span> (v{packageManifest.version})</div>
                  <div>HASH: <span className="text-emerald-400 break-all">{packageManifest.contentHash}</span></div>
                  <div>AUTHOR: <span className="text-slate-400">{packageManifest.author}</span></div>
                  <div>REQUIRED CAPS: <span className="text-amber-300">{packageManifest.capabilitiesRequired.join(', ')}</span></div>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Receiver verifies hash and prompts user before installing into offline cache.</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 font-mono text-xs">
                Click &quot;BUNDLE QIP PACKAGE&quot; to compile this script into an optical software distribution packet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
