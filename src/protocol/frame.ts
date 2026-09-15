/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Packet Framing, Fragmentation & Reassembly Engine
 */

import { QipCarrierType, QipFramePacket, QipMessageEnvelope } from '../types/qip';
import { calculateCrc32 } from './crc';

// Maximum character payload per optical frame (tuned for rapid optical QR or Chromatic recovery)
export const DEFAULT_CHUNK_SIZE = 180;

/**
 * Packetizes a QIP Message Envelope into one or more sequential Optical Frame Packets
 */
export function packetizeMessage(
  envelope: QipMessageEnvelope,
  carrier: QipCarrierType = QipCarrierType.QR,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): QipFramePacket[] {
  const serialized = JSON.stringify(envelope);
  const totalChunks = Math.ceil(serialized.length / chunkSize) || 1;
  const sessionId = envelope.msgId.slice(0, 8);
  const frames: QipFramePacket[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunk = serialized.slice(i * chunkSize, (i + 1) * chunkSize);
    const checksum = calculateCrc32(chunk);
    frames.push({
      magic: 'QIP',
      sessionId,
      seq: i + 1,
      total: totalChunks,
      carrier,
      payloadChunk: chunk,
      chunkChecksum: checksum,
      frameTimestamp: Date.now(),
    });
  }

  return frames;
}

/**
 * Serializes a single frame packet to a compact optical string
 */
export function serializeFrame(frame: QipFramePacket): string {
  return JSON.stringify(frame);
}

/**
 * Parses and validates raw optical carrier string into a QipFramePacket
 */
export function parseRawFrame(rawText: string): QipFramePacket | null {
  try {
    const parsed = JSON.parse(rawText);
    if (parsed.magic !== 'QIP' || typeof parsed.seq !== 'number' || typeof parsed.total !== 'number') {
      return null;
    }
    // Verify checksum
    const calc = calculateCrc32(parsed.payloadChunk);
    if (calc !== parsed.chunkChecksum) {
      console.warn(`[QIP] Frame checksum mismatch: expected ${parsed.chunkChecksum}, got ${calc}`);
      return null;
    }
    return parsed as QipFramePacket;
  } catch {
    return null;
  }
}

/**
 * Reassembly buffer for multi-frame optical sessions
 */
export class QipSessionReassembler {
  private sessions: Map<string, {
    total: number;
    frames: Map<number, QipFramePacket>;
    startTime: number;
    lastSeen: number;
    carrier: QipCarrierType;
  }> = new Map();

  /**
   * Feed a decoded frame. Returns complete QipMessageEnvelope if this frame completed the session, else null.
   */
  public ingestFrame(frame: QipFramePacket): {
    envelope: QipMessageEnvelope | null;
    progress: { received: number; total: number; percent: number };
    isNew: boolean;
  } {
    let session = this.sessions.get(frame.sessionId);
    let isNew = false;

    if (!session) {
      isNew = true;
      session = {
        total: frame.total,
        frames: new Map(),
        startTime: Date.now(),
        lastSeen: Date.now(),
        carrier: frame.carrier,
      };
      this.sessions.set(frame.sessionId, session);
    }

    session.lastSeen = Date.now();
    session.frames.set(frame.seq, frame);

    const receivedCount = session.frames.size;
    const totalCount = session.total;
    const percent = Math.round((receivedCount / totalCount) * 100);

    if (receivedCount >= totalCount) {
      // Reconstruct payload
      let fullString = '';
      for (let i = 1; i <= totalCount; i++) {
        const f = session.frames.get(i);
        if (!f) return { envelope: null, progress: { received: receivedCount, total: totalCount, percent }, isNew };
        fullString += f.payloadChunk;
      }

      // Cleanup
      this.sessions.delete(frame.sessionId);

      try {
        const envelope = JSON.parse(fullString) as QipMessageEnvelope;
        return { envelope, progress: { received: totalCount, total: totalCount, percent: 100 }, isNew };
      } catch (err) {
        console.error('[QIP] Failed to parse reassembled envelope', err);
        return { envelope: null, progress: { received: totalCount, total: totalCount, percent: 100 }, isNew };
      }
    }

    return {
      envelope: null,
      progress: { received: receivedCount, total: totalCount, percent },
      isNew,
    };
  }

  public purgeStaleSessions(maxAgeMs: number = 30000): void {
    const now = Date.now();
    for (const [id, s] of this.sessions.entries()) {
      if (now - s.lastSeen > maxAgeMs) {
        this.sessions.delete(id);
      }
    }
  }

  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }
}
