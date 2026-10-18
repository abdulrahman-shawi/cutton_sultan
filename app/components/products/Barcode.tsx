// components/products/Barcode.tsx — توليد الباركود عبر JsBarcode و QR عبر qrcode
import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { formatPrice } from './types';

// رسم الباركود على Canvas — EAN-13 مع بديل CODE128 إذا كان الرقم غير مطابق لصيغة EAN-13
export function drawBarcode(canvas: HTMLCanvasElement, value: string, multiplier = 2): boolean {
  const baseOptions = {
    width: 2 * multiplier,
    height: 60 * multiplier,
    margin: 0,
    fontSize: 11 * multiplier,
    textMargin: 2 * multiplier,
    lineColor: '#1e293b',
    background: '#ffffff',
    displayValue: true,
  };
  try {
    JsBarcode(canvas, value, { ...baseOptions, format: 'EAN13', flat: true });
    return true;
  } catch {
    try {
      JsBarcode(canvas, value, { ...baseOptions, format: 'CODE128' });
      return true;
    } catch {
      return false;
    }
  }
}

function makeQrImage(dataUrl: string | null): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export interface ProductLabelOptions {
  barcode: string;
  pieceName: string;
  priceSyp: number;
  pageUrl: string;
}

// تنزيل ملصق كامل: اسم القطعة + باركود + السعر بالسوري + QR لصفحة العملاء
export async function downloadProductLabel(
  options: ProductLabelOptions,
  filename: string
): Promise<void> {
  if (typeof document === 'undefined') return;
  const multiplier = 3;
  const barcodeCanvas = document.createElement('canvas');
  if (!drawBarcode(barcodeCanvas, options.barcode, multiplier)) return;

  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(options.pageUrl, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  } catch {
    qrDataUrl = null;
  }
  const qrImage = await makeQrImage(qrDataUrl);

  const qrSize = 170;
  const pad = 28;
  const nameHeight = 44;
  const priceHeight = 54;
  const width = pad + qrSize + 20 + barcodeCanvas.width + pad;
  const height = pad + nameHeight + barcodeCanvas.height + priceHeight + pad;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let fontSize = 26;
  ctx.font = `bold ${fontSize}px Arial`;
  while (ctx.measureText(options.pieceName).width > width - pad * 2 && fontSize > 14) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px Arial`;
  }
  ctx.fillStyle = '#0f172a';
  ctx.fillText(options.pieceName, width / 2, pad + nameHeight / 2);

  const barcodeX = width - pad - barcodeCanvas.width;
  const barcodeY = pad + nameHeight;
  ctx.drawImage(barcodeCanvas, barcodeX, barcodeY);

  ctx.font = 'bold 30px Arial';
  ctx.fillStyle = '#1d4ed8';
  ctx.fillText(
    `${formatPrice(options.priceSyp)} ل.س`,
    barcodeX + barcodeCanvas.width / 2,
    barcodeY + barcodeCanvas.height + priceHeight / 2 - 2
  );

  if (qrImage) {
    const qrX = pad;
    const qrY = barcodeY;
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    ctx.font = '12px Arial';
    ctx.fillStyle = '#64748b';
    ctx.fillText('امسح لعرض السعر', qrX + qrSize / 2, qrY + qrSize + 16);
  }

  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface BarcodeProps {
  value: string;
  height?: number;
}

export default function Barcode({ value, height = 40 }: BarcodeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      drawBarcode(canvasRef.current, value, 2);
    }
  }, [value]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height, width: 'auto' }}
      aria-label={`باركود ${value}`}
    />
  );
}
