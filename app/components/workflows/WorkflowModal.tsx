// components/workflows/WorkflowModal.tsx — محرر سير العمل بنمط العقد (مثل n8n):
// لوحة مرسومة بعقد قابلة للسحب (محفّز + أنواع العقد التسعة)، روابط بصرية بينها،
// لوحة خصائص جانبية لكل عقدة، وحفظ يتحقق من اكتمال الحقول
import { useLayoutEffect, useRef, useState } from 'react';
import {
  AlertCircle, Bell, Bot, Clock, CreditCard, Image as ImageIcon, MapPin, MessageSquare,
  Plus, Repeat, Trash2, UserCheck, Workflow as WorkflowIcon, X, Zap,
} from 'lucide-react';
import {
  NODE_KINDS, migrateWorkflow, nodeKindColor, nodeKindLabel,
  type Workflow, type WorkflowNode, type WorkflowNodeKind, type WorkflowTrigger,
} from './types';
import { loadAgents } from '../../lib/agentClient';
import { loadData } from '../../lib/data';
import type { User } from '../auth/auth';

interface WorkflowModalProps {
  initial: Workflow | null; // null = سير جديد
  onClose: () => void;
  onSave: (
    data: { name: string; enabled: boolean; trigger: WorkflowTrigger; triggerNextId: string | null; nodes: WorkflowNode[] },
    id: string | null
  ) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

type TriggerKind = WorkflowTrigger['kind'];

const TRIGGER_OPTIONS: { value: TriggerKind; label: string; hint: string }[] = [
  { value: 'message', label: 'رسالة تتضمن كلمة', hint: 'عند وصول رسالة من العميل تحوي الكلمة المفتاحية' },
  { value: 'new_customer', label: 'عميل جديد', hint: 'عند أول رسالة يفتح بها عميل محادثة جديدة مع المتجر' },
  { value: 'no_reply', label: 'عدم ردّ المحل', hint: 'عندما تمرّ دقائق بلا ردّ على آخر رسالة للعميل' },
  { value: 'inactive', label: 'انتهاء المحادثة', hint: 'عندما لا يتحدث العميل منذ عدد ساعات محدد' },
  { value: 'manual', label: 'تشغيل يدوي', hint: 'يُشغَّل فقط بزر «تشغيل»' },
];

const KIND_ICONS: Record<WorkflowNodeKind, typeof MessageSquare> = {
  reply: MessageSquare,
  image: ImageIcon,
  location: MapPin,
  set_agent: Bot,
  assign: UserCheck,
  order: CreditCard,
  wait: Clock,
  if: Bell,
  goto: Repeat,
};

const NODE_W = 220;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function createNode(kind: WorkflowNodeKind, position: { x: number; y: number }): WorkflowNode {
  return {
    id: crypto.randomUUID(),
    kind,
    position,
    nextId: null,
    text: kind === 'reply' ? '' : undefined,
    url: kind === 'image' ? '' : undefined,
    lat: kind === 'location' ? undefined : undefined,
    lng: kind === 'location' ? undefined : undefined,
    label: kind === 'location' || kind === 'image' ? '' : undefined,
    agentId: kind === 'set_agent' ? '' : undefined,
    agentName: kind === 'set_agent' ? '' : undefined,
    userId: kind === 'assign' ? '' : undefined,
    userName: kind === 'assign' ? '' : undefined,
    items: kind === 'order' ? [{ name: '', quantity: 1, price: 0, currency: 'SYP' }] : undefined,
    paid: kind === 'order' ? false : undefined,
    minutes: kind === 'wait' ? 30 : undefined,
    conditionKeyword: kind === 'if' ? '' : undefined,
    conditionNegate: kind === 'if' ? false : undefined,
    ifTrueId: kind === 'if' ? null : undefined,
    ifFalseId: kind === 'if' ? null : undefined,
    targetId: kind === 'goto' ? null : undefined,
  };
}

function nodeSummary(node: WorkflowNode): string {
  switch (node.kind) {
    case 'reply':
      return node.text?.trim() || 'بدون نص...';
    case 'image':
      return node.url?.trim() || 'بدون رابط صورة...';
    case 'location':
      return node.label?.trim() || `(${node.lat ?? '…'}, ${node.lng ?? '…'})`;
    case 'set_agent':
      return `الوكيل: ${node.agentName || '—'}`;
    case 'assign':
      return `الموظف: ${node.userName || '—'}`;
    case 'order':
      return `${node.items?.length ?? 0} صنف — ${node.paid ? 'كاش' : 'ذمة'}`;
    case 'wait':
      return `${node.minutes ?? '…'} دقيقة`;
    case 'if':
      return `آخر رسالة ${node.conditionNegate ? 'لا ' : ''}تحوي «${node.conditionKeyword || '…'}»`;
    case 'goto':
      return 'انتقال لعقدة محددة';
  }
}

export default function WorkflowModal({ initial, onClose, onSave }: WorkflowModalProps) {
  const migrated = initial ? migrateWorkflow(initial) : null;
  const [name, setName] = useState(migrated?.name ?? '');
  const [enabled, setEnabled] = useState(migrated?.enabled ?? true);
  const [triggerKind, setTriggerKind] = useState<TriggerKind>(migrated?.trigger.kind ?? 'message');
  const [keywords, setKeywords] = useState<string[]>(
    migrated?.trigger.kind === 'message' ? (migrated.trigger.keywords ?? []) : []
  );
  const [keywordDraft, setKeywordDraft] = useState('');
  const [matchStart, setMatchStart] = useState(migrated?.trigger.kind === 'message' ? migrated.trigger.matchStart === true : false);
  const [minutes, setMinutes] = useState(migrated?.trigger.kind === 'no_reply' ? String(migrated.trigger.minutes) : '30');
  const [hours, setHours] = useState(migrated?.trigger.kind === 'inactive' ? String(migrated.trigger.hours) : '24');
  const [nodes, setNodes] = useState<WorkflowNode[]>(migrated?.nodes ?? []);
  const [triggerNextId, setTriggerNextId] = useState<string | null>(migrated?.triggerNextId ?? null);
  const [selected, setSelected] = useState<string | 'trigger' | null>(nodes[0]?.id ?? 'trigger');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [portMenuFor, setPortMenuFor] = useState<string | null>(null); // العقدة التي فُتح قائمة أنواع العقد عند مخرجها
  const [error, setError] = useState('');

  const agents = useRef(loadAgents()).current;
  const users = useRef((loadData<User[]>('sultan_users') ?? []).map((user) => ({ id: user.id, name: user.name }))).current;

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [rects, setRects] = useState<Record<string, Rect>>({});

  // قياس مواضع العقد لرسم الروابط بينها
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const next: Record<string, Rect> = {};
    canvas.querySelectorAll<HTMLElement>('[data-node-id]').forEach((element) => {
      const id = element.dataset.nodeId;
      if (id) next[id] = { x: element.offsetLeft, y: element.offsetTop, w: element.offsetWidth, h: element.offsetHeight };
    });
    setRects((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [nodes, selected]);

  const canvasHeight = Math.max(560, ...Object.values(rects).map((rect) => rect.y + rect.h + 120));

  const updateNode = (id: string, patch: Partial<WorkflowNode>) => {
    setNodes((prev) => prev.map((node) => (node.id === id ? { ...node, ...patch } : node)));
  };

  const addKeyword = () => {
    const word = keywordDraft.trim();
    if (!word) return;
    setKeywords((prev) => (prev.includes(word) ? prev : [...prev, word]));
    setKeywordDraft('');
  };

  const addNode = (kind: WorkflowNodeKind, connectFrom?: string) => {
    setPaletteOpen(false);
    setPortMenuFor(null);
    let position = { x: 240 + (nodes.length % 3) * 40, y: 40 };
    const source = connectFrom ? nodes.find((node) => node.id === connectFrom) : undefined;
    if (source) {
      // العقدة الجديدة تُوضع أسفل مصدرها وتُربط به مباشرة
      position = { x: source.position.x, y: source.position.y + 160 };
    } else {
      const maxBottom = nodes.reduce((max, node) => Math.max(max, node.position.y + 130), 40);
      position = { x: 240 + (nodes.length % 3) * 40, y: maxBottom + 40 };
    }
    const node = createNode(kind, position);
    setNodes((prev) => {
      let next = [...prev, node];
      if (connectFrom === 'trigger') {
        setTriggerNextId(node.id);
      } else if (connectFrom) {
        next = next.map((item) =>
          item.id === connectFrom
            ? item.kind === 'if'
              ? { ...item, ifTrueId: node.id }
              : { ...item, nextId: node.id }
            : item
        );
      }
      return next;
    });
    setSelected(node.id);
  };

  const removeNode = (id: string) => {
    setNodes((prev) =>
      prev
        .filter((node) => node.id !== id)
        .map((node) => ({
          ...node,
          nextId: node.nextId === id ? null : node.nextId,
          ifTrueId: node.ifTrueId === id ? null : node.ifTrueId,
          ifFalseId: node.ifFalseId === id ? null : node.ifFalseId,
          targetId: node.targetId === id ? null : node.targetId,
        }))
    );
    setTriggerNextId((prev) => (prev === id ? null : prev));
    setSelected('trigger');
  };

  const startDrag = (event: React.PointerEvent, id: string) => {
    const element = (event.currentTarget as HTMLElement).closest('[data-node-id]') as HTMLElement | null;
    const canvas = canvasRef.current;
    if (!element || !canvas) return;
    event.preventDefault();
    dragRef.current = { id, offsetX: event.clientX - element.getBoundingClientRect().left, offsetY: event.clientY - element.getBoundingClientRect().top };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onDragMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const x = Math.max(8, event.clientX - bounds.left - drag.offsetX);
    const y = Math.max(8, event.clientY - bounds.top - drag.offsetY);
    updateNode(drag.id, { position: { x, y } });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  // جمع الروابط لرسمها: من عقدة إلى عقدة (التالي / فروع الشرط / الانتقال)
  const edges: { from: string; to: string | null; branch?: 'true' | 'false' }[] = [
    { from: 'trigger', to: triggerNextId },
    ...nodes.flatMap((node) => {
      if (node.kind === 'if') {
        return [
          { from: node.id, to: node.ifTrueId ?? null, branch: 'true' as const },
          { from: node.id, to: node.ifFalseId ?? null, branch: 'false' as const },
        ];
      }
      if (node.kind === 'goto') return [{ from: node.id, to: node.targetId ?? null }];
      return [{ from: node.id, to: node.nextId ?? null }];
    }),
  ];

  const nodeOptions = (excludeId: string) =>
    nodes.filter((node) => node.id !== excludeId).map((node) => ({ id: node.id, label: nodeKindLabel(node.kind) }));

  const validateNode = (node: WorkflowNode, index: number): string | null => {
    const where = `العقدة ${index + 1} (${nodeKindLabel(node.kind)})`;
    switch (node.kind) {
      case 'reply':
        return node.text?.trim() ? null : `${where}: أدخل نص الرسالة`;
      case 'image':
        return node.url?.trim() ? null : `${where}: أدخل رابط الصورة`;
      case 'location':
        return Number.isFinite(node.lat) && Number.isFinite(node.lng) ? null : `${where}: أدخط إحداثيات الموقع`;
      case 'set_agent':
        return node.agentId ? null : `${where}: اختر الوكيل`;
      case 'assign':
        return node.userId ? null : `${where}: اختر الموظف`;
      case 'order': {
        const items = node.items ?? [];
        if (items.length === 0) return `${where}: أضف صنفاً واحداً على الأقل`;
        return items.every((item) => item.name.trim() && item.quantity >= 1 && item.price >= 0) ? null : `${where}: أكمل بيانات الأصناف`;
      }
      case 'wait':
        return Number(node.minutes) >= 1 ? null : `${where}: أدخل مدة الانتظار بالدقائق`;
      case 'if':
        return node.conditionKeyword?.trim() ? null : `${where}: أدخل كلمة الشرط`;
      case 'goto':
        return node.targetId ? null : `${where}: اختر العقدة المقصودة`;
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return setError('أدخل اسماً لسير العمل');
    if (nodes.length === 0) return setError('أضف عقدة واحدة على الأقل من قائمة «+ إضافة عقدة»');
    let trigger: WorkflowTrigger;
    if (triggerKind === 'message') {
      const cleaned = keywords.map((item) => item.trim()).filter(Boolean);
      if (cleaned.length === 0) return setError('أضف كلمة مفتاحية واحدة على الأقل للمحفّز (اكتب الكلمة واضغط Enter)');
      trigger = { kind: 'message', keywords: cleaned, matchStart };
    } else if (triggerKind === 'new_customer') {
      trigger = { kind: 'new_customer' };
    } else if (triggerKind === 'no_reply') {
      const value = Math.floor(Number(minutes));
      if (!Number.isFinite(value) || value < 1) return setError('أدخل عدد دقائق صحيحاً للمحفّز');
      trigger = { kind: 'no_reply', minutes: value };
    } else if (triggerKind === 'inactive') {
      const value = Math.floor(Number(hours));
      if (!Number.isFinite(value) || value < 1) return setError('أدخل عدد ساعات صحيحاً للمحفّز');
      trigger = { kind: 'inactive', hours: value };
    } else {
      trigger = { kind: 'manual' };
    }
    for (let i = 0; i < nodes.length; i++) {
      const problem = validateNode(nodes[i], i);
      if (problem) return setError(problem);
    }
    onSave(
      {
        name: name.trim(),
        enabled,
        trigger,
        triggerNextId,
        nodes: nodes.map((node) => ({
          ...node,
          text: node.text?.trim(),
          url: node.url?.trim(),
          label: node.label?.trim(),
        })),
      },
      migrated?.id ?? null
    );
  };

  const selectedNode = selected && selected !== 'trigger' ? nodes.find((node) => node.id === selected) ?? null : null;

  const renderNodeCard = (id: string, kind: WorkflowNodeKind | 'trigger', title: string, summary: string, colorClass: string, icon: typeof Zap) => {
    const node = kind === 'trigger' ? null : nodes.find((item) => item.id === id);
    const position = kind === 'trigger' ? { x: 40, y: 40 } : (node?.position ?? { x: 40, y: 40 });
    const Icon = icon;
    const isSelected = selected === id;
    // نقطة الدخول أعلى العقدة تستقبل وصلة العقدة السابقة
    const hasInput = kind === 'trigger' ? true : node?.kind !== 'goto';
    // مخرج + أسفل العقدة: يضيف عقدة جديدة موصولة تلقائياً (للأنواع ذات «التالي»، و«نعم» للشرطية)
    const hasPort = kind === 'trigger' ? true : node?.kind === 'if' || (node != null && node.kind !== 'goto');
    return (
      <div
        key={id}
        data-node-id={id}
        className={`absolute w-[220px] rounded-2xl border-2 bg-white shadow-sm select-none transition-colors ${isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}
        style={{ left: position.x, top: position.y }}
      >
        {hasInput && (
          <span
            title="نقطة الربط — تصل هنا وصلة العقدة السابقة"
            className="absolute -top-1.5 right-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-slate-400 border-2 border-white shadow z-10 pointer-events-none"
          />
        )}
        <div
          className={`flex items-center gap-2 px-3 py-2.5 rounded-t-xl text-white cursor-grab active:cursor-grabbing ${colorClass}`}
          onPointerDown={(event) => startDrag(event, id)}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
        >
          <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold truncate">{title}</span>
          {kind !== 'trigger' && (
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => removeNode(id)}
              aria-label="حذف العقدة"
              className="mr-auto p-1 rounded text-white/70 hover:text-white hover:bg-white/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSelected(id)}
          onPointerDown={(event) => event.stopPropagation()}
          className="w-full text-right px-3 py-2.5"
        >
          <p className={`text-[11px] leading-relaxed line-clamp-2 ${summary ? 'text-slate-500' : 'text-slate-300 italic'}`}>{summary || 'اضغط لتحرير الخصائص...'}</p>
        </button>
        {hasPort && (
          <div className="relative">
            <button
              type="button"
              title="إضافة عقدة موصولة هنا"
              aria-label="إضافة عقدة موصولة"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setPortMenuFor((prev) => (prev === id ? null : id))}
              className="absolute -bottom-3 right-1/2 translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-slate-300 grid place-items-center text-slate-400 hover:border-blue-500 hover:text-blue-600 transition-colors z-10 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            {portMenuFor === id && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setPortMenuFor(null)} />
                <div className="absolute z-30 top-full right-1/2 translate-x-1/2 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 w-52 max-h-72 overflow-y-auto">
                  {NODE_KINDS.map((entry) => {
                    const KindIcon = KIND_ICONS[entry.value];
                    return (
                      <button
                        key={entry.value}
                        type="button"
                        onClick={() => addNode(entry.value, id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <span className={`w-7 h-7 rounded-lg grid place-items-center text-white ${entry.color}`}>
                          <KindIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        </span>
                        {entry.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const nextSelect = (
    id: string,
    value: string | null,
    onChange: (next: string | null) => void,
    label = 'الخطوة التالية',
    options?: { id: string; label: string }[]
  ) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className={`${inputClass} bg-white cursor-pointer`}
      >
        <option value="">— نهاية السير —</option>
        {(options ?? nodeOptions(id)).map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const itemField = (node: WorkflowNode, index: number, field: 'name' | 'quantity' | 'price' | 'currency', value: string | number) => {
    const items = [...(node.items ?? [])];
    if (field === 'currency') items[index] = { ...items[index], currency: value as 'SYP' | 'USD' };
    else if (field === 'quantity' || field === 'price') items[index] = { ...items[index], [field]: Number(value) || 0 };
    else items[index] = { ...items[index], [field]: String(value) };
    updateNode(node.id, { items });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-6xl max-h-[94vh] overflow-hidden bg-white rounded-2xl shadow-xl flex flex-col">
        {/* الشريط العلوي */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 flex-wrap">
          <WorkflowIcon className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="اسم سير العمل..."
            className="flex-1 min-w-[150px] rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-[11px] text-slate-400 hidden sm:block">اسحب العقد من ترويساتها لتحريكها</span>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            مفعّل
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="تفعيل سير العمل"
              onClick={() => setEnabled((prev) => !prev)}
              className={`w-10 h-6 rounded-full transition-colors relative ${enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${enabled ? 'right-0.5' : 'right-[22px]'}`} />
            </button>
          </label>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 flex min-h-0 flex-col lg:flex-row">
          {/* لوحة الرسم */}
          <div className="flex-1 overflow-auto bg-slate-50/70 relative"
            style={{ backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '18px 18px' }}
          >
            <div ref={canvasRef} className="relative min-w-[760px]" style={{ height: canvasHeight }}>
              {/* روابط SVG */}
              <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
                {edges.map((edge, index) => {
                  if (!edge.to || !rects[edge.from] || !rects[edge.to]) return null;
                  const from = rects[edge.from];
                  const to = rects[edge.to];
                  const sx = from.x + from.w / 2;
                  const sy = from.y + from.h;
                  const tx = to.x + to.w / 2;
                  const ty = to.y;
                  const curve = Math.max(36, Math.abs(ty - sy) / 2);
                  const branchColor = edge.branch === 'true' ? '#10b981' : edge.branch === 'false' ? '#f43f5e' : '#94a3b8';
                  return (
                    <g key={index}>
                      <path
                        d={`M ${sx} ${sy} C ${sx} ${sy + curve}, ${tx} ${ty - curve}, ${tx} ${ty}`}
                        fill="none"
                        stroke={branchColor}
                        strokeWidth="2"
                        strokeDasharray={edge.branch === 'false' ? '5 4' : undefined}
                        markerEnd={`url(#arrow-${index})`}
                      />
                      <defs>
                        <marker id={`arrow-${index}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                          <path d="M0,0 L8,4 L0,8 z" fill={branchColor} />
                        </marker>
                      </defs>
                      {edge.branch && (
                        <text x={(sx + tx) / 2 + 8} y={(sy + ty) / 2} fontSize="10" fill={branchColor} fontWeight="bold">
                          {edge.branch === 'true' ? 'نعم' : 'لا'}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* عقدة المحفّز */}
              {renderNodeCard(
                'trigger',
                'trigger',
                'المحفّز',
                triggerKind === 'message'
                  ? `${TRIGGER_OPTIONS[0].label}${matchStart ? ' — أول الكلام' : ''}: ${keywords.length > 0 ? keywords.slice(0, 3).join('، ') : 'بدون كلمات'}`
                  : (TRIGGER_OPTIONS.find((option) => option.value === triggerKind)?.label ?? ''),
                'bg-emerald-500',
                Zap
              )}

              {/* العقد */}
              {nodes.map((node) =>
                renderNodeCard(node.id, node.kind, nodeKindLabel(node.kind), nodeSummary(node), nodeKindColor(node.kind), KIND_ICONS[node.kind])
              )}

              {/* لوحة إضافة عقدة */}
              <div className="absolute bottom-4 right-4">
                {paletteOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setPaletteOpen(false)} />
                    <div className="absolute z-20 bottom-full right-0 mb-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 w-52 max-h-80 overflow-y-auto">
                      {NODE_KINDS.map((kind) => {
                        const Icon = KIND_ICONS[kind.value];
                        return (
                          <button
                            key={kind.value}
                            type="button"
                            onClick={() => addNode(kind.value)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <span className={`w-7 h-7 rounded-lg grid place-items-center text-white ${kind.color}`}>
                              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                            </span>
                            {kind.label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setPaletteOpen((prev) => !prev)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg transition-colors"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  إضافة عقدة
                </button>
              </div>
            </div>
          </div>

          {/* لوحة الخصائص */}
          <div className="lg:w-80 border-t lg:border-t-0 lg:border-r border-slate-100 bg-white overflow-y-auto max-h-[300px] lg:max-h-none">
            {selected === 'trigger' ? (
              <div className="p-4 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  خصائص المحفّز
                </h3>
                <div>
                  <label htmlFor="prop-trigger" className="block text-xs font-medium text-slate-600 mb-1.5">نوع المحفّز</label>
                  <select id="prop-trigger" value={triggerKind} onChange={(event) => setTriggerKind(event.target.value as TriggerKind)} className={`${inputClass} bg-white cursor-pointer`}>
                    {TRIGGER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    {TRIGGER_OPTIONS.find((option) => option.value === triggerKind)?.hint}
                  </p>
                </div>
                {triggerKind === 'message' && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="prop-keyword" className="block text-xs font-medium text-slate-600 mb-1">
                        الكلمات المفتاحية — اكتب الكلمة واضغط Enter لتُضاف
                      </label>
                      <div className="rounded-lg border border-slate-300 px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                        <div className="flex flex-wrap gap-1.5">
                          {keywords.map((word) => (
                            <span key={word} className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2.5 py-1 text-xs font-medium">
                              {word}
                              <button
                                type="button"
                                onClick={() => setKeywords((prev) => prev.filter((item) => item !== word))}
                                aria-label={`حذف ${word}`}
                                className="text-blue-400 hover:text-blue-700 transition-colors"
                              >
                                <X className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </span>
                          ))}
                          <input
                            id="prop-keyword"
                            type="text"
                            value={keywordDraft}
                            onChange={(event) => setKeywordDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                addKeyword();
                              } else if (event.key === 'Backspace' && !keywordDraft && keywords.length > 0) {
                                setKeywords((prev) => prev.slice(0, -1));
                              }
                            }}
                            placeholder={keywords.length === 0 ? 'مثال: سعر' : 'أضف كلمة أخرى...'}
                            className="flex-1 min-w-[90px] border-0 outline-none px-1 py-1 text-sm placeholder:text-slate-400"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-slate-600 mb-1.5">موضع الكلمة في رسالة العميل</span>
                      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setMatchStart(false)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${!matchStart ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          في أي مكان
                        </button>
                        <button
                          type="button"
                          onClick={() => setMatchStart(true)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${matchStart ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          أول الكلام
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {triggerKind === 'no_reply' && (
                  <div>
                    <label htmlFor="prop-minutes" className="block text-xs font-medium text-slate-600 mb-1">المهلة (دقائق)</label>
                    <input id="prop-minutes" type="number" min="1" step="1" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} className={`${inputClass} text-center`} />
                  </div>
                )}
                {triggerKind === 'inactive' && (
                  <div>
                    <label htmlFor="prop-hours" className="block text-xs font-medium text-slate-600 mb-1">الساعات</label>
                    <input id="prop-hours" type="number" min="1" step="1" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} className={`${inputClass} text-center`} />
                  </div>
                )}
                {nextSelect('trigger', triggerNextId, setTriggerNextId)}
              </div>
            ) : selectedNode ? (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-lg grid place-items-center text-white ${nodeKindColor(selectedNode.kind)}`}>
                      {(() => {
                        const Icon = KIND_ICONS[selectedNode.kind];
                        return <Icon className="w-3.5 h-3.5" aria-hidden="true" />;
                      })()}
                    </span>
                    {nodeKindLabel(selectedNode.kind)}
                  </h3>
                  <button type="button" onClick={() => removeNode(selectedNode.id)} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                    حذف
                  </button>
                </div>

                {selectedNode.kind === 'reply' && (
                  <div>
                    <label htmlFor="prop-text" className="block text-xs font-medium text-slate-600 mb-1">نص الرسالة</label>
                    <textarea id="prop-text" rows={4} value={selectedNode.text ?? ''} onChange={(event) => updateNode(selectedNode.id, { text: event.target.value })} placeholder="أهلاً {اسم_العميل}..." className={`${inputClass} resize-none text-xs leading-relaxed`} />
                    <p className="text-[11px] text-slate-400 mt-1">يدعم {'{اسم_العميل}'}</p>
                  </div>
                )}

                {selectedNode.kind === 'image' && (
                  <>
                    <div>
                      <label htmlFor="prop-url" className="block text-xs font-medium text-slate-600 mb-1">رابط الصورة</label>
                      <input id="prop-url" type="text" dir="ltr" value={selectedNode.url ?? ''} onChange={(event) => updateNode(selectedNode.id, { url: event.target.value })} placeholder="https://..." className={`${inputClass} text-left`} />
                    </div>
                    <div>
                      <label htmlFor="prop-img-label" className="block text-xs font-medium text-slate-600 mb-1">تعليق مختصر (اختياري)</label>
                      <input id="prop-img-label" type="text" value={selectedNode.label ?? ''} onChange={(event) => updateNode(selectedNode.id, { label: event.target.value })} placeholder="مثال: وصلنا الجديد" className={inputClass} />
                    </div>
                  </>
                )}

                {selectedNode.kind === 'location' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="prop-lat" className="block text-xs font-medium text-slate-600 mb-1">خط العرض</label>
                        <input id="prop-lat" type="number" step="any" dir="ltr" value={selectedNode.lat ?? ''} onChange={(event) => updateNode(selectedNode.id, { lat: Number(event.target.value) })} className={`${inputClass} text-center`} />
                      </div>
                      <div>
                        <label htmlFor="prop-lng" className="block text-xs font-medium text-slate-600 mb-1">خط الطول</label>
                        <input id="prop-lng" type="number" step="any" dir="ltr" value={selectedNode.lng ?? ''} onChange={(event) => updateNode(selectedNode.id, { lng: Number(event.target.value) })} className={`${inputClass} text-center`} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="prop-loc-label" className="block text-xs font-medium text-slate-600 mb-1">اسم الموقع</label>
                      <input id="prop-loc-label" type="text" value={selectedNode.label ?? ''} onChange={(event) => updateNode(selectedNode.id, { label: event.target.value })} placeholder="فرع المدينة" className={inputClass} />
                    </div>
                  </>
                )}

                {selectedNode.kind === 'set_agent' && (
                  <div>
                    <label htmlFor="prop-agent" className="block text-xs font-medium text-slate-600 mb-1">الوكيل المعيَّن لهذه المحادثة</label>
                    <select
                      id="prop-agent"
                      value={selectedNode.agentId ?? ''}
                      onChange={(event) => {
                        const agent = agents.find((item) => item.id === event.target.value);
                        updateNode(selectedNode.id, { agentId: agent?.id ?? '', agentName: agent?.name ?? '' });
                      }}
                      className={`${inputClass} bg-white cursor-pointer`}
                    >
                      <option value="">اختر وكيلاً...</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.name}{agent.isDefault ? ' (افتراضي)' : ''}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1.5">سيخدم هذه المحادثة بدل الوكيل الافتراضي.</p>
                  </div>
                )}

                {selectedNode.kind === 'assign' && (
                  <div>
                    <label htmlFor="prop-user" className="block text-xs font-medium text-slate-600 mb-1">الموظف المسؤول</label>
                    <select
                      id="prop-user"
                      value={selectedNode.userId ?? ''}
                      onChange={(event) => {
                        const user = users.find((item) => item.id === event.target.value);
                        updateNode(selectedNode.id, { userId: user?.id ?? '', userName: user?.name ?? '' });
                      }}
                      className={`${inputClass} bg-white cursor-pointer`}
                    >
                      <option value="">اختر موظفاً...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedNode.kind === 'order' && (
                  <>
                    <div>
                      <span className="block text-xs font-medium text-slate-600 mb-1.5">أصناف الفاتورة</span>
                      <ul className="space-y-2">
                        {(selectedNode.items ?? []).map((item, index) => (
                          <li key={index} className="rounded-xl border border-slate-200 p-2 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <input type="text" value={item.name} onChange={(event) => itemField(selectedNode, index, 'name', event.target.value)} placeholder="اسم الصنف" className={`${inputClass} text-xs`} />
                              <button
                                type="button"
                                onClick={() => {
                                  const items = (selectedNode.items ?? []).filter((_, i) => i !== index);
                                  updateNode(selectedNode.id, { items });
                                }}
                                aria-label="حذف الصنف"
                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              <input type="number" min="1" step="1" value={item.quantity} onChange={(event) => itemField(selectedNode, index, 'quantity', event.target.value)} title="الكمية" className={`${inputClass} text-center text-xs px-1`} />
                              <input type="number" min="0" step="any" value={item.price} onChange={(event) => itemField(selectedNode, index, 'price', event.target.value)} title="السعر" className={`${inputClass} text-center text-xs px-1`} />
                              <select value={item.currency} onChange={(event) => itemField(selectedNode, index, 'currency', event.target.value)} className={`${inputClass} bg-white text-xs px-1 cursor-pointer`}>
                                <option value="SYP">ل.س</option>
                                <option value="USD">$</option>
                              </select>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => updateNode(selectedNode.id, { items: [...(selectedNode.items ?? []), { name: '', quantity: 1, price: 0, currency: 'SYP' }] })}
                        className="mt-2 w-full py-1.5 rounded-lg border border-dashed border-emerald-300 text-emerald-600 text-xs font-medium hover:bg-emerald-50 transition-colors"
                      >
                        + إضافة صنف
                      </button>
                    </div>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 cursor-pointer">
                      <span className="text-xs font-medium text-slate-700">الفاتورة مدفوعة (كاش)</span>
                      <input type="checkbox" checked={selectedNode.paid ?? false} onChange={(event) => updateNode(selectedNode.id, { paid: event.target.checked })} className="w-4 h-4 accent-emerald-600" />
                    </label>
                  </>
                )}

                {selectedNode.kind === 'wait' && (
                  <div>
                    <label htmlFor="prop-wait" className="block text-xs font-medium text-slate-600 mb-1">مدة الانتظار (دقائق)</label>
                    <input id="prop-wait" type="number" min="1" step="1" value={selectedNode.minutes ?? ''} onChange={(event) => updateNode(selectedNode.id, { minutes: Math.max(1, Math.floor(Number(event.target.value)) || 1) })} className={`${inputClass} text-center`} />
                    <p className="text-[11px] text-slate-400 mt-1.5">يتوقف السير هنا ويستأنف تلقائياً من العقدة التالية بعد المدة.</p>
                  </div>
                )}

                {selectedNode.kind === 'if' && (
                  <>
                    <div>
                      <label htmlFor="prop-if-keyword" className="block text-xs font-medium text-slate-600 mb-1">الشرط: آخر رسالة للعميل تحوي</label>
                      <input id="prop-if-keyword" type="text" value={selectedNode.conditionKeyword ?? ''} onChange={(event) => updateNode(selectedNode.id, { conditionKeyword: event.target.value })} placeholder="مثال: نعم" className={inputClass} />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={selectedNode.conditionNegate ?? false} onChange={(event) => updateNode(selectedNode.id, { conditionNegate: event.target.checked })} className="w-4 h-4 accent-amber-500" />
                      عكس الشرط (لا تحوي)
                    </label>
                    {nextSelect(selectedNode.id, selectedNode.ifTrueId ?? null, (next) => updateNode(selectedNode.id, { ifTrueId: next }), 'إذا تحقق الشرط ← نعم')}
                    {nextSelect(selectedNode.id, selectedNode.ifFalseId ?? null, (next) => updateNode(selectedNode.id, { ifFalseId: next }), 'إذا لم يتحقق ← لا')}
                  </>
                )}

                {selectedNode.kind === 'goto' && (
                  nextSelect(selectedNode.id, selectedNode.targetId ?? null, (next) => updateNode(selectedNode.id, { targetId: next }), 'الانتقال إلى')
                )}

                {selectedNode.kind !== 'if' && selectedNode.kind !== 'goto' && nextSelect(selectedNode.id, selectedNode.nextId ?? null, (next) => updateNode(selectedNode.id, { nextId: next }))}
              </div>
            ) : (
              <div className="p-5 text-center text-xs text-slate-400">اضغط عقدة في اللوحة لتحرير خصائصها وروابطها</div>
            )}
          </div>
        </div>

        {/* التذييل */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-100">
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 flex-1">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            className={`py-2.5 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors ${error ? '' : 'mr-auto'}`}
          >
            {migrated ? 'حفظ التعديلات' : 'إنشاء سير العمل'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-6 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

