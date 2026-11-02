// components/workflows/WorkflowModal.tsx — منشئ سير العمل: المحفّز + قائمة الإجراءات
import { useState } from 'react';
import { AlertCircle, Bell, Plus, Reply, Trash2, X } from 'lucide-react';
import type { Workflow, WorkflowAction, WorkflowTrigger } from './types';

interface WorkflowModalProps {
  initial: Workflow | null; // null = سير جديد
  onClose: () => void;
  onSave: (data: { name: string; enabled: boolean; trigger: WorkflowTrigger; actions: WorkflowAction[] }, id: string | null) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

function createAction(kind: WorkflowAction['kind']): WorkflowAction {
  return kind === 'reply'
    ? { kind: 'reply', text: '' }
    : { kind: 'notify', text: '' };
}

export default function WorkflowModal({ initial, onClose, onSave }: WorkflowModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [triggerKind, setTriggerKind] = useState<'message' | 'manual'>(initial?.trigger.kind ?? 'message');
  const [keyword, setKeyword] = useState(initial?.trigger.kind === 'message' ? initial.trigger.keyword : '');
  const [actions, setActions] = useState<WorkflowAction[]>(initial?.actions ?? [{ kind: 'reply', text: '' }]);
  const [error, setError] = useState('');

  const updateAction = (index: number, patch: Partial<WorkflowAction>) => {
    setActions((prev) => prev.map((action, i) => (i === index ? ({ ...action, ...patch } as WorkflowAction) : action)));
  };

  const handleSubmit = () => {
    if (!name.trim()) return setError('أدخل اسماً لسير العمل');
    if (triggerKind === 'message' && !keyword.trim()) return setError('أدخل الكلمة المفتاحية للمحفّز');
    if (actions.length === 0) return setError('أضف إجراءً واحداً على الأقل');
    for (let i = 0; i < actions.length; i++) {
      if (!actions[i].text.trim()) return setError(`أدخل نص الإجراء رقم ${i + 1}`);
    }
    const trigger: WorkflowTrigger = triggerKind === 'message' ? { kind: 'message', keyword: keyword.trim() } : { kind: 'manual' };
    onSave(
      { name: name.trim(), enabled, trigger, actions: actions.map((action) => ({ ...action, text: action.text.trim() })) },
      initial?.id ?? null
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">{initial ? 'تعديل سير العمل' : 'سير عمل جديد'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="workflow-name" className="block text-sm font-medium text-slate-700 mb-1.5">
              اسم سير العمل <span className="text-red-500">*</span>
            </label>
            <input
              id="workflow-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثال: رد الترحيب بالعملاء الجدد"
              className={inputClass}
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1.5">المحفّز — متى يعمل؟</span>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 mb-3">
              <button
                type="button"
                onClick={() => setTriggerKind('message')}
                className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                  triggerKind === 'message' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                رسالة واردة
              </button>
              <button
                type="button"
                onClick={() => setTriggerKind('manual')}
                className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                  triggerKind === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                تشغيل يدوي
              </button>
            </div>
            {triggerKind === 'message' ? (
              <div>
                <label htmlFor="workflow-keyword" className="block text-xs font-medium text-slate-600 mb-1">
                  الكلمة المفتاحية في رسالة العميل <span className="text-red-500">*</span>
                </label>
                <input
                  id="workflow-keyword"
                  type="text"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="مثال: سعر، توفر، عنوان"
                  className={inputClass}
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  إذا احتوت رسالة العميل هذه الكلمة طُبّق السير تلقائياً في الوارد.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">يُشغَّل فقط بزر «تشغيل» من القائمة — مناسب للرسائل الدورية.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">الإجراءات — ماذا يفعل؟</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setActions((prev) => [...prev, createAction('reply')])}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Reply className="w-3.5 h-3.5" aria-hidden="true" />
                  رد
                </button>
                <button
                  type="button"
                  onClick={() => setActions((prev) => [...prev, createAction('notify')])}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                >
                  <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                  إشعار
                </button>
              </div>
            </div>
            <ul className="space-y-3">
              {actions.map((action, index) => (
                <li key={index} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                        action.kind === 'reply' ? 'text-blue-600' : 'text-amber-600'
                      }`}
                    >
                      {action.kind === 'reply' ? <Reply className="w-3.5 h-3.5" aria-hidden="true" /> : <Bell className="w-3.5 h-3.5" aria-hidden="true" />}
                      {action.kind === 'reply' ? 'يردّ الوكيل برسالة' : 'إشعار داخلي'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActions((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="حذف الإجراء"
                      className="p-1 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={action.text}
                    onChange={(event) => updateAction(index, { text: event.target.value })}
                    placeholder={
                      action.kind === 'reply'
                        ? 'نص رد الوكيل — يمكنك استخدام {اسم_العميل}'
                        : 'نص الإشعار الذي يظهر للمالك'
                    }
                    className={`${inputClass} resize-none text-xs leading-relaxed`}
                  />
                </li>
              ))}
            </ul>
            {actions.length === 0 && (
              <button
                type="button"
                onClick={() => setActions([createAction('reply')])}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-4 h-4 inline-block ml-1" aria-hidden="true" />
                إضافة إجراء
              </button>
            )}
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5 cursor-pointer">
            <span className="text-sm font-medium text-slate-700">سير العمل مفعّل</span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="تفعيل سير العمل"
              onClick={() => setEnabled((prev) => !prev)}
              className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${enabled ? 'right-0.5' : 'right-[22px]'}`} />
            </button>
          </label>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              {initial ? 'حفظ التعديلات' : 'إنشاء سير العمل'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
