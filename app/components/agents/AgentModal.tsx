// components/agents/AgentModal.tsx — إنشاء وكيل أو تعديله: الهوية، التوجيهات، النبرة، والمهارات
import { useState } from 'react';
import { AlertCircle, ShoppingCart, X } from 'lucide-react';
import { AGENT_TONES, type AgentConfig } from './types';

interface AgentModalProps {
  initial: AgentConfig | null; // null = وكيل جديد
  onClose: () => void;
  onSave: (agent: AgentConfig) => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

export default function AgentModal({ initial, onClose, onSave }: AgentModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [openingMessage, setOpeningMessage] = useState(initial?.openingMessage ?? '');
  const [tone, setTone] = useState(initial?.tone ?? 'ودود');
  const [autoReply, setAutoReply] = useState(initial?.autoReply ?? true);
  const [ordersSkill, setOrdersSkill] = useState(initial?.skills.orders ?? true);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return setError('أدخل اسماً للوكيل');
    if (!instructions.trim()) return setError('أدخل توجيهاتك للوكيل — ماذا يقول وكيف');
    onSave({
      ...(initial as AgentConfig),
      name: name.trim(),
      role: role.trim(),
      instructions: instructions.trim(),
      openingMessage: openingMessage.trim(),
      tone,
      autoReply,
      skills: { orders: ordersSkill },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">{initial ? `تعديل «${initial.name}»` : 'وكيل جديد'}</h2>
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
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="agent-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                اسم الوكيل <span className="text-red-500">*</span>
              </label>
              <input
                id="agent-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="مساعد سلطان"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="agent-role" className="block text-sm font-medium text-slate-700 mb-1.5">الدور / الصفة</label>
              <input
                id="agent-role"
                type="text"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="مندوب خدمة العملاء"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="agent-instructions" className="block text-sm font-medium text-slate-700 mb-1.5">
              توجيهاتك للوكيل — ماذا يقول وكيف؟ <span className="text-red-500">*</span>
            </label>
            <textarea
              id="agent-instructions"
              rows={6}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder={'مثال:\n- رحّب بالعميل باسمه\n- لا تعد بخصومات\n- اقترح بدائل عند نفاد الصنف'}
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </div>

          <div>
            <label htmlFor="agent-opening" className="block text-sm font-medium text-slate-700 mb-1.5">رسالة الترحيب</label>
            <textarea
              id="agent-opening"
              rows={2}
              value={openingMessage}
              onChange={(event) => setOpeningMessage(event.target.value)}
              className={`${inputClass} resize-none`}
            />
            <p className="text-xs text-slate-400 mt-1.5">تُرسل تلقائياً عند فتح محادثة جديدة والرد التلقائي مفعّل.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="agent-tone" className="block text-sm font-medium text-slate-700 mb-1.5">نبرة الحديث</label>
              <select
                id="agent-tone"
                value={tone}
                onChange={(event) => setTone(event.target.value as AgentConfig['tone'])}
                className={`${inputClass} bg-white cursor-pointer`}
              >
                {AGENT_TONES.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5 cursor-pointer">
              <span className="text-sm font-medium text-slate-700">الرد التلقائي</span>
              <button
                type="button"
                role="switch"
                aria-checked={autoReply}
                aria-label="الرد التلقائي"
                onClick={() => setAutoReply((prev) => !prev)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${autoReply ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${autoReply ? 'right-0.5' : 'right-[22px]'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-2.5 cursor-pointer" title="استقبال الطلبات وإنشاء فواتير المقبوضات">
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                <ShoppingCart className="w-4 h-4" aria-hidden="true" />
                مهارة الطلبات
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={ordersSkill}
                aria-label="مهارة استقبال الطلبات"
                onClick={() => setOrdersSkill((prev) => !prev)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${ordersSkill ? 'bg-emerald-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${ordersSkill ? 'right-0.5' : 'right-[22px]'}`} />
              </button>
            </label>
          </div>

          {ordersSkill && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 leading-relaxed">
              عندما يطلب العميل شراء بضاعة يستطيع هذا الوكيل: تسجيل عميل جديد باسمه، تجميع بنود الطلب
              بأسعار القائمة، وإنشاء فاتورة مقبوضات (كاش أو ذمة) — تظهر الفاتورة فوراً في صفحة الفواتير لدى المالك.
            </p>
          )}

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
              {initial ? 'حفظ التعديلات' : 'إنشاء الوكيل'}
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
