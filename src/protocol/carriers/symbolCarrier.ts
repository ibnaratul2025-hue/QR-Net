/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Carrier: Symbol Matrix Carrier
 * High-contrast binary optical symbol patterns for extreme low-light or projector conditions
 */

export function renderSymbolMatrix(
  canvas: HTMLCanvasElement,
  payloadText: string,
  clockPhase: boolean = false
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const padding = 16;
  const matrixSize = 8; // 8x8 matrix
  const cellSize = (w - padding * 2) / matrixSize;

  // Background
  ctx.fillStyle = '#090D16';
  ctx.fillRect(0, 0, w, h);

  // Outer border with optical sync
  ctx.strokeStyle = clockPhase ? '#38BDF8' : '#64748B';
  ctx.lineWidth = 4;
  ctx.strokeRect(padding / 2, padding / 2, w - padding, h - padding);

  // Draw 8x8 cells
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      // Corner fiducials (top-left, top-right, bottom-left)
      const isFiducial =
        (r < 2 && c < 2) ||
        (r < 2 && c >= matrixSize - 2) ||
        (r >= matrixSize - 2 && c < 2);

      const x = padding + c * cellSize;
      const y = padding + r * cellSize;

      if (isFiducial) {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
      } else {
        // Derive bit from string char
        const charIdx = (r * matrixSize + c) % (payloadText.length || 1);
        const code = payloadText.charCodeAt(charIdx) || 0;
        const bit = ((code >> ((r + c) % 8)) & 1) === 1;

        ctx.fillStyle = bit ? '#F8FAFC' : '#1E293B';
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, cellSize - 4, cellSize - 4, 3);
        ctx.fill();
      }
    }
  }

  // Draw central clock crosshair
  ctx.fillStyle = clockPhase ? '#EF4444' : '#10B981';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 6, 0, Math.PI * 2);
  ctx.fill();
}
