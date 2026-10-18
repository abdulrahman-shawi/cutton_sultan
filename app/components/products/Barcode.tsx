// components/products/Barcode.tsx
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

interface BarcodeProps {
  value: string;
  height?: number;
}

export default function Barcode({ value, height = 40 }: BarcodeProps) {
  if (!/^\d{13}$/.test(value)) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const bits = buildBits(value);
  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <div className="flex" style={{ height }} aria-hidden="true">
        {bits.split('').map((bit, index) => (
          <span
            key={index}
            style={{
              width: 2,
              height: '100%',
              backgroundColor: bit === '1' ? '#1e293b' : 'transparent',
            }}
          />
        ))}
      </div>
      <span className="text-[10px] tracking-[0.2em] text-slate-500" dir="ltr">
        {value}
      </span>
    </div>
  );
}
