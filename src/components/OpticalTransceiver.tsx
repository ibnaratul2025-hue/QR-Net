/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  Radio,
  Copy,
  Check,
  Send,
  Zap,
  Sliders,
  AlertCircle,
  Eye,
  RefreshCw,
  Cpu,
  UploadCloud,
  FileUp,
  FileText,
  Download,
  Image as ImageIcon,
  FolderOpen,
  Smartphone,
  Video,
  Activity,
  Wrench,
} from 'lucide-react';
import {
  QipCarrierType,
  QipFramePacket,
  QipMessageEnvelope,
  QipMessageType,
  QipCameraResolution,
  QipOpticalDecodeHealth,
  QipCameraHardwareIssue,
} from '../types/qip';
import { packetizeMessage, parseRawFrame, QipSessionReassembler } from '../protocol/frame';
import { renderQrToCanvas, decodeQrFromImageData } from '../protocol/carriers/qrCarrier';
import { renderChromaticFrame, sampleChromaticData } from '../protocol/carriers/chromaticCarrier';
import { renderSymbolMatrix } from '../protocol/carriers/symbolCarrier';
import { QipNode } from '../protocol/node';
import { qipCameraHardwareHub } from '../protocol/cameraTelemetry';
import { AndroidOpticalLinkView } from './AndroidOpticalLinkView';

interface OpticalTransceiverProps {
  node: QipNode;
  activeCarrier: QipCarrierType;
  onCarrierChange: (carrier: QipCarrierType) => void;
  onMessageAssembled: (envelope: QipMessageEnvelope) => void;
}

export const OpticalTransceiver: React.FC<OpticalTransceiverProps> = ({
  node,
  activeCarrier,
  onCarrierChange,
  onMessageAssembled,
}) => {
  // Transmitter States
  const txCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const txFileInputRef = useRef<HTMLInputElement | null>(null);
  const [txMode, setTxMode] = useState<'BEACON' | 'CLIPBOARD' | 'COMMAND' | 'CUSTOM' | 'FILE'>('FILE');
  const [customText, setCustomText] = useState<string>(
    JSON.stringify({ greeting: 'Hello Optical World', channel: 'QIP/1.0', time: Date.now() }, null, 2)
  );
  const [clipboardText, setClipboardText] = useState<string>('qip://beacon/v1?device=laptop');
  const [selectedCommand, setSelectedCommand] = useState<string>('camera.capture');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    type: string;
    data: string;
    isBinary: boolean;
  } | null>({
    name: 'protocol_manifest.json',
    size: 284,
    type: 'application/json',
    data: JSON.stringify(
      {
        protocol: 'QIP/1.0',
        author: 'Optical Node Alpha',
        features: ['screen_tx', 'camera_rx', 'rpc', 'delta_sync', 'qpl'],
        timestamp: Date.now(),
      },
      null,
      2
    ),
    isBinary: false,
  });
  const [isDraggingTx, setIsDraggingTx] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(4);
  const [chunkSize, setChunkSize] = useState<number>(140);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(true);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [txFrames, setTxFrames] = useState<QipFramePacket[]>([]);
  const [clockPhase, setClockPhase] = useState<boolean>(false);
  const [txStats, setTxStats] = useState({ framesSent: 0, bytesSent: 0 });

  // Receiver States
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rxFileInputRef = useRef<HTMLInputElement | null>(null);
  const [rxMode, setRxMode] = useState<'LOOPBACK' | 'CAMERA' | 'IMAGE_FILE'>('LOOPBACK');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isDraggingRx, setIsDraggingRx] = useState<boolean>(false);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [imageDecodeStatus, setImageDecodeStatus] = useState<string | null>(null);
  const [rxStats, setRxStats] = useState({
    framesDecoded: 0,
    crcPassed: 0,
    crcFailed: 0,
    messagesReassembled: 0,
    lastDecodeMs: 0,
  });
  const [lastReceivedEnvelope, setLastReceivedEnvelope] = useState<QipMessageEnvelope | null>(null);
  const [reassemblyProgress, setReassemblyProgress] = useState<{ received: number; total: number; percent: number }>({
    received: 0,
    total: 0,
    percent: 0,
  });
  const [simulatedDropRate, setSimulatedDropRate] = useState<number>(0);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);

  // Camera Hardware & Optical Link Telemetry states
  const [cameraTelemetry, setCameraTelemetry] = useState<{
    health: QipOpticalDecodeHealth;
    resolution: QipCameraResolution;
  }>(qipCameraHardwareHub.getTelemetry());
  const [activeHardwareIssues, setActiveHardwareIssues] = useState<QipCameraHardwareIssue[]>(
    qipCameraHardwareHub.getActiveIssues()
  );
  const [showAndroidSimulator, setShowAndroidSimulator] = useState<boolean>(false);

  // Subscribe to real-time optical health and camera resolution
  useEffect(() => {
    const unsubTelemetry = qipCameraHardwareHub.subscribeTelemetry((health, resolution) => {
      setCameraTelemetry({ health, resolution });
    });
    const unsubIssues = qipCameraHardwareHub.subscribeIssues(() => {
      setActiveHardwareIssues(qipCameraHardwareHub.getActiveIssues());
    });
    return () => {
      unsubTelemetry();
      unsubIssues();
    };
  }, []);

  const reassemblerRef = useRef<QipSessionReassembler>(new QipSessionReassembler());
  const animFrameIdRef = useRef<number | null>(null);
  const txIntervalRef = useRef<any>(null);

  // Handle file selection for transmission (Drag-and-Drop & Click selection)
  const handleTxFileSelected = (file: File) => {
    const isText =
      file.type.startsWith('text/') ||
      file.type.includes('json') ||
      file.type.includes('javascript') ||
      file.type.includes('typescript') ||
      file.type.includes('xml') ||
      file.type.includes('markdown') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.json') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.qpl') ||
      file.name.endsWith('.csv');

    const reader = new FileReader();
    if (isText) {
      reader.onload = (e) => {
        const content = (e.target?.result as string) || '';
        setSelectedFile({
          name: file.name,
          size: file.size,
          type: file.type || 'text/plain',
          data: content,
          isBinary: false,
        });
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const content = (e.target?.result as string) || '';
        setSelectedFile({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          data: content,
          isBinary: true,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle image file selection for optical frame decoding
  const handleRxImageSelected = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageDecodeStatus('Please select an image file (PNG, JPG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setUploadedImagePreview(dataUrl);
      setImageDecodeStatus('Scanning image for optical frame...');

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = decodeQrFromImageData(imgData);

        if (decoded && decoded.data) {
          setImageDecodeStatus('QR Optical Frame Decoded Successfully!');
          const parsedPacket = parseRawFrame(decoded.data);
          if (parsedPacket) {
            const assembled = reassemblerRef.current.ingestPacket(parsedPacket);
            setRxStats((prev) => ({
              ...prev,
              framesDecoded: prev.framesDecoded + 1,
              crcPassed: prev.crcPassed + 1,
            }));
            if (assembled) {
              setLastReceivedEnvelope(assembled);
              onMessageAssembled(assembled);
              node.processIncomingEnvelope(assembled);
              setImageDecodeStatus(`Complete message assembled from image! Type: ${assembled.type}`);
            } else {
              const progress = reassemblerRef.current.getProgress(parsedPacket.sessionId);
              if (progress) setReassemblyProgress(progress);
              setImageDecodeStatus(`Decoded frame ${parsedPacket.seq + 1}/${parsedPacket.total}`);
            }
          }
        } else {
          setImageDecodeStatus('No valid QR/Optical frame detected in this image. Ensure frame is clearly visible.');
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Download received message / file to local disk
  const handleDownloadReceived = () => {
    if (!lastReceivedEnvelope) return;
    const payload = lastReceivedEnvelope.payload;
    let content = '';
    let fileName = `qip_received_${Date.now()}`;
    let mime = 'text/plain';

    if (payload?.fileName && payload?.content) {
      fileName = payload.fileName;
      mime = payload.mimeType || 'text/plain';
      content = payload.content;

      if (typeof payload.content === 'string' && payload.content.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = payload.content;
        a.download = fileName;
        a.click();
        return;
      }
    } else {
      content = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
      fileName = `${lastReceivedEnvelope.type.toLowerCase()}_${lastReceivedEnvelope.msgId.slice(0, 8)}.json`;
      mime = 'application/json';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate envelopes based on transmitter mode
  const buildCurrentEnvelope = useCallback((): QipMessageEnvelope => {
    switch (txMode) {
      case 'BEACON':
        return node.createPresenceBeacon();
      case 'CLIPBOARD':
        return node.createEnvelope(QipMessageType.TEXT, 'BROADCAST', {
          clipboard: clipboardText,
          detectedAt: Date.now(),
        });
      case 'COMMAND':
        return node.createEnvelope(QipMessageType.COMMAND, 'BROADCAST', {
          operation: selectedCommand,
          args: { requestedBy: node.identity.nodeId, timestamp: Date.now() },
        });
      case 'FILE':
        return node.createEnvelope(
          selectedFile?.isBinary ? QipMessageType.BINARY : QipMessageType.TEXT,
          'BROADCAST',
          {
            fileName: selectedFile?.name || 'document.txt',
            fileSize: selectedFile?.size || 0,
            mimeType: selectedFile?.type || 'text/plain',
            content: selectedFile?.data || '',
            timestamp: Date.now(),
          }
        );
      case 'CUSTOM':
      default: {
        let parsed: any = customText;
        try {
          parsed = JSON.parse(customText);
        } catch {
          // treat as plain text string
        }
        return node.createEnvelope(QipMessageType.JSON, 'BROADCAST', parsed);
      }
    }
  }, [txMode, node, clipboardText, selectedCommand, customText, selectedFile]);

  // Update TX frames when envelope or carrier or chunk size changes
  useEffect(() => {
    const envelope = buildCurrentEnvelope();
    const frames = packetizeMessage(envelope, activeCarrier, chunkSize);
    setTxFrames(frames);
    setCurrentFrameIndex(0);
  }, [buildCurrentEnvelope, activeCarrier, chunkSize]);

  // Render current frame to canvas
  useEffect(() => {
    if (!txCanvasRef.current || txFrames.length === 0) return;
    const canvas = txCanvasRef.current;
    const frame = txFrames[currentFrameIndex % txFrames.length];
    if (!frame) return;

    const serialized = JSON.stringify(frame);

    if (activeCarrier === QipCarrierType.QR) {
      renderQrToCanvas(canvas, serialized, {
        width: 320,
        margin: 2,
        darkColor: '#000000',
        lightColor: '#ffffff',
      }).catch((err) => console.error('QR render error', err));
    } else if (activeCarrier === QipCarrierType.CHROMATIC) {
      renderChromaticFrame(canvas, frame.payloadChunk, clockPhase);
    } else if (activeCarrier === QipCarrierType.SYMBOL_MATRIX) {
      renderSymbolMatrix(canvas, frame.payloadChunk, clockPhase);
    }
  }, [txFrames, currentFrameIndex, activeCarrier, clockPhase]);

  // Transmission cycle timer
  useEffect(() => {
    if (!isTransmitting || txFrames.length === 0) {
      if (txIntervalRef.current) clearInterval(txIntervalRef.current);
      return;
    }

    const intervalMs = Math.max(50, Math.floor(1000 / fps));
    txIntervalRef.current = setInterval(() => {
      setClockPhase((prev) => !prev);
      setCurrentFrameIndex((prev) => {
        const next = (prev + 1) % txFrames.length;
        setTxStats((s) => ({
          framesSent: s.framesSent + 1,
          bytesSent: s.bytesSent + (txFrames[prev]?.payloadChunk.length || 0),
        }));
        return next;
      });
    }, intervalMs);

    return () => {
      if (txIntervalRef.current) clearInterval(txIntervalRef.current);
    };
  }, [isTransmitting, txFrames, fps]);

  // Process a raw decoded string through the protocol reassembly engine
  const handleDecodedString = useCallback(
    async (rawString: string, decodeDurationMs: number = 0) => {
      const parsedFrame = parseRawFrame(rawString);
      if (!parsedFrame) {
        setRxStats((s) => ({ ...s, crcFailed: s.crcFailed + 1 }));
        return;
      }

      setRxStats((s) => ({
        ...s,
        framesDecoded: s.framesDecoded + 1,
        crcPassed: s.crcPassed + 1,
        lastDecodeMs: decodeDurationMs,
      }));

      const { envelope, progress } = reassemblerRef.current.ingestFrame(parsedFrame);
      setReassemblyProgress(progress);

      if (envelope) {
        setRxStats((s) => ({ ...s, messagesReassembled: s.messagesReassembled + 1 }));
        setLastReceivedEnvelope(envelope);
        onMessageAssembled(envelope);
        await node.processIncomingEnvelope(envelope, { decodeDurationMs });
      }
    },
    [node, onMessageAssembled]
  );

  // Virtual Optical Loopback Bus simulator
  useEffect(() => {
    if (rxMode !== 'LOOPBACK' || !isTransmitting || txFrames.length === 0) return;

    // Direct optical interconnect with optional simulated frame drop
    const currentFrame = txFrames[currentFrameIndex % txFrames.length];
    if (!currentFrame) return;

    if (simulatedDropRate > 0 && Math.random() * 100 < simulatedDropRate) {
      setRxStats((s) => ({ ...s, crcFailed: s.crcFailed + 1 }));
      return;
    }

    const rawString = JSON.stringify(currentFrame);
    // Simulate optical scan decode time (between 5ms - 15ms)
    const simulatedDecodeTime = Math.floor(Math.random() * 10) + 5;
    const timeout = setTimeout(() => {
      handleDecodedString(rawString, simulatedDecodeTime);
    }, 40);

    return () => clearTimeout(timeout);
  }, [rxMode, isTransmitting, currentFrameIndex, txFrames, simulatedDropRate, handleDecodedString]);

  // Real Camera Hardware lifecycle
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API (getUserMedia) is not supported in this browser context.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920, min: 640 }, height: { ideal: 1080, min: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);

        // Inspect actual hardware video track resolution and frame rate
        const track = stream.getVideoTracks()[0];
        if (track) {
          const settings = track.getSettings();
          const w = settings.width || 1280;
          const h = settings.height || 720;
          const fps = Math.round(settings.frameRate || 30);
          qipCameraHardwareHub.updateResolution(w, h, fps);
          qipCameraHardwareHub.reportHardwareEvent({
            errorCode: 'CAMERAX_HARDWARE_READY',
            severity: 'INFO',
            component: 'CameraX',
            message: `Optical camera sensor locked at ${w}×${h} @ ${fps} FPS.`,
            troubleshooting: ['Sensor operational.'],
            resolved: true,
          });
          qipCameraHardwareHub.updateDecodeHealth({
            healthScore: 92,
            linkState: 'LOCKED',
            snrDb: 18.2,
          });
        }
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      const isPermission = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const isBusy = err.name === 'NotReadableError' || err.name === 'TrackStartError';
      const errorCode = isPermission ? 'PERMISSION_DENIED' : isBusy ? 'CAMERAX_ERR_CAMERA_IN_USE' : 'CAMERA_UNAVAILABLE';
      const severity = isPermission || isBusy ? 'CRITICAL' : 'WARNING';
      const msg = err.message || (isPermission ? 'Camera permission was denied.' : 'Camera hardware is locked by another process.');

      qipCameraHardwareHub.reportHardwareEvent({
        errorCode,
        severity,
        component: isPermission ? 'Permissions' : 'CameraX',
        message: msg,
        troubleshooting: isPermission
          ? [
              'Click the camera permission icon in your browser URL bar and choose "Always allow".',
              'On mobile, check Android Settings > Apps > Chrome/App > Permissions > Camera.',
            ]
          : [
              'Close any background video apps (Zoom, Teams, Camera app).',
              'Restart your browser or reload this tab to release camera device lock.',
            ],
      });
      qipCameraHardwareHub.updateDecodeHealth({
        healthScore: 0,
        linkState: 'NO_SIGNAL',
      });

      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      qipCameraHardwareHub.reportHardwareEvent({
        errorCode: 'CAMERA_STOPPED',
        severity: 'INFO',
        component: 'CameraX',
        message: 'Camera stream stopped. Hardware sensor released.',
        troubleshooting: [],
        resolved: true,
      });
    }
    setIsCameraActive(false);
  };

  // Continuous Camera Scan Loop
  useEffect(() => {
    if (rxMode !== 'CAMERA' || !isCameraActive) {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      return;
    }

    let isScanning = true;

    const scanFrame = () => {
      if (!isScanning) return;
      const video = videoRef.current;
      const canvas = rxCanvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 240;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const startTime = performance.now();
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          if (activeCarrier === QipCarrierType.QR) {
            const qrResult = decodeQrFromImageData(imageData);
            if (qrResult && qrResult.data) {
              const duration = Math.round(performance.now() - startTime);
              handleDecodedString(qrResult.data, duration);
            }
          } else if (activeCarrier === QipCarrierType.CHROMATIC) {
            const chromatic = sampleChromaticData(imageData);
            if (chromatic && chromatic.confidence > 0.7) {
              const duration = Math.round(performance.now() - startTime);
              // Telemetry on dominant color
            }
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [rxMode, isCameraActive, activeCarrier, handleDecodedString]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const copyPayload = () => {
    if (lastReceivedEnvelope) {
      navigator.clipboard.writeText(JSON.stringify(lastReceivedEnvelope, null, 2));
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold font-mono text-cyan-300 flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            OPTICAL HARDWARE LAYER: SCREEN TRANSMITTER & CAMERA RECEIVER
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Sequence of visual states as a programmable physical bus. Operate via camera pointed at
            another screen, or run the virtual optical bus interconnect.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right font-mono text-xs">
            <span className="text-slate-500 block">CARRIER</span>
            <span className="text-cyan-400 font-bold">{activeCarrier}</span>
          </div>
          <div className="h-7 w-px bg-slate-800" />
          <div className="text-right font-mono text-xs">
            <span className="text-slate-500 block">OPTICAL CLOCK</span>
            <span className="text-emerald-400 font-bold">{fps} Hz</span>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Transmitter (Left) and Receiver (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================= */}
        {/* TRANSMITTER: SCREEN DISPLAY                               */}
        {/* ========================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <h3 className="font-mono text-sm font-bold text-slate-100">OPTICAL TRANSMITTER (SCREEN)</h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-400">
                  Frame {txFrames.length > 0 ? currentFrameIndex + 1 : 0}/{txFrames.length}
                </span>
                <span
                  className={`w-3 h-3 rounded-full transition-colors ${
                    clockPhase ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' : 'bg-amber-500 shadow-[0_0_8px_#F59E0B]'
                  }`}
                  title="Optical Clock Strobe Phase"
                />
              </div>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-4">
              {[
                { id: 'FILE', label: 'File Selection' },
                { id: 'BEACON', label: 'Presence Beacon' },
                { id: 'CLIPBOARD', label: 'Optical Clipboard' },
                { id: 'COMMAND', label: 'Optical RPC' },
                { id: 'CUSTOM', label: 'Custom Payload' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setTxMode(m.id as any)}
                  className={`py-1.5 px-2 text-xs font-mono rounded border transition-colors cursor-pointer text-center ${
                    txMode === m.id
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Payload Mode Specific Inputs */}
            {txMode === 'FILE' && (
              <div className="mb-4 space-y-2">
                <input
                  type="file"
                  ref={txFileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleTxFileSelected(file);
                  }}
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingTx(true);
                  }}
                  onDragLeave={() => setIsDraggingTx(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingTx(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleTxFileSelected(file);
                  }}
                  onClick={() => txFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    isDraggingTx
                      ? 'border-cyan-400 bg-cyan-950/30'
                      : 'border-slate-700/80 hover:border-cyan-500/60 bg-slate-950/70'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-mono font-bold text-slate-200 block">
                        Drop file here or <span className="text-cyan-400 underline">browse files</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Select text, JSON, code, documents, or images to transmit optically
                      </span>
                    </div>
                  </div>
                </div>

                {selectedFile && (
                  <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-2.5 truncate">
                      <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div className="truncate">
                        <span className="text-slate-200 font-semibold block truncate">
                          {selectedFile.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'text/plain'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        txFileInputRef.current?.click();
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] shrink-0 cursor-pointer"
                    >
                      Change File
                    </button>
                  </div>
                )}
              </div>
            )}

            {txMode === 'BEACON' && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 mb-4">
                <div className="text-slate-500 mb-1">// CONTINUOUS PRESENCE BEACON</div>
                <div>DEVICE: <span className="text-cyan-400">{node.identity.nodeId}</span> ({node.identity.name})</div>
                <div>STATUS: <span className="text-emerald-400">ONLINE</span> | SAS: <span className="text-amber-300">{node.identity.pairingCode}</span></div>
                <div>CAPS: {node.identity.capabilities.slice(0, 5).join(', ')}...</div>
              </div>
            )}

            {txMode === 'CLIPBOARD' && (
              <div className="mb-4">
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  OPTICAL CLIPBOARD CONTENT:
                </label>
                <input
                  type="text"
                  value={clipboardText}
                  onChange={(e) => setClipboardText(e.target.value)}
                  placeholder="Paste URL, text, or token to broadcast..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {txMode === 'COMMAND' && (
              <div className="mb-4">
                <label className="block text-xs font-mono text-slate-400 mb-1">SELECT RPC COMMAND:</label>
                <select
                  value={selectedCommand}
                  onChange={(e) => setSelectedCommand(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="camera.capture">CALL camera.capture (Request Photo/Telemetry)</option>
                  <option value="clipboard.write">CALL clipboard.write (Push Data to Clipboard)</option>
                  <option value="compute.hash">CALL compute.hash (Optical Edge Compute)</option>
                  <option value="timer.start">CALL timer.start (Synchronize Timer)</option>
                  <option value="text.display">CALL text.display (Render Message on Screen)</option>
                </select>
              </div>
            )}

            {txMode === 'CUSTOM' && (
              <div className="mb-4">
                <label className="block text-xs font-mono text-slate-400 mb-1">JSON OR TEXT PAYLOAD:</label>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {/* Display Canvas Frame Target */}
            <div className="relative bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center p-4 min-h-[340px]">
              <div className="relative">
                <canvas
                  ref={txCanvasRef}
                  width={300}
                  height={300}
                  className="rounded-lg shadow-2xl border-4 border-slate-800 bg-white"
                />
                {/* Optical Alignment corner markers */}
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />
              </div>

              {/* Progress bar across multi-frame sequences */}
              {txFrames.length > 1 && (
                <div className="w-full max-w-[300px] mt-3">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                    <span>Frame Sequence</span>
                    <span>{Math.round(((currentFrameIndex + 1) / txFrames.length) * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-100"
                      style={{ width: `${((currentFrameIndex + 1) / txFrames.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transmitter Tuning Controls */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsTransmitting(!isTransmitting)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                    isTransmitting
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                >
                  {isTransmitting ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isTransmitting ? 'PAUSE CARRIER' : 'TRANSMIT'}</span>
                </button>

                <button
                  onClick={() => {
                    setCurrentFrameIndex((prev) => (prev + 1) % (txFrames.length || 1));
                  }}
                  disabled={isTransmitting}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Step Frame
                </button>
              </div>

              {/* FPS & Chunk Size Controls */}
              <div className="flex items-center space-x-4 text-xs font-mono">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">RATE:</span>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-16 accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-cyan-300 font-bold w-7 text-right">{fps} Hz</span>
                </div>

                <div className="hidden sm:flex items-center space-x-2">
                  <span className="text-slate-400">CHUNK:</span>
                  <input
                    type="range"
                    min="60"
                    max="240"
                    step="20"
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    className="w-16 accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-cyan-300 font-bold w-12 text-right">{chunkSize}B</span>
                </div>
              </div>
            </div>

            {/* Transmitter Telemetry Footer */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/60">
              <span>TX SENT: <b className="text-slate-200">{txStats.framesSent}</b> frames</span>
              <span>DATA: <b className="text-slate-200">{(txStats.bytesSent / 1024).toFixed(1)} KB</b></span>
              <span>CRC: <b className="text-emerald-400">{txFrames[currentFrameIndex]?.chunkChecksum || 'N/A'}</b></span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RECEIVER: CAMERA SCANNER & OPTICAL BUS                   */}
        {/* ========================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="font-mono text-sm font-bold text-slate-100">OPTICAL RECEIVER (CAMERA / BUS)</h3>
              </div>

              {/* Mode switch: Camera vs Loopback vs Image File */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
                <button
                  onClick={() => {
                    setRxMode('LOOPBACK');
                    stopCamera();
                  }}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    rxMode === 'LOOPBACK'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Loopback Bus
                </button>
                <button
                  onClick={() => {
                    setRxMode('CAMERA');
                    startCamera();
                  }}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    rxMode === 'CAMERA'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Hardware Camera
                </button>
                <button
                  onClick={() => {
                    setRxMode('IMAGE_FILE');
                    stopCamera();
                  }}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    rxMode === 'IMAGE_FILE'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Scan Image File
                </button>
              </div>
            </div>

            {/* Visual Indicator: Real-time Camera Frame Resolution & Decode Health */}
            <div className="mb-4 bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      cameraTelemetry.health.healthScore >= 80
                        ? 'bg-emerald-400'
                        : cameraTelemetry.health.healthScore >= 50
                        ? 'bg-cyan-400'
                        : cameraTelemetry.health.healthScore >= 20
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    } animate-pulse`}
                  />
                  <span className="font-mono text-xs font-bold text-slate-200">
                    OPTICAL LINK QUALITY
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                    {rxMode}
                  </span>
                </div>

                {/* Live Resolution Badge */}
                <div className="flex items-center space-x-1.5 font-mono text-xs">
                  <Video className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-bold text-cyan-300">
                    {cameraTelemetry.resolution.width}×{cameraTelemetry.resolution.height}
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    @{cameraTelemetry.resolution.fps}fps
                  </span>
                </div>
              </div>

              {/* Decode Health Score and Link State */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span
                    className={`font-bold ${
                      cameraTelemetry.health.healthScore >= 80
                        ? 'text-emerald-400'
                        : cameraTelemetry.health.healthScore >= 50
                        ? 'text-cyan-400'
                        : cameraTelemetry.health.healthScore >= 20
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    Decode Health: {cameraTelemetry.health.healthScore}% ({cameraTelemetry.health.linkState})
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    SNR: {cameraTelemetry.health.snrDb} dB • Contrast: {cameraTelemetry.health.contrastScore}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      cameraTelemetry.health.healthScore >= 80
                        ? 'bg-emerald-400'
                        : cameraTelemetry.health.healthScore >= 50
                        ? 'bg-cyan-400'
                        : cameraTelemetry.health.healthScore >= 20
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                    style={{ width: `${cameraTelemetry.health.healthScore}%` }}
                  />
                </div>
              </div>

              {/* Active Hardware Alert banner */}
              {activeHardwareIssues.length > 0 && (
                <div className="p-2 rounded-lg bg-rose-950/50 border border-rose-800/80 text-[11px] font-mono text-rose-300 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 truncate">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">
                      Hardware Alert: [{activeHardwareIssues[0].errorCode}] {activeHardwareIssues[0].message}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const tab = document.querySelector('[data-tab="diagnostics"]') as HTMLElement;
                      tab?.click();
                    }}
                    className="text-[10px] text-cyan-400 hover:underline shrink-0 ml-2 font-bold cursor-pointer"
                  >
                    Troubleshoot →
                  </button>
                </div>
              )}
            </div>

            {/* Camera Viewport / Loopback Canvas View / Image File Scanner */}
            <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col items-center justify-center p-3 min-h-[340px]">
              {rxMode === 'IMAGE_FILE' ? (
                <div className="w-full h-[300px] flex flex-col items-center justify-center p-3 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    ref={rxFileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleRxImageSelected(file);
                    }}
                    className="hidden"
                  />

                  {uploadedImagePreview ? (
                    <div className="w-full h-full flex flex-col items-center justify-between space-y-2">
                      <div className="relative max-h-[180px] max-w-[200px] rounded-lg overflow-hidden border border-slate-800 bg-slate-900">
                        <img
                          src={uploadedImagePreview}
                          alt="Uploaded optical frame"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="text-xs font-mono text-cyan-300 px-2 py-1 bg-slate-900/90 rounded border border-slate-800 max-w-sm truncate">
                        {imageDecodeStatus || 'Image analyzed.'}
                      </div>
                      <button
                        onClick={() => rxFileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-lg border border-slate-700 cursor-pointer flex items-center space-x-1.5"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Select Another Image File</span>
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingRx(true);
                      }}
                      onDragLeave={() => setIsDraggingRx(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingRx(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleRxImageSelected(file);
                      }}
                      onClick={() => rxFileInputRef.current?.click()}
                      className={`w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 cursor-pointer transition-all ${
                        isDraggingRx
                          ? 'border-cyan-400 bg-cyan-950/30'
                          : 'border-slate-800 hover:border-cyan-500/60 bg-slate-950/80'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <div className="font-mono text-xs font-bold text-slate-200">
                        SELECT OPTICAL FRAME IMAGE FILE
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1">
                        Drag & drop a QR / frame photo, or click to browse
                      </div>
                      <div className="mt-3 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-400">
                        PNG • JPG • WEBP • SCREENSHOTS
                      </div>
                    </div>
                  )}
                </div>
              ) : rxMode === 'CAMERA' ? (
                <div className="relative w-full h-[300px] flex items-center justify-center bg-slate-950 rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <canvas ref={rxCanvasRef} className="hidden" />

                  {/* Reticle / Optical Target overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-dashed border-cyan-400/70 rounded-lg flex items-center justify-center relative">
                      <div className="w-3 h-3 bg-cyan-400/40 rounded-full animate-ping" />
                      {/* Reticle corners */}
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
                    </div>
                  </div>

                  {/* Camera control bar */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-800">
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 animate-pulse" />
                      SCANNING OPTICAL BEAM
                    </span>
                    <button
                      onClick={() => {
                        const next = facingMode === 'environment' ? 'user' : 'environment';
                        setFacingMode(next);
                        stopCamera();
                        setTimeout(() => startCamera(), 100);
                      }}
                      className="text-slate-300 hover:text-cyan-400 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Flip Lens
                    </button>
                  </div>
                </div>
              ) : (
                /* Loopback Interconnect Visualizer */
                <div className="w-full h-[300px] flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                    <Cpu className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-mono text-sm font-semibold text-slate-200">
                      VIRTUAL OPTICAL BUS INTERCONNECT ACTIVE
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm mt-1">
                      Direct screen-to-camera optical loopback channel. Transmitted frames flow into the
                      decoder pipeline in real time with CRC validation and session reassembly.
                    </p>
                  </div>

                  {/* Simulated optical noise slider */}
                  <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 w-full max-w-xs flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Simulate Glare / Loss:</span>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="5"
                      value={simulatedDropRate}
                      onChange={(e) => setSimulatedDropRate(Number(e.target.value))}
                      className="w-20 accent-rose-400 cursor-pointer"
                    />
                    <span className="text-rose-400 font-bold w-8 text-right">{simulatedDropRate}%</span>
                  </div>
                </div>
              )}

              {/* Camera Error Message */}
              {cameraError && (
                <div className="absolute inset-x-4 bottom-4 bg-rose-950/90 border border-rose-500/50 rounded-lg p-3 text-xs text-rose-200 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>

            {/* Reassembly Progress Indicator */}
            {reassemblyProgress.total > 1 && (
              <div className="mt-3 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
                  <span>Reassembling Multi-frame Payload:</span>
                  <span className="text-cyan-400 font-bold">
                    {reassemblyProgress.received}/{reassemblyProgress.total} ({reassemblyProgress.percent}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-150"
                    style={{ width: `${reassemblyProgress.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Reassembled Message Payload Inspector */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="bg-slate-950 rounded-lg border border-slate-800 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-slate-300">LATEST REASSEMBLED ENVELOPE</span>
                  {lastReceivedEnvelope && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      {lastReceivedEnvelope.type}
                    </span>
                  )}
                </div>
                {lastReceivedEnvelope && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleDownloadReceived}
                      className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer"
                      title="Download received file or payload to disk"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </button>
                    <button
                      onClick={copyPayload}
                      className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center space-x-1 cursor-pointer"
                    >
                      {copiedPayload ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPayload ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>

              {lastReceivedEnvelope ? (
                <pre className="text-[11px] font-mono text-slate-300 max-h-28 overflow-y-auto bg-slate-900/90 p-2 rounded border border-slate-800/80 no-scrollbar">
                  {JSON.stringify(lastReceivedEnvelope, null, 2)}
                </pre>
              ) : (
                <div className="text-xs font-mono text-slate-500 py-3 text-center">
                  Waiting for optical frames...
                </div>
              )}
            </div>

            {/* Receiver Telemetry Footer */}
            <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <div>
                <span className="text-slate-500 block">DECODED</span>
                <span className="text-slate-200 font-bold">{rxStats.framesDecoded}</span>
              </div>
              <div>
                <span className="text-slate-500 block">CRC VALID</span>
                <span className="text-emerald-400 font-bold">{rxStats.crcPassed}</span>
              </div>
              <div>
                <span className="text-slate-500 block">DROPPED</span>
                <span className="text-rose-400 font-bold">{rxStats.crcFailed}</span>
              </div>
              <div>
                <span className="text-slate-500 block">DECODE LAT</span>
                <span className="text-cyan-400 font-bold">{rxStats.lastDecodeMs} ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Android Subsystem Bridge Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-500/30 text-cyan-400">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="font-mono text-xs font-bold text-slate-200 flex items-center space-x-2">
              <span>ANDROID OPTICAL NODE (CAMERAX & JETPACK COMPOSE)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ACTIVE PIPELINE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Features DefaultLifecycleObserver background suspension, CameraX error listener, and real-time link feedback.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAndroidSimulator(!showAndroidSimulator)}
          className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>{showAndroidSimulator ? 'HIDE ANDROID SIMULATOR' : 'OPEN ANDROID UI SIMULATOR'}</span>
        </button>
      </div>

      {/* Android UI View Simulator (when toggled) */}
      {showAndroidSimulator && (
        <AndroidOpticalLinkView
          onOpenDiagnostics={() => {
            const tab = document.querySelector('[data-tab="diagnostics"]') as HTMLElement;
            tab?.click();
          }}
        />
      )}
    </div>
  );
};
