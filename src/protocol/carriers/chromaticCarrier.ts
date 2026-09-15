/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Carrier: Chromatic Visual Pulse Carrier
 * High-speed visual state transitions using 8 distinct spectral bands
 */

export interface ChromaticColor {
  name: string;
  hex: string;
  r: number;
  g: number;
  b: number;
}

export const CHROMATIC_PALETTE: ChromaticColor[] = [
  { name: 'BLACK', hex: '#111827', r: 17, g: 24, b: 39 },    // 000
  { name: 'BLUE', hex: '#2563EB', r: 37, g: 99, b: 235 },    // 001
  { name: 'GREEN', hex: '#10B981', r: 16, g: 185, b: 129 }, // 010
  { name: 'CYAN', hex: '#06B6D4', r: 6, g: 182, b: 212 },   // 011
  { name: 'RED', hex: '#EF4444', r: 239, g: 68, b: 68 },    // 100
  { name: 'MAGENTA', hex: '#D946EF', r: 217, g: 70, b: 239 },// 101
  { name: 'YELLOW', hex: '#FACC15', r: 250, g: 204, b: 21 },// 110
  { name: 'WHITE', hex: '#F9FAFB', r: 249, g: 250, b: 251 }, // 111
];

/**
 * Render a chromatic frame onto canvas.
 * Consists of:
 * - Alignment synchronization borders (black/white alternating optical clock)
 * - 4x4 chromatic grid (16 cells x 3 bits = 48 bits = 6 bytes per pulse, or payload packet)
 */
export function renderChromaticFrame(
  canvas: HTMLCanvasElement,
  payloadText: string,
  clockPhase: boolean = false
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Outer bezel
  ctx.fillStyle = clockPhase ? '#000000' : '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  // Inner margin
  const margin = 20;
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(margin, margin, w - margin * 2, h - margin * 2);

  // Draw 4x4 chromatic blocks based on bytes of payload
  const gridSize = 4;
  const gridPadding = margin + 12;
  const cellW = (w - gridPadding * 2) / gridSize;
  const cellH = (h - gridPadding * 2) / gridSize;

  // Derive colors from payload string
  let byteIdx = 0;
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const charCode = payloadText.charCodeAt(byteIdx % (payloadText.length || 1)) || 42;
      const paletteIndex = (charCode + row * 3 + col * 7) % 8;
      const color = CHROMATIC_PALETTE[paletteIndex];

      ctx.fillStyle = color.hex;
      ctx.beginPath();
      ctx.roundRect(
        gridPadding + col * cellW + 2,
        gridPadding + row * cellH + 2,
        cellW - 4,
        cellH - 4,
        6
      );
      ctx.fill();

      // Small optical centroid dot for camera focus
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(
        gridPadding + col * cellW + cellW / 2,
        gridPadding + row * cellH + cellH / 2,
        3,
        0,
        Math.PI * 2
      );
      ctx.fill();

      byteIdx++;
    }
  }

  // Optical Clock Strobe Header (left and right corner squares)
  const strobeSize = 14;
  ctx.fillStyle = clockPhase ? '#10B981' : '#F59E0B';
  ctx.fillRect(margin + 4, margin + 4, strobeSize, strobeSize);
  ctx.fillRect(w - margin - strobeSize - 4, margin + 4, strobeSize, strobeSize);
  ctx.fillRect(margin + 4, h - margin - strobeSize - 4, strobeSize, strobeSize);
  ctx.fillRect(w - margin - strobeSize - 4, h - margin - strobeSize - 4, strobeSize, strobeSize);
}

/**
 * Decodes chromatic colors by sampling center regions of canvas image data
 */
export function sampleChromaticData(
  imageData: ImageData
): { dominantColor: ChromaticColor; confidence: number } | null {
  const { data, width, height } = imageData;
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let samples = 0;
  const sampleRadius = 15;

  for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
    for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
      const idx = ((centerY + dy) * width + (centerX + dx)) * 4;
      if (idx >= 0 && idx < data.length - 4) {
        totalR += data[idx];
        totalG += data[idx + 1];
        totalB += data[idx + 2];
        samples++;
      }
    }
  }

  if (samples === 0) return null;

  const avgR = totalR / samples;
  const avgG = totalG / samples;
  const avgB = totalB / samples;

  // Find closest chromatic palette color (Euclidean RGB distance)
  let closest: ChromaticColor = CHROMATIC_PALETTE[0];
  let minDistance = Infinity;

  for (const color of CHROMATIC_PALETTE) {
    const dr = color.r - avgR;
    const dg = color.g - avgG;
    const db = color.b - avgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < minDistance) {
      minDistance = dist;
      closest = color;
    }
  }

  const confidence = Math.max(0, 1 - minDistance / 255);
  return { dominantColor: closest, confidence };
}
