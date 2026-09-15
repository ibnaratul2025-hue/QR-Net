/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Checksums, Hashing, and Optical Verification Code Generation
 */

// Simple, fast, deterministic CRC32 table
const makeCrcTable = (): Uint32Array => {
  let c: number;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
};

const CRC_TABLE = makeCrcTable();

export function calculateCrc32(str: string): string {
  let crc = 0 ^ (-1);
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ str.charCodeAt(i)) & 0xFF];
  }
  return ((crc ^ (-1)) >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Computes SHA-256 hash using native Web Crypto API
 */
export async function calculateSha256(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback deterministic pseudo-sha for offline/mock cases
  return calculateCrc32(text) + calculateCrc32(text + '_SALT');
}

/**
 * Generates human-verifiable Short Authentication String (SAS) code
 * Format: "47-92-18"
 */
export function generateSasVerificationCode(seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  const positive = Math.abs(hash);
  const part1 = (positive % 90 + 10).toString();
  const part2 = ((positive >> 4) % 90 + 10).toString();
  const part3 = ((positive >> 8) % 90 + 10).toString();
  return `${part1}-${part2}-${part3}`;
}
