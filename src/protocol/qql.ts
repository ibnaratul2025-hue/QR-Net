/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QQL — QIP Query Language
 * Compiles optical queries into structured QIP messages
 */

import { QipMessageType, QipMessageEnvelope } from '../types/qip';
import { calculateCrc32 } from './crc';

export interface QqlParsedQuery {
  action: 'DISCOVER' | 'GET' | 'CALL' | 'SUBSCRIBE';
  target: string;
  field?: string;
  filter?: { key: string; operator: '=' | '!='; value: string };
  raw: string;
}

export function parseQql(queryString: string): QqlParsedQuery | null {
  const trimmed = queryString.trim();
  if (!trimmed) return null;

  // DISCOVER devices WHERE capability = "DISPLAY"
  const discoverMatch = trimmed.match(/^DISCOVER\s+devices(?:\s+WHERE\s+([a-zA-Z0-9_]+)\s*(=|!=)\s*["']?([^"']+)["']?)?$/i);
  if (discoverMatch) {
    const filter = discoverMatch[1] ? {
      key: discoverMatch[1],
      operator: discoverMatch[2] as '=' | '!=',
      value: discoverMatch[3],
    } : undefined;

    return {
      action: 'DISCOVER',
      target: 'devices',
      filter,
      raw: trimmed,
    };
  }

  // GET capability.camera or GET state.version
  const getMatch = trimmed.match(/^GET\s+([a-zA-Z0-9_]+)(?:\.([a-zA-Z0-9_]+))?$/i);
  if (getMatch) {
    return {
      action: 'GET',
      target: getMatch[1],
      field: getMatch[2],
      raw: trimmed,
    };
  }

  // SUBSCRIBE event.name
  const subMatch = trimmed.match(/^SUBSCRIBE\s+([a-zA-Z0-9_.]+)$/i);
  if (subMatch) {
    return {
      action: 'SUBSCRIBE',
      target: subMatch[1],
      raw: trimmed,
    };
  }

  // CALL capability.operation
  const callMatch = trimmed.match(/^CALL\s+([a-zA-Z0-9_.]+)(?:\((.*)\))?$/i);
  if (callMatch) {
    return {
      action: 'CALL',
      target: callMatch[1],
      field: callMatch[2],
      raw: trimmed,
    };
  }

  return null;
}

export function compileQqlToMessage(
  query: QqlParsedQuery,
  sourceNodeId: string,
  targetNodeId: string = 'BROADCAST'
): QipMessageEnvelope {
  const msgId = 'msg_' + Math.random().toString(36).substring(2, 9);
  const payload = {
    qqlQuery: query.raw,
    action: query.action,
    target: query.target,
    field: query.field,
    filter: query.filter,
  };
  const payloadStr = JSON.stringify(payload);

  return {
    protocol: 'QIP/1.0',
    msgId,
    source: sourceNodeId,
    destination: targetNodeId,
    ttl: 3,
    hopCount: 0,
    type: query.action === 'CALL' ? QipMessageType.COMMAND : QipMessageType.QUERY,
    timestamp: Date.now(),
    payload,
    checksum: calculateCrc32(payloadStr),
  };
}
