/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QIP Carrier: QR Optical Physical Carrier
 */

import QRCode from 'qrcode';
import jsQR from 'jsqr';

export interface QrRenderOptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Encodes a string payload into a Canvas element via QR
 */
export async function renderQrToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options: QrRenderOptions = {}
): Promise<void> {
  const {
    width = 280,
    margin = 2,
    darkColor = '#000000',
    lightColor = '#ffffff',
    errorCorrectionLevel = 'M',
  } = options;

  await QRCode.toCanvas(canvas, text, {
    width,
    margin,
    color: {
      dark: darkColor,
      light: lightColor,
    },
    errorCorrectionLevel,
  });
}

/**
 * Scans an ImageData object from camera video capture for QR payload
 */
export function decodeQrFromImageData(
  imageData: ImageData
): { data: string; location: any } | null {
  try {
    // First attempt: standard non-inverted
    let code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (code && code.data) {
      return {
        data: code.data,
        location: code.location,
      };
    }
  } catch (err) {
    console.error('[QR Carrier] Decoding error', err);
  }
  return null;
}
