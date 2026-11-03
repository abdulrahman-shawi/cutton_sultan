// components/workflows/WorkflowModal.tsx — منشئ سير العمل بنمط العقد (مثل n8n):
// عقدة محفّز في الأعلى تتفرع منها عقد الإجراءات بخطوط وصلة، وزر + بين كل عقدتين لإدراج إجراء،
// ولوحة خصائص جانبية تعدّل العقدة المحددة (المحفّز أو أحد الإجراءات)
import { useState } from 'react';
import { AlertCircle, Bell, Plus, Reply, Trash2, Workflow as WorkflowIcon, X, Zap } from 'lucide-react';
import type { Workflow, WorkflowAction, WorkflowTrigger } from './types';

interface WorkflowModalProps {
  initial: Workflow | null; // null = سير جديد
  onClose: () => void;
  onSave: (data: { name: string; enabled: boolean; trigger: WorkflowTrigger; actions: WorkflowAction[] }, id: string | null) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

type TriggerKind = WorkflowTrigger['kind'];

const TRIGGER_OPTIONS: { value: TriggerKind; label: string; hint: string }[] = [
  { value: 'message', label: 'رسالة تتضمن كلمة', hint: 'عند وصول رسالة من العميل تحوي الكلمة المفتاحية' },
  { value: 'new_customer', label: 'عميل جديد', hint: 'عند أول رسالة يفتح بها عميل محادثة جديدة مع المتجر' },
  { value: 'no_reply', label: 'عدم ردّ المحل', hint: 'عندما تمرّ دقائق بلا ردّ على آخر رسالة للعميل' },
  { value: 'inactive', label: 'انتهاء المحادثة', hint: 'عندما لا يتحدث العميل منذ عدد ساعات محدد' },
  { value: 'manual', label: 'تشغيل يدوي', hint: 'يُشغَّل فقط بزر «تشغيل» — مناسب للرسائل الدورية' },
];

type Selection = { type: 'trigger' } | { type: 'action'; index: number } | null;

function triggerSummary(kind: TriggerKind, keyword: string, minutes: string, hours: string): string {
  if (kind === 'message') return keyword.trim() ? `كلمة: «${keyword.trim()}»` : 'أي رسالة واردة';
  if (kind === 'new_customer') return 'أول رسالة في محادثة جديدة';
  if (kind === 'no_reply') return `بلا ردّ خلال ${minutes || '…'} دقيقة`;
  if (kind === 'inactive') return `صمت العميل ${hours || '…'} ساعة`;
  return 'تشغيل يدوي فقط';
}

function createAction(kind: WorkflowAction['kind']): WorkflowAction {
  return kind === 'reply' ? { kind: 'reply', text: '' } : { kind: 'notify', text: '' };
}

export default function WorkflowModal({ initial, onClose, onSave }: WorkflowModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [triggerKind, setTriggerKind] = useState<TriggerKind>(initial?.trigger.kind ?? 'message');
  const [keyword, setKeyword] = useState(initial?.trigger.kind === 'message' ? initial.trigger.keyword : '');
  const [minutes, setMinutes] = useState(initial?.trigger.kind === 'no_reply' ? String(initial.trigger.minutes) : '30');
  const [hours, setHours] = useState(initial?.trigger.kind === 'inactive' ? String(initial.trigger.hours) : '24');
  const [actions, setActions] = useState<WorkflowAction[]>(initial?.actions ?? []);
  const [selected, setSelected] = useState<Selection>({ type: 'trigger' });
  const [error, setError] = useState('');

  const updateAction = (index: number, patch: Partial<WorkflowAction>) => {
    setActions((prev) => prev.map((action, i) => (i === index ? ({ ...action, ...patch } as WorkflowAction) : action)));
  };

  const insertAction = (index: number, kind: WorkflowAction['kind']) => {
    setActions((prev) => [...prev.slice(0, index), createAction(kind), ...prev.slice(index)]);
    setSelected({ type: 'action', index });
  };

  const removeAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
    setSelected({ type: 'trigger' });
  };

  const handleSubmit = () => {
    if (!name.trim()) return setError('أدخل اسماً لسير العمل');
    let trigger: WorkflowTrigger;
    if (triggerKind === 'message') {
      if (!keyword.trim()) return setError('أدخل الكلمة المفتاحية للمحفّز');
      trigger = { kind: 'message', keyword: keyword.trim() };
    } else if (triggerKind === 'new_customer') {
      trigger = { kind: 'new_customer' };
    } else if (triggerKind === 'no_reply') {
      const value = Math.floor(Number(minutes));
      if (!Number.isFinite(value) || value < 1) return setError('أدخل عدد دقائق صحيحاً (1 على الأقل)');
      trigger = { kind: 'no_reply', minutes: value };
    } else if (triggerKind === 'inactive') {
      const value = Math.floor(Number(hours));
      if (!Number.isFinite(value) || value < 1) return setError('أدخل عدد ساعات صحيحاً (1 على الأقل)');
      trigger = { kind: 'inactive', hours: value };
    } else {
      trigger = { kind: 'manual' };
    }
    if (actions.length === 0) return setError('أضف عقدة إجراء واحدة على الأقل من زر +');
    for (let i = 0; i < actions.length; i++) {
      if (!actions[i].text.trim()) return setError(`عقدة الإجراء رقم ${i + 1} بدون نص — اضغطها واملأها`);
    }
    onSave(
      { name: name.trim(), enabled, trigger, actions: actions.map((action) => ({ ...action, text: action.text.trim() })) },
      initial?.id ?? null
    );
  };

  const selectedTriggerHint = TRIGGER_OPTIONS.find((option) => option.value === triggerKind)?.hint ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden bg-white rounded-2xl shadow-xl flex flex-col">
        {/* الشريط العلوي: الاسم والتفعيل والحفظ */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 flex-wrap">
          <WorkflowIcon className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="اسم سير العمل..."
            className="flex-1 min-w-[160px] rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
          {/* لوحة العقد */}
          <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50/70 min-h-[380px]"
            style={{ backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '18px 18px' }}
          >
            <div className="max-w-sm mx-auto">
              {/* عقدة المحفّز */}
              <button
                type="button"
                onClick={() => setSelected({ type: 'trigger' })}
                className={`w-full text-right rounded-2xl border-2 bg-white shadow-sm transition-colors ${
                  selected?.type === 'trigger' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-500 text-white rounded-t-xl">
                  <Zap className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-bold">المحفّز — متى يبدأ السير</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{TRIGGER_OPTIONS.find((o) => o.value === triggerKind)?.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{triggerSummary(triggerKind, keyword, minutes, hours)}</p>
                </div>
              </button>

              {/* موصل مع زر إدراج */}
              <Connector onAdd={(kind) => insertAction(0, kind)} />

              {/* عقد الإجراءات */}
              {actions.length === 0 && (
                <button
                  type="button"
                  onClick={() => insertAction(0, 'reply')}
                  className="w-full rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/40 text-blue-600 text-sm font-medium py-4 hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-4 h-4 inline-block ml-1" aria-hidden="true" />
                  أضف أول إجراء
                </button>
              )}
              {actions.map((action, index) => (
                <div key={index}>
                  <div
                    className={`w-full text-right rounded-2xl border-2 bg-white shadow-sm transition-colors ${
                      selected?.type === 'action' && selected.index === index
                        ? action.kind === 'reply'
                          ? 'border-blue-500 ring-2 ring-blue-100'
                          : 'border-amber-500 ring-2 ring-amber-100'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <button type="button" onClick={() => setSelected({ type: 'action', index })} className="w-full text-right">
                      <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-t-xl ${action.kind === 'reply' ? 'bg-blue-600' : 'bg-amber-500'} text-white`}>
                        {action.kind === 'reply' ? (
                          <Reply className="w-4 h-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
                        )}
                        <span className="text-xs font-bold">{action.kind === 'reply' ? 'يردّ الوكيل برسالة' : 'إشعار داخلي للمالك'}</span>
                        <span className="mr-auto text-[10px] text-white/70">عقدة {index + 1}</span>
                      </div>
                      <div className="px-4 py-3">
                        <p className={`text-xs leading-relaxed ${action.text.trim() ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                          {action.text.trim() || 'اضغط العقدة لكتابة النص...'}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center justify-end px-3 pb-2">
                      <button
                        type="button"
                        onClick={() => removeAction(index)}
                        aria-label="حذف العقدة"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <Connector onAdd={(kind) => insertAction(index + 1, kind)} />
                </div>
              ))}

              {actions.length > 0 && (
                <p className="text-center text-[11px] text-slate-400 mt-1">تُنفَّذ العقد بالتتابع من الأعلى إلى الأسفل</p>
              )}
            </div>
          </div>

          {/* لوحة خصائص العقدة المحددة */}
          <div className="lg:w-80 border-t lg:border-t-0 lg:border-r border-slate-100 bg-white overflow-y-auto">
            {selected?.type === 'trigger' ? (
              <div className="p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  خصائص المحفّز
                </h3>
                <div>
                  <label htmlFor="node-trigger" className="block text-xs font-medium text-slate-600 mb-1.5">نوع المحفّز</label>
                  <select
                    id="node-trigger"
                    value={triggerKind}
                    onChange={(event) => setTriggerKind(event.target.value as TriggerKind)}
                    className={`${inputClass} bg-white cursor-pointer`}
                  >
                    {TRIGGER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{selectedTriggerHint}</p>
                </div>
                {triggerKind === 'message' && (
                  <div>
                    <label htmlFor="node-keyword" className="block text-xs font-medium text-slate-600 mb-1">الكلمة المفتاحية</label>
                    <input
                      id="node-keyword"
                      type="text"
                      value={keyword}
                      onChange={(event) => setKeyword(event.target.value)}
                      placeholder="مثال: سعر"
                      className={inputClass}
                    />
                  </div>
                )}
                {triggerKind === 'no_reply' && (
                  <div>
                    <label htmlFor="node-minutes" className="block text-xs font-medium text-slate-600 mb-1">المهلة (دقائق)</label>
                    <input
                      id="node-minutes"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={minutes}
                      onChange={(event) => setMinutes(event.target.value)}
                      className={`${inputClass} text-center`}
                    />
                  </div>
                )}
                {triggerKind === 'inactive' && (
                  <div>
                    <label htmlFor="node-hours" className="block text-xs font-medium text-slate-600 mb-1">الساعات</label>
                    <input
                      id="node-hours"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={hours}
                      onChange={(event) => setHours(event.target.value)}
                      className={`${inputClass} text-center`}
                    />
                  </div>
                )}
              </div>
            ) : selected?.type === 'action' && actions[selected.index] ? (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    {actions[selected.index].kind === 'reply' ? (
                      <Reply className="w-4 h-4 text-blue-600" aria-hidden="true" />
                    ) : (
                      <Bell className="w-4 h-4 text-amber-500" aria-hidden="true" />
                    )}
                    خصائص العقدة {selected.index + 1}
                  </h3>
                  <button
                    type="button"
                    onClick={() => removeAction(selected.index)}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    حذف
                  </button>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-600 mb-1.5">نوع الإجراء</span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => updateAction(selected.index, { kind: 'reply' })}
                      className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                        actions[selected.index].kind === 'reply' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      رد الوكيل
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAction(selected.index, { kind: 'notify' })}
                      className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                        actions[selected.index].kind === 'notify' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      إشعار
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="node-action-text" className="block text-xs font-medium text-slate-600 mb-1">
                    {actions[selected.index].kind === 'reply' ? 'نص رد الوكيل' : 'نص الإشعار'}
                  </label>
                  <textarea
                    id="node-action-text"
                    rows={5}
                    value={actions[selected.index].text}
                    onChange={(event) => updateAction(selected.index, { text: event.target.value })}
                    placeholder={
                      actions[selected.index].kind === 'reply'
                        ? 'مثال: أهلاً {اسم_العميل}، شكراً لتواصلك...'
                        : 'نص يظهر لك عند تنفيذ السير'
                    }
                    className={`${inputClass} resize-none text-xs leading-relaxed`}
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">يمكنك استخدام {'{اسم_العميل}'} ليُستبدل بالاسم الحقيقي.</p>
                </div>
              </div>
            ) : (
              <div className="p-5 text-center text-xs text-slate-400">اضغط عقدة في اللوحة لتحرير خصائصها</div>
            )}
          </div>
        </div>

        {/* التذييل */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-t border-slate-100">
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
            {initial ? 'حفظ التعديلات' : 'إنشاء سير العمل'}
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

// خط الوصل العمودي بين عقدتين مع زر + لإدراج إجراء جديد في هذه النقطة
function Connector({ onAdd }: { onAdd: (kind: WorkflowAction['kind']) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-center py-0.5">
      <div className="w-0.5 h-4 bg-slate-300" />
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="إدراج إجراء هنا"
          className="w-6 h-6 rounded-full bg-white border-2 border-slate-300 grid place-items-center text-slate-400 hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute z-20 top-full right-1/2 translate-x-1/2 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 w-40">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onAdd('reply');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <Reply className="w-3.5 h-3.5" aria-hidden="true" />
                رد الوكيل
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onAdd('notify');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-amber-50 hover:text-amber-600 transition-colors"
              >
                <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                إشعار
              </button>
            </div>
          </>
        )}
      </div>
      <div className="w-0.5 h-4 bg-slate-300" />
    </div>
  );
}
