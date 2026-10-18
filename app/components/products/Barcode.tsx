// components/products/Barcode.tsx
import { useEffect, useRef } from 'react';

const L_PATTERNS: Record<string, string> = {
  '0': '0001101', '1': '0011001', '2': '0010011', '3': '0111101',
  '4': '0100011', '5': '0110001', '6': '0101111', '7': '0111011',
  '8': '0110111', '9': '0001011',
};

const PARITY_PATTERNS: Record<string, string> = {
  '0': 'LLLLLL', '1': 'LLGLGG', '2': 'LLGGLG', '3': 'LLGGGL',
  '4': 'LGLLGG', '5': 'LGGLLG', '6': 'LGGGLL', '7': 'LGLGLG',
  '8': 'LGLGGL', '9': 'LGGLGL',
};

function invert(bits: string): string {
  let result = '';
  for (let i = 0; i < bits.length; i++) {
    result += bits.charAt(i) === '0' ? '1' : '0';
  }
  return result;
}

function reverse(bits: string): string {
  let result = '';
  for (let i = bits.length - 1; i >= 0; i--) {
    result += bits.charAt(i);
  }
  return result;
}

const G_PATTERNS: Record<string, string> = {};
const R_PATTERNS: Record<string, string> = {};
for (const digit in L_PATTERNS) {
  G_PATTERNS[digit] = reverse(invert(L_PATTERNS[digit]));
  R_PATTERNS[digit] = invert(L_PATTERNS[digit]);
}

function buildBits(value: string): string {
  const firstDigit = value.charAt(0);
  const left = value.slice(1, 7);
  const right = value.slice(7, 13);
  const parity = PARITY_PATTERNS[firstDigit] ?? 'LLLLLL';
  let bits = '101';
  for (let i = 0; i < 6; i++) {
    bits += (parity.charAt(i) === 'L' ? L_PATTERNS : G_PATTERNS)[left.charAt(i)];
  }
  bits += '01010';
  for (let i = 0; i < 6; i++) {
    bits += R_PATTERNS[right.charAt(i)];
  }
  bits += '101';
  return bits;
}

const TOTAL_MODULES = 95;
const QUIET_MODULES = 11;

// رسم الباركود على Canvas — يعيد false إذا لم يكن الرقم بصيغة EAN-13
export function drawBarcode(canvas: HTMLCanvasElement, value: string, multiplier = 2): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  const bits = buildBits(value);
  const moduleSize = 2 * multiplier;
  const quietWidth = QUIET_MODULES * moduleSize;
  const width = quietWidth * 2 + TOTAL_MODULES * moduleSize;
  const barHeight = 60 * multiplier;
  const textHeight = 16 * multiplier;
  canvas.width = width;
  canvas.height = barHeight + textHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1e293b';
  for (let i = 0; i < bits.length; i++) {
    if (bits.charAt(i) === '1') {
      ctx.fillRect(quietWidth + i * moduleSize, 0, moduleSize, barHeight);
    }
  }

  const fontSize = 11 * multiplier;
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const textY = barHeight + 2 * multiplier;
  const leftGroupCenter = quietWidth + ((3 + 42) * moduleSize) / 2;
  const rightGroupCenter = quietWidth + 48 * moduleSize + ((42 + 3) * moduleSize) / 2;
  ctx.fillText(value.charAt(0), quietWidth - fontSize, textY);
  ctx.fillText(value.slice(1, 7), leftGroupCenter, textY);
  ctx.fillText(value.slice(7), rightGroupCenter, textY);
  return true;
}

// تنزيل الباركود كصورة PNG بجودة عالية مناسبة للطباعة
export function downloadBarcode(value: string, filename: string): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  if (!drawBarcode(canvas, value, 4)) return false;
  const link = document.createElement('a');
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

interface BarcodeProps {
  value: string;
  height?: number;
}

export default function Barcode({ value, height = 40 }: BarcodeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const valid = /^\d{13}$/.test(value);

  useEffect(() => {
    if (canvasRef.current && valid) {
      drawBarcode(canvasRef.current, value, 2);
    }
  }, [value, valid]);

  if (!valid) return <span className="text-xs text-slate-400">—</span>;

  return (
    <canvas
      ref={canvasRef}
      style={{ height, width: 'auto' }}
      aria-label={`باركود ${value}`}
    />
  );
}
